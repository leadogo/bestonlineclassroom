import { db } from "@/lib/db";
import { getEvent } from "@/lib/events";
import { peakConcurrent, PRESENCE_GRACE_MS, retentionCurve } from "@/lib/outcomes";
import { scheduleOf, sessionFor } from "@/lib/daily-schedule";
import { loadHistory, projectBookings, typicalNight } from "@/lib/history";

export const dynamic = "force-dynamic";

const SECRET = process.env.REGISTER_SECRET ?? "";

/**
 * GET /api/metrics?event=ailg-r&date=YYYY-MM-DD (Bearer REGISTER_SECRET): the session's numbers for leadogo's
 * Funnel Performance, replacing what it used to fetch from EasyWebinar. Without `date`, the last 31 sessions
 * (`limit` up to 400).
 */
export async function GET(request: Request) {
  if (!SECRET || request.headers.get("authorization") !== `Bearer ${SECRET}`) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const q = new URL(request.url).searchParams;
  const event = await getEvent(q.get("event") ?? "ailg-r").catch(() => null);
  if (!event) return Response.json({ error: "Unknown event" }, { status: 404 });
  const date = q.get("date");
  const limit = Math.min(400, Math.max(1, Number(q.get("limit")) || 31));
  let query = db().from("session_metrics").select("*").eq("event_id", event.id).order("session_date", { ascending: false }).limit(limit);
  if (date) query = query.eq("session_date", date);
  const { data, error } = await query;
  if (error) return Response.json({ error: "Lookup failed" }, { status: 500 });
  const sessions = [];
  for (const row of data ?? []) {
    const att = await db().from("attendance").select("max_offset, joined_at, last_seen_at, registrant:registrants!inner(source)").eq("session_date", row.session_date).eq("kind", "live").eq("registrant.event_id", event.id);
    const real = (att.data ?? []).filter((a) => (a.registrant as unknown as { source: string }).source !== "test");
    const offsets = real.map((a) => a.max_offset as number);
    const peak_live = peakConcurrent(real.map((a) => ({ from: new Date(a.joined_at as string).getTime(), to: new Date(a.last_seen_at as string).getTime() })));
    // Opt-ins: people who registered themselves for this session (site or Zap), not imports, Skool links or guests.
    const opt = await db().from("registrants").select("id", { count: "exact", head: true }).eq("event_id", event.id).eq("session_date", row.session_date).in("source", ["site", "zapier"]);
    // Site opt-ins (the pages the ads send people to), and those whose attribution names an ad (Meta utm or fbclid).
    const site = await db().from("registrants").select("attribution").eq("event_id", event.id).eq("session_date", row.session_date).eq("source", "site").limit(5000);
    const siteRows = site.data ?? [];
    const ad_optins = siteRows.filter((r) => { const a = (r.attribution ?? {}) as Record<string, string>; return a.utm_source === "facebook_ads" || Boolean(a.fbclid); }).length;
    // In the room at the pitch instant (what the tracker calls Pitch Live), not "watched past the pitch".
    const session = sessionFor(scheduleOf(event), row.session_date);
    const pitchAt = session && event.cta_at_seconds !== null ? session.start.getTime() + event.cta_at_seconds * 1000 : null;
    const at_pitch = pitchAt === null ? null : real.filter((a) => new Date(a.joined_at as string).getTime() <= pitchAt && new Date(a.last_seen_at as string).getTime() + PRESENCE_GRACE_MS >= pitchAt).length;
    const nowMs = Date.now();
    const in_room = real.filter((a) => nowMs - new Date(a.last_seen_at as string).getTime() < 120_000).length;
    const site_joined = real.filter((a) => (a.registrant as unknown as { source: string }).source === "site").length;
    const booked = await db().from("bookings").select("id", { count: "exact", head: true }).eq("event_id", event.id).eq("session_date", row.session_date).eq("status", "scheduled");
    // One session asked for by date: Brandon's post also wants minutes to the pitch, the projection and the typical night.
    let extras = {};
    if (date && session) {
      const minuteNow = Math.max(0, Math.floor((nowMs - session.start.getTime()) / 60_000));
      const history = await loadHistory(event, row.session_date as string);
      const proj = at_pitch !== null && at_pitch > 0 ? projectBookings(history, session.start.getUTCDay(), at_pitch) : in_room > 0 ? projectBookings(history, session.start.getUTCDay(), in_room) : null;
      extras = { until_pitch_minutes: pitchAt !== null && pitchAt > nowMs ? Math.round((pitchAt - nowMs) / 60_000) : null, projected: proj, typical: typicalNight(history.map((h) => h.curve).filter((c): c is number[] => Array.isArray(c)), minuteNow), minute: minuteNow };
    }
    sessions.push({ ...row, optins: opt.count ?? 0, site_optins: siteRows.length, ad_optins, site_joined, in_room, at_pitch, peak_live, booked: booked.count ?? 0, retention: retentionCurve(offsets, event.video_seconds ?? 0), show_up_rate: row.registered ? row.joined / row.registered : 0, ...extras });
  }
  return Response.json({ event: event.slug, sessions }, { headers: { "cache-control": "no-store" } });
}
