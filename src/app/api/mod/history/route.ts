import { canModerate, getTeamMember } from "@/lib/auth";
import { scheduleOf, sessionFor } from "@/lib/daily-schedule";
import { db } from "@/lib/db";
import { getEvent } from "@/lib/events";
import { concurrentAt, PRESENCE_GRACE_MS } from "@/lib/outcomes";

export const dynamic = "force-dynamic";

/** GET ?event=: the last 28 sessions' at-the-pitch count and bookings, so the desk can project tonight's bookings by weekday. */
export async function GET(request: Request) {
  const member = await getTeamMember().catch(() => null);
  if (!member) return Response.json({ error: "Sign in" }, { status: 401 });
  const q = new URL(request.url).searchParams;
  const event = await getEvent(q.get("event") ?? "ailg-r").catch(() => null);
  if (!event) return Response.json({ error: "Unknown event" }, { status: 404 });
  if (!(await canModerate(member, event.id))) return Response.json({ error: "Not your webinar" }, { status: 403 });
  const schedule = scheduleOf(event);
  const today = q.get("today") ?? "";
  const { data } = await db().from("session_metrics").select("session_date").eq("event_id", event.id).lt("session_date", today || "9999-12-31").order("session_date", { ascending: false }).limit(28);
  const sessions: Array<{ date: string; weekday: number; at_pitch: number; booked: number; curve?: number[] }> = [];
  for (const row of data ?? []) {
    const s = sessionFor(schedule, row.session_date as string);
    if (!s || event.cta_at_seconds === null) continue;
    const pitchAt = s.start.getTime() + event.cta_at_seconds * 1000;
    if (pitchAt > Date.now()) continue;
    const att = await db().from("attendance").select("joined_at, last_seen_at, registrant:registrants!inner(source)").eq("session_date", s.date).eq("kind", "live").eq("registrant.event_id", event.id);
    const intervals = (att.data ?? []).filter((a) => (a.registrant as unknown as { source: string }).source !== "test").map((a) => ({ from: new Date(a.joined_at as string).getTime(), to: new Date(a.last_seen_at as string).getTime() }));
    const at_pitch = concurrentAt(intervals, pitchAt, PRESENCE_GRACE_MS);
    // The minute-by-minute curve for the last ten sessions: the desk's "typical night" line.
    const minutes = Math.ceil((event.video_seconds ?? 0) / 60);
    const curve = sessions.length < 10 && minutes > 0 ? Array.from({ length: minutes + 1 }, (_, m) => concurrentAt(intervals, s.start.getTime() + m * 60_000)) : undefined;
    const booked = await db().from("bookings").select("id", { count: "exact", head: true }).eq("event_id", event.id).eq("session_date", s.date);
    sessions.push({ date: s.date, weekday: s.start.getUTCDay(), at_pitch, booked: booked.count ?? 0, curve });
  }
  return Response.json({ sessions }, { headers: { "cache-control": "no-store" } });
}
