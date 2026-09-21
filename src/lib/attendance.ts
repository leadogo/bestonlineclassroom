// Heartbeat accounting, pure: a beat every 30 s adds at most 30 s of watching (a laptop that slept for an hour
// does not get credited an hour), and the furthest offset seen is kept.

export const BEAT_SECONDS = 30;

export type AttendanceRow = { seconds_watched: number; max_offset: number; last_seen_at: string };

export function nextAttendance(prev: AttendanceRow | null, now: Date, offset: number): { seconds_watched: number; max_offset: number; last_seen_at: string } {
  const off = Math.max(0, Math.floor(offset));
  if (!prev) return { seconds_watched: 0, max_offset: off, last_seen_at: now.toISOString() };
  const delta = (now.getTime() - new Date(prev.last_seen_at).getTime()) / 1000;
  const credit = Math.max(0, Math.min(BEAT_SECONDS, Math.round(delta)));
  return { seconds_watched: prev.seconds_watched + credit, max_offset: Math.max(prev.max_offset, off), last_seen_at: now.toISOString() };
}
