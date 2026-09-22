import { db } from "@/lib/db";
import { getEvent } from "@/lib/events";
import { scheduleOf, sessionFor } from "@/lib/daily-schedule";

export const dynamic = "force-dynamic";

const SECRET = process.env.REGISTER_SECRET ?? "";

/**
 * GET /api/metrics/engagement?event=&date= (Bearer REGISTER_SECRET): everyone who joined that session, most engaged
 * first, with whether they booked, for the post-session report the setters work from (SPEC-phase5.md, bookings-loop).
 * Score: minutes 40%, reached the pitch 25%, messages 20%, clicked the offer 15%; clicked-but-not-booked pinned on top.
 */
export async function GET(request: Request) {
  if (!SECRET || request.headers.get("authorization") !== `Bearer ${SECRET}`) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const q = new URL(request.url).searchParams;
  const event = await getEvent(q.get("event") ?? "ailg-r").catch(() => null);
  if (!event) return Response.json({ error: "Unknown event" }, { status: 404 });
  const date = q.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return Response.json({ error: "date=YYYY-MM-DD required" }, { status: 400 });
  const session = sessionFor(scheduleOf(event), date);
  if (!session) return Response.json({ error: "No session that day" }, { status: 404 });
  const pitchAt = event.cta_at_seconds !== null ? session.start.getTime() + event.cta_at_seconds * 1000 : null;
  const pitchMin = event.cta_at_seconds !== null ? event.cta_at_seconds / 60 : 75;
  const att = await db().from("attendance").select("registrant_id, joined_at, last_seen_at, seconds_watched, cta_clicked_at, registrant:registrants!inner(first_name, email, phone, source, event_id)").eq("session_date", date).eq("kind", "live").eq("registrant.event_id", event.id).limit(2000);
  const rows = (att.data ?? []).filter((a) => (a.registrant as unknown as { source: string }).source !== "test");
  const ids = rows.map((a) => a.registrant_id as string);
  const msgs = new Map<string, number>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await db().from("chat_messages").select("registrant_id").eq("event_id", event.id).eq("session_date", date).eq("role", "attendee").is("deleted_at", null).in("registrant_id", ids.slice(i, i + 200)).limit(5000);
    for (const m of data ?? []) msgs.set(m.registrant_id as string, (msgs.get(m.registrant_id as string) ?? 0) + 1);
  }
  const booked = new Set<string>();
  const bk = await db().from("bookings").select("registrant_id, email, phone").eq("event_id", event.id).eq("session_date", date);
  const bookedEmails = new Set((bk.data ?? []).map((b) => (b.email ?? "").toLowerCase()).filter(Boolean));
  for (const b of bk.data ?? []) if (b.registrant_id) booked.add(b.registrant_id as string);
  const people = rows.map((a) => {
    const r = a.registrant as unknown as { first_name: string; email: string | null; phone: string | null; source: string };
    const minutes = Math.round(((a.seconds_watched as number) ?? 0) / 60);
    const at_pitch = pitchAt !== null && new Date(a.joined_at as string).getTime() <= pitchAt && new Date(a.last_seen_at as string).getTime() >= pitchAt;
    const messages = msgs.get(a.registrant_id as string) ?? 0;
    const clicked = Boolean(a.cta_clicked_at);
    const isBooked = booked.has(a.registrant_id as string) || (r.email ? bookedEmails.has(r.email.toLowerCase()) : false);
    const score = 0.4 * Math.min(1, minutes / pitchMin) + 0.25 * (at_pitch ? 1 : 0) + 0.2 * Math.min(1, messages / 5) + 0.15 * (clicked ? 1 : 0);
    return { registrant_id: a.registrant_id, name: r.first_name, email: r.email, phone: r.phone, source: r.source, minutes, messages, at_pitch, clicked_offer: clicked, booked: isBooked, score: Math.round(score * 100) / 100 };
  });
  people.sort((a, b) => Number(b.clicked_offer && !b.booked) - Number(a.clicked_offer && !a.booked) || b.score - a.score || b.minutes - a.minutes);
  const summary = { joined: people.length, chatters: people.filter((p) => p.messages > 0).length, avg_minutes: people.length ? Math.round(people.reduce((s, p) => s + p.minutes, 0) / people.length) : 0, stayed_15: people.filter((p) => p.minutes >= 15).length, at_pitch: people.filter((p) => p.at_pitch).length, clicked: people.filter((p) => p.clicked_offer).length, booked: people.filter((p) => p.booked).length };
  return Response.json({ event: event.slug, session_date: date, summary, people }, { headers: { "cache-control": "no-store" } });
}
