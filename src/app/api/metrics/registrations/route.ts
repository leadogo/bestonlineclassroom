import { db } from "@/lib/db";
import { getEvent } from "@/lib/events";
import { scheduleOf, sessionFor } from "@/lib/daily-schedule";

export const dynamic = "force-dynamic";

const SECRET = process.env.REGISTER_SECRET ?? "";

/**
 * GET /api/metrics/registrations?event=ailg-r&date=YYYY-MM-DD (Bearer REGISTER_SECRET): what each site registration
 * did in the room that session, keyed by the site's registration id, so leadogo's Marketing Insights can say
 * "showed up" and "at the pitch" per landing variant now that joins happen here and not through the site's link.
 */
export async function GET(request: Request) {
  if (!SECRET || request.headers.get("authorization") !== `Bearer ${SECRET}`) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const q = new URL(request.url).searchParams;
  const event = await getEvent(q.get("event") ?? "ailg-r").catch(() => null);
  if (!event) return Response.json({ error: "Unknown event" }, { status: 404 });
  const date = q.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return Response.json({ error: "date=YYYY-MM-DD required" }, { status: 400 });
  const session = sessionFor(scheduleOf(event), date);
  const pitchAt = session && event.cta_at_seconds !== null ? session.start.getTime() + event.cta_at_seconds * 1000 : null;
  const { data: regs, error } = await db().from("registrants").select("id, site_registration_id, source").eq("event_id", event.id).eq("session_date", date).not("site_registration_id", "is", null).limit(5000);
  if (error) return Response.json({ error: "Lookup failed" }, { status: 500 });
  const rows = regs ?? [];
  const att = new Map<string, { joined_at: string; last_seen_at: string; seconds_watched: number; cta_clicked_at: string | null }>();
  for (let i = 0; i < rows.length; i += 200) {
    const { data } = await db().from("attendance").select("registrant_id, joined_at, last_seen_at, seconds_watched, cta_clicked_at").in("registrant_id", rows.slice(i, i + 200).map((r) => r.id)).eq("session_date", date).eq("kind", "live");
    for (const a of data ?? []) att.set(a.registrant_id as string, a as never);
  }
  const registrations = rows.map((r) => {
    const a = att.get(r.id);
    return {
      registration_id: r.site_registration_id,
      source: r.source,
      joined: Boolean(a),
      joined_at: a?.joined_at ?? null,
      minutes: a ? Math.round((a.seconds_watched ?? 0) / 60) : 0,
      at_pitch: Boolean(a && pitchAt !== null && new Date(a.joined_at).getTime() <= pitchAt && new Date(a.last_seen_at).getTime() >= pitchAt),
      clicked_offer: Boolean(a?.cta_clicked_at),
    };
  });
  return Response.json({ event: event.slug, session_date: date, registrations }, { headers: { "cache-control": "no-store" } });
}
