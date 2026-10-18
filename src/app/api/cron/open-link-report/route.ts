import { db } from "@/lib/db";
import { localDate, scheduleOf, sessionFor } from "@/lib/daily-schedule";
import type { EventRow } from "@/lib/events";
import { openLinkLine, shiftDay, type Funnel } from "@/lib/open-link";
import { postToIntel } from "@/lib/slack";
import { SKOOL_MEMBERS, resultLine, type BroadcastResult } from "@/lib/skool-broadcast-results";
import { SKOOL_GROUP } from "@/lib/skool-broadcast";
import { loadJoinSources } from "@/lib/join-sources-data";
import { joinSourcesLine } from "@/lib/join-sources";

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
 * The nightly open-link line (SPEC-phase7.md), after the session: for an event whose open link asks for an email,
 * tonight's cards → emails → joined against the name-only nights before the switch; for every event, how many
 * clients the wall turned away today. Schedule in vercel.json (8:50 PM Mountain in summer, 7:50 PM in winter).
 */
export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const now = new Date();
  const { data: events } = await db().from("events").select("*");
  const lines: string[] = [];
  for (const e of ((events ?? []) as EventRow[]).filter((x) => !x.slug.startsWith("test"))) {
    const schedule = scheduleOf(e);
    const today = localDate(schedule, now);
    if (!sessionFor(schedule, today)) continue;
    if (e.open_link_field === "email" && e.open_link_email_since) {
      const tonight = await funnel(e.id, today, today);
      const baseline = await funnel(e.id, shiftDay(e.open_link_email_since, -BASELINE_NIGHTS), shiftDay(e.open_link_email_since, -1));
      lines.push(openLinkLine(e.title, today, tonight, baseline, BASELINE_NIGHTS));
    }
    const walled = await db().from("registrants").select("id", { count: "exact", head: true }).eq("event_id", e.id).eq("session_date", today).eq("block_reason", "client");
    const hits = await db().from("link_clicks").select("id", { count: "exact", head: true }).eq("event_id", e.id).eq("session_date", today).eq("outcome", "walled");
    lines.push(joinSourcesLine(e.title, today, await loadJoinSources(e.id, today, e.cta_at_seconds ?? 4500)));
    const broadcast = await db().from("skool_broadcasts").select("id, weekday, title").eq("group_slug", SKOOL_GROUP).eq("broadcast_date", today).eq("status", "posted").maybeSingle();
    if (broadcast.data && e.slug === "ailg-r") {
      const result = await scoreBroadcast(e.id, today, e.cta_at_seconds ?? 4500);
      await db().from("skool_broadcasts").update({ result, scored_at: now.toISOString() }).eq("id", broadcast.data.id);
      lines.push(resultLine(broadcast.data.weekday as string, today, broadcast.data.title as string, result));
    }
    lines.push(`🚧 Client wall, ${e.title} ${today}: ${walled.count ?? 0} client${walled.count === 1 ? "" : "s"} held a link, ${hits.count ?? 0} opened it and got the 404.`);
  }
  const posted = lines.length ? await postToIntel(lines.join("\n")) : { ok: true };
  return Response.json({ ok: posted.ok, lines }, { headers: { "cache-control": "no-store" } });
}
