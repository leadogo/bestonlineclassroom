import { db } from "@/lib/db";
import type { EventRow } from "@/lib/events";
import { fourZones, localDate, scheduleOf, sessionFor } from "@/lib/daily-schedule";
import { postmarkConfigured } from "@/lib/postmark";
import { INTEL_CHANNEL, postNotice, renderNotice } from "@/lib/slack";
import { canaryNotice, type CanaryCheck } from "@/lib/notices";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const SITE = (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.bestonlineclassroom.com").replace(/\/$/, "");


async function head(url: string, range = false): Promise<{ ok: boolean; status: number }> {
  try {
    const res = await fetch(url, { method: range ? "GET" : "HEAD", headers: range ? { range: "bytes=0-1" } : {}, redirect: "follow", signal: AbortSignal.timeout(15_000) });
    if (range) await res.body?.cancel();
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false, status: 0 };
  }
}

/**
 * The daily canary (SPEC-phase5.md guardrail 6): at 3:45 PM Mountain, before anyone can deploy for the evening, every
 * event that runs today is checked end to end: the video answers a byte range, the open page renders, the offer link
 * answers, the crowd exists, people are registered, reminders went out yesterday, mail and Slack are configured.
 * One line to #autoweb-intel, green or red. `?force=1` runs it any time; the schedule is in vercel.json.
 */
export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const now = new Date();
  const { data: events } = await db().from("events").select("*");
  const report: Array<{ event: string; runs: boolean; checks: CanaryCheck[] }> = [];
  for (const e of ((events ?? []) as EventRow[]).filter((x) => !x.slug.startsWith("test"))) {
    const schedule = scheduleOf(e);
    const session = sessionFor(schedule, localDate(schedule, now));
    if (!session || session.end.getTime() < now.getTime()) {
      report.push({ event: e.slug, runs: false, checks: [] });
      continue;
    }
    const checks: CanaryCheck[] = [];
    const video = e.video_url ? await head(e.video_url, true) : { ok: false, status: 0 };
    checks.push({ name: "video", ok: video.ok, detail: e.video_url ? `HTTP ${video.status} on a byte range` : "no video uploaded", short: "video" });
    const page = await head(`${SITE}/w/${e.slug}`);
    checks.push({ name: "open page", ok: page.ok, detail: `HTTP ${page.status}`, short: "open page" });
    const offer = e.cta_href ? await head(e.cta_href) : { ok: false, status: 0 };
    checks.push({ name: "offer link", ok: offer.ok, detail: e.cta_href ? `HTTP ${offer.status}` : "no offer link", short: "offer link" });
    const crowd = await db().from("simulated_messages").select("id", { count: "exact", head: true }).eq("event_id", e.id);
    checks.push({ name: "crowd", ok: (crowd.count ?? 0) > 100, detail: `${crowd.count ?? 0} simulated messages`, short: `${crowd.count ?? 0} simulated messages` });
    const regs = await db().from("registrants").select("id", { count: "exact", head: true }).eq("event_id", e.id).eq("session_date", session.date).neq("source", "test");
    checks.push({ name: "registered", ok: (regs.count ?? 0) > 0, detail: `${regs.count ?? 0} hold a link for today`, short: `${regs.count ?? 0} registered` });
    const rules = (e.reminder_rules ?? []).map((r) => r.key);
    checks.push({ name: "reminder rules", ok: rules.includes("before30") && rules.includes("before15"), detail: rules.join(", ") || "none", short: "reminder rules" });
    const sends = await db().from("reminder_sends").select("registrant_id", { count: "exact", head: true }).gte("sent_at", new Date(now.getTime() - 30 * 3_600_000).toISOString());
    checks.push({ name: "reminders cron", ok: (sends.count ?? 0) > 0, detail: `${sends.count ?? 0} reminders sent in the last 30 h`, short: `${sends.count ?? 0} reminders sent` });
    checks.push({ name: "mail", ok: postmarkConfigured(), detail: postmarkConfigured() ? "Postmark configured" : "Postmark not configured", short: "mail" });
    checks.push({ name: "poster and icon", ok: Boolean(e.icon_url) && (e.poster_url ? (await head(e.poster_url)).ok : true), detail: e.poster_url ? "poster answers" : "no poster (button on black)", short: "poster" });
    const wall = await db().from("client_wall").select("seen_at", { count: "exact" }).is("released_at", null).order("seen_at", { ascending: false }).limit(1);
    const wallAt = wall.data?.[0]?.seen_at ? new Date(wall.data[0].seen_at as string).getTime() : 0;
    checks.push({ name: "client wall", ok: now.getTime() - wallAt < 2 * 3_600_000, detail: wallAt ? `${wall.count ?? 0} clients on the wall, synced ${Math.round((now.getTime() - wallAt) / 60_000)} min ago` : "client wall never synced", short: "client wall" });
    report.push({ event: e.slug, runs: true, checks });
  }
  // One health check per event that runs today (a day with no session posts nothing); `?dry=1` renders without posting.
  const dry = new URL(request.url).searchParams.get("dry") === "1";
  const notices = report.filter((r) => r.runs).map((r) => {
    const e = (events ?? []).find((x) => x.slug === r.event) as EventRow;
    const zones = fourZones(sessionFor(scheduleOf(e), localDate(scheduleOf(e), now))!);
    return canaryNotice({ title: e.title, at: `${zones.find(([z]) => z === "Mountain")?.[1] ?? ""} Mountain`, checks: r.checks });
  });
  const posted = dry ? [] : await Promise.all(notices.map((n) => postNotice(INTEL_CHANNEL, n)));
  return Response.json({ ok: report.every((r) => !r.runs || r.checks.every((c) => c.ok)), report, text: notices.map(renderNotice), posted }, { headers: { "cache-control": "no-store" } });
}
