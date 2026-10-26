import { db } from "@/lib/db";
import { localDate, scheduleOf, sessionFor } from "@/lib/daily-schedule";
import type { EventRow } from "@/lib/events";
import { shiftDay, type Funnel } from "@/lib/open-link";
import { INTEL_CHANNEL, postNotice, renderNotice, type Notice } from "@/lib/slack";
import { SKOOL_MEMBERS, type BroadcastResult } from "@/lib/skool-broadcast-results";
import { SKOOL_GROUP } from "@/lib/skool-broadcast";
import { loadJoinSources } from "@/lib/join-sources-data";
import { nightlyNotice } from "@/lib/notices";

export const dynamic = "force-dynamic";

const GUEST_SOURCES = ["skool", "guest", "legacy"];
const BASELINE_NIGHTS = 7;

/** Tonight's Skool broadcast, scored from the room's own tables (SPEC-show-rate-recovery.md W4). */
async function scoreBroadcast(eventId: string, date: string, ctaAt: number): Promise<BroadcastResult> {
  const cards = await db().from("link_clicks").select("id", { count: "exact", head: true }).eq("event_id", eventId).eq("path", "w").eq("outcome", "prompt").eq("src", "skool").eq("session_date", date);
  const regs = await db().from("registrants").select("id").eq("event_id", eventId).eq("source", "skool").eq("session_date", date);
  const ids = (regs.data ?? []).map((r) => r.id as string);
  let joined = 0, atPitch = 0, booked = 0;
  if (ids.length) {
    const att = await db().from("attendance").select("registrant_id, max_offset").eq("kind", "live").eq("session_date", date).in("registrant_id", ids);
    const seen = new Set<string>(); const pitched = new Set<string>();
    for (const a of att.data ?? []) { seen.add(a.registrant_id as string); if ((a.max_offset as number) >= ctaAt) pitched.add(a.registrant_id as string); }
    joined = seen.size; atPitch = pitched.size;
    const b = await db().from("bookings").select("id", { count: "exact", head: true }).eq("event_id", eventId).eq("session_date", date).in("registrant_id", ids);
    booked = b.count ?? 0;
  }
  return { emailed: SKOOL_MEMBERS, doorClicks: cards.count ?? 0, entered: ids.length, joined, atPitch, booked };
}

async function funnel(eventId: string, from: string, to: string): Promise<Funnel> {
  const cards = await db().from("link_clicks").select("id", { count: "exact", head: true }).eq("event_id", eventId).eq("path", "w").eq("outcome", "prompt").gte("session_date", from).lte("session_date", to);
  const submitted = await db().from("registrants").select("id", { count: "exact", head: true }).eq("event_id", eventId).in("source", GUEST_SOURCES).gte("session_date", from).lte("session_date", to);
  const joined = await db().from("attendance").select("id, registrant:registrants!inner(event_id, source)", { count: "exact", head: true }).eq("kind", "live").gte("session_date", from).lte("session_date", to).eq("registrant.event_id", eventId).in("registrant.source", GUEST_SOURCES);
  return { cards: cards.count ?? 0, submitted: submitted.count ?? 0, joined: joined.count ?? 0 };
}

/**
 * The nightly readout (SPEC-phase7.md), after the session, one 📊 per event: joins by source with the bookings; for an
 * event whose open link asks for an email, tonight's cards → emails → joined against the name-only nights before the
 * switch; how many clients the wall turned away today; the Skool broadcast's result when one went out. Schedule in
 * vercel.json (8:50 PM Mountain in summer, 7:50 PM in winter). `?dry=1` renders without posting.
 */
export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const dry = new URL(request.url).searchParams.get("dry") === "1";
  const now = new Date();
  const { data: events } = await db().from("events").select("*");
  const notices: Notice[] = [];
  for (const e of ((events ?? []) as EventRow[]).filter((x) => !x.slug.startsWith("test"))) {
    const schedule = scheduleOf(e);
    const today = localDate(schedule, now);
    if (!sessionFor(schedule, today)) continue;
    const openLink = e.open_link_field === "email" && e.open_link_email_since
      ? { title: e.title, date: today, tonight: await funnel(e.id, today, today), baseline: await funnel(e.id, shiftDay(e.open_link_email_since, -BASELINE_NIGHTS), shiftDay(e.open_link_email_since, -1)), nights: BASELINE_NIGHTS }
      : null;
    const walled = await db().from("registrants").select("id", { count: "exact", head: true }).eq("event_id", e.id).eq("session_date", today).eq("block_reason", "client");
    const hits = await db().from("link_clicks").select("id", { count: "exact", head: true }).eq("event_id", e.id).eq("session_date", today).eq("outcome", "walled");
    const joins = await loadJoinSources(e.id, today, e.cta_at_seconds ?? 4500);
    const posted = await db().from("skool_broadcasts").select("id, weekday, title").eq("group_slug", SKOOL_GROUP).eq("broadcast_date", today).eq("status", "posted").maybeSingle();
    let broadcast: { weekday: string; date: string; title: string; result: BroadcastResult } | null = null;
    if (posted.data && e.slug === "ailg-r") {
      const result = await scoreBroadcast(e.id, today, e.cta_at_seconds ?? 4500);
      if (!dry) await db().from("skool_broadcasts").update({ result, scored_at: now.toISOString() }).eq("id", posted.data.id);
      broadcast = { weekday: posted.data.weekday as string, date: today, title: posted.data.title as string, result };
    }
    const label = new Intl.DateTimeFormat("en-US", { timeZone: e.timezone, weekday: "short", month: "short", day: "numeric" }).format(new Date(`${today}T12:00:00Z`)).replace(",", "");
    notices.push(nightlyNotice({ label, joins, openLink, wall: { held: walled.count ?? 0, hit: hits.count ?? 0 }, broadcast }));
  }
  const results = dry ? [] : await Promise.all(notices.map((n) => postNotice(INTEL_CHANNEL, n)));
  return Response.json({ ok: results.every((r) => r.ok), lines: notices.map(renderNotice) }, { headers: { "cache-control": "no-store" } });
}
