// The engagement score (SPEC-phase5.md, Q9b): minutes watched 40%, in the room at the pitch 25%, messages 20%,
// clicked the offer 15%, on a 0–1 scale; the leaderboard the desk shows and the ten the setters get after.

export type Engaged = { minutes: number; atPitch: boolean; messages: number; clicked: boolean; booked?: boolean };

export function engagementScore(p: Engaged, pitchMinutes: number): number {
  const pm = pitchMinutes > 0 ? pitchMinutes : 75;
  const s = 0.4 * Math.min(1, p.minutes / pm) + 0.25 * (p.atPitch ? 1 : 0) + 0.2 * Math.min(1, p.messages / 5) + 0.15 * (p.clicked ? 1 : 0);
  return Math.round(s * 100) / 100;
}

/** Best first: clicked-but-not-booked who actually watched (5 min or more) on top, then score, then minutes. */
export function rankEngagement<T extends Engaged>(list: T[], pitchMinutes: number): Array<T & { score: number; rank: number }> {
  const hot = (p: Engaged) => Number(p.clicked && !p.booked && p.minutes >= 5);
  return list
    .map((p) => ({ ...p, score: engagementScore(p, pitchMinutes) }))
    .sort((a, b) => hot(b) - hot(a) || b.score - a.score || b.minutes - a.minutes)
    .map((p, i) => ({ ...p, rank: i + 1 }));
}
