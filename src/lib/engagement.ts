// The engagement score (SPEC-phase6.md, Q7): minutes watched 35%, in the room at the pitch 25%, messages 15%, belief
// signals 10%, clicked the offer 15%, on a 0–1 scale; the leaderboard the desk shows and the ten the setters get after.

export type Engaged = { minutes: number; atPitch: boolean; messages: number; belief?: number; clicked: boolean; booked?: boolean };

export function engagementScore(p: Engaged, pitchMinutes: number): number {
  const pm = pitchMinutes > 0 ? pitchMinutes : 75;
  const s = 0.35 * Math.min(1, p.minutes / pm) + 0.25 * (p.atPitch ? 1 : 0) + 0.15 * Math.min(1, p.messages / 5) + 0.1 * Math.min(1, (p.belief ?? 0) / 2) + 0.15 * (p.clicked ? 1 : 0);
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

export const DEFAULT_BELIEF_PHRASES = ["makes sense", "wow", "value", "amazing", "so true", "crazy good", "that's great", "love this", "exactly", "100%", "this is it", "need this", "game changer", "🔥", "🙌", "👏"];

/** A message that agrees, admires or commits: any of the event's phrases, case-insensitive, straight or curly apostrophes. */
export function isBelief(body: string, phrases: string[] = DEFAULT_BELIEF_PHRASES): boolean {
  const b = body.toLowerCase().replace(/[’‘]/g, "'");
  return phrases.some((p) => p.trim() && b.includes(p.toLowerCase().replace(/[’‘]/g, "'")));
}

/** A question: a question mark, or an opening question word. */
export function isQuestion(body: string): boolean {
  const b = body.trim().toLowerCase();
  return b.includes("?") || /^(how|what|when|where|why|which|who|does|do|did|can|could|is|are|will|would|should|any|anyone)\b/.test(b);
}
