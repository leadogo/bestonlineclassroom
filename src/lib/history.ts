// What past sessions say about tonight (phase 6): the minute-by-minute crowd of the last sessions (the "typical night"
// line moderators and Brandon read), and the bookings projection by weekday. Pure parts here, tested; loading below.
import { db } from "./db.ts";
import { scheduleOf, sessionFor } from "./daily-schedule.ts";
import type { EventRow } from "./events.ts";
import { concurrentAt, PRESENCE_GRACE_MS } from "./outcomes.ts";

export type PastSession = { date: string; weekday: number; at_pitch: number; booked: number; curve?: number[] };

export type Typical = { peak_minute: number; peak: number; hold_end_minute: number; phase: "warming" | "peak" | "holding" | "cooling"; typical_now: number; sessions: number };

/** The average minute curve of `curves`, and where minute `now` sits on it. Null with no history. */
export function typicalNight(curves: number[][], now: number): Typical | null {
  const cs = curves.filter((c) => c.length > 0);
  if (cs.length === 0) return null;
  const len = Math.max(...cs.map((c) => c.length));
  const avg = Array.from({ length: len }, (_, m) => { const xs = cs.map((c) => c[m]).filter((v): v is number => typeof v === "number"); return xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : 0; });
  const peak = Math.max(...avg);
  const peak_minute = avg.indexOf(peak);
  let hold_end_minute = peak_minute;
  for (let m = peak_minute; m < avg.length; m++) if (avg[m] >= 0.75 * peak) hold_end_minute = m;
  const m = Math.max(0, Math.min(now, avg.length - 1));
  const cur = avg[m] ?? 0;
  const phase = cur >= 0.9 * peak ? "peak" : m < peak_minute ? "warming" : cur >= 0.75 * peak ? "holding" : "cooling";
  return { peak_minute, peak: Math.round(peak), hold_end_minute, phase, typical_now: Math.round(cur), sessions: cs.length };
}

/** Projected bookings: tonight's at-the-pitch × the book rate of past sessions, this weekday once it has four, else all. */
export function projectBookings(history: PastSession[], weekday: number, atPitch: number): { projected: number; rate: number; sessions: number; byWeekday: boolean } | null {
  const same = history.filter((h) => h.weekday === weekday && h.at_pitch > 0);
  const pool = same.length >= 4 ? same : history.filter((h) => h.at_pitch > 0);
  const sumPitch = pool.reduce((s, h) => s + h.at_pitch, 0);
  if (sumPitch === 0) return null;
  const rate = pool.reduce((s, h) => s + h.booked, 0) / sumPitch;
  return { projected: Math.round(atPitch * rate), rate, sessions: pool.length, byWeekday: same.length >= 4 };
}

/** The last `n` sessions before `before` (YYYY-MM-DD) with their pitch count, bookings and, for the first `curves`, the minute curve. */
export async function loadHistory(event: EventRow, before: string, n = 28, curves = 10): Promise<PastSession[]> {
  const schedule = scheduleOf(event);
  const { data } = await db().from("session_metrics").select("session_date").eq("event_id", event.id).lt("session_date", before).order("session_date", { ascending: false }).limit(n);
  const out: PastSession[] = [];
  const minutes = Math.ceil((event.video_seconds ?? 0) / 60);
  for (const row of data ?? []) {
    const s = sessionFor(schedule, row.session_date as string);
    if (!s || event.cta_at_seconds === null) continue;
    const pitchAt = s.start.getTime() + event.cta_at_seconds * 1000;
    if (pitchAt > Date.now()) continue;
    const att = await db().from("attendance").select("joined_at, last_seen_at, registrant:registrants!inner(source)").eq("session_date", s.date).eq("kind", "live").eq("registrant.event_id", event.id);
    const intervals = (att.data ?? []).filter((a) => (a.registrant as unknown as { source: string }).source !== "test").map((a) => ({ from: new Date(a.joined_at as string).getTime(), to: new Date(a.last_seen_at as string).getTime() }));
    const booked = await db().from("bookings").select("id", { count: "exact", head: true }).eq("event_id", event.id).eq("session_date", s.date).eq("status", "scheduled");
    out.push({ date: s.date, weekday: s.start.getUTCDay(), at_pitch: concurrentAt(intervals, pitchAt, PRESENCE_GRACE_MS), booked: booked.count ?? 0, curve: out.length < curves && minutes > 0 ? Array.from({ length: minutes + 1 }, (_, m) => concurrentAt(intervals, s.start.getTime() + m * 60_000)) : undefined });
  }
  return out;
}
