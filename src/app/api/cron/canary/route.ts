import { db } from "@/lib/db";
import type { EventRow } from "@/lib/events";
import { fourZones, localDate, scheduleOf, sessionFor } from "@/lib/daily-schedule";
import { postmarkConfigured } from "@/lib/postmark";
import { postToIntel } from "@/lib/slack";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const SITE = (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.bestonlineclassroom.com").replace(/\/$/, "");

type Check = { name: string; ok: boolean; detail: string };

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
  const report: Array<{ event: string; runs: boolean; checks: Check[] }> = [];
  for (const e of ((events ?? []) as EventRow[]).filter((x) => !x.slug.startsWith("test"))) {
    const schedule = scheduleOf(e);
    const session = sessionFor(schedule, localDate(schedule, now));
    if (!session || session.end.getTime() < now.getTime()) {
      report.push({ event: e.slug, runs: false, checks: [] });
      continue;
    }
    const checks: Check[] = [];
    const video = e.video_url ? await head(e.video_url, true) : { ok: false, status: 0 };
    checks.push({ name: "video", ok: video.ok, detail: e.video_url ? `HTTP ${video.status} on a byte range` : "no video uploaded" });
    const page = await head(`${SITE}/w/${e.slug}`);
    checks.push({ name: "open page", ok: page.ok, detail: `HTTP ${page.status}` });
    const offer = e.cta_href ? await head(e.cta_href) : { ok: false, status: 0 };
    checks.push({ name: "offer link", ok: offer.ok, detail: e.cta_href ? `HTTP ${offer.status}` : "no offer link" });
    const crowd = await db().from("simulated_messages").select("id", { count: "exact", head: true }).eq("event_id", e.id);
    checks.push({ name: "crowd", ok: (crowd.count ?? 0) > 100, detail: `${crowd.count ?? 0} simulated messages` });
    const regs = await db().from("registrants").select("id", { count: "exact", head: true }).eq("event_id", e.id).eq("session_date", session.date).neq("source", "test");
    checks.push({ name: "registered", ok: (regs.count ?? 0) > 0, detail: `${regs.count ?? 0} hold a link for today` });
    const rules = (e.reminder_rules ?? []).map((r) => r.key);
    checks.push({ name: "reminder rules", ok: rules.includes("before30") && rules.includes("before15"), detail: rules.join(", ") || "none" });
    const sends = await db().from("reminder_sends").select("registrant_id", { count: "exact", head: true }).gte("sent_at", new Date(now.getTime() - 30 * 3_600_000).toISOString());
    checks.push({ name: "reminders cron", ok: (sends.count ?? 0) > 0, detail: `${sends.count ?? 0} reminders sent in the last 30 h` });
    checks.push({ name: "mail", ok: postmarkConfigured(), detail: postmarkConfigured() ? "Postmark configured" : "Postmark not configured" });
    checks.push({ name: "poster and icon", ok: Boolean(e.icon_url) && (e.poster_url ? (await head(e.poster_url)).ok : true), detail: e.poster_url ? "poster answers" : "no poster (button on black)" });
    report.push({ event: e.slug, runs: true, checks });
  }
  const lines = report.map((r) => {
    const e = (events ?? []).find((x) => x.slug === r.event) as EventRow;
    if (!r.runs) return `⚪ ${e.title}: no session today.`;
    const bad = r.checks.filter((c) => !c.ok);
    const zones = fourZones(sessionFor(scheduleOf(e), localDate(scheduleOf(e), now))!);
    const at = zones.find(([z]) => z === "Mountain")?.[1] ?? "";
    return bad.length === 0
      ? `🟢 Canary: ${e.title} runs at ${at} Mountain. ${r.checks.map((c) => c.detail).join(" · ")}.`
      : `🔴 Canary: ${e.title} at ${at} Mountain has ${bad.length} problem${bad.length === 1 ? "" : "s"}: ${bad.map((c) => `${c.name} (${c.detail})`).join("; ")}. Everything else passed.`;
  });
  const posted = await postToIntel(lines.join("\n"));
  return Response.json({ ok: report.every((r) => !r.runs || r.checks.every((c) => c.ok)), report, posted }, { headers: { "cache-control": "no-store" } });
}
