// Reactions, kept pure: the fixed set and how per-person rows become the counts shown on a message.
export const EMOJIS = ["❤️", "👍", "🔥", "😂", "👏"] as const;
export type Emoji = (typeof EMOJIS)[number];

export function isEmoji(s: string): s is Emoji {
  return (EMOJIS as readonly string[]).includes(s);
}

/** Counts per emoji from one row per person per emoji; unknown emojis are ignored. */
export function countReactions(rows: Array<{ emoji: string }>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) if (isEmoji(r.emoji)) out[r.emoji] = (out[r.emoji] ?? 0) + 1;
  return out;
}

/** Why the desk ghosted someone (SPEC-kaitlyn-ghosts.md, B4): one tap on the Ghost button. It rides into the kaitlyn_ghosts view she learns from and into the morning digest. */
export const GHOST_REASONS = ["live test", "price", "nag", "sneer", "client", "not a prospect"] as const;

/** The stored reason for a by-hand ghost: "by hand: <chip>" for a known chip, a plain "by hand" otherwise (the view reads the chip after the colon). */
export function ghostReason(v: unknown): string {
  return (GHOST_REASONS as readonly string[]).includes(String(v)) ? `by hand: ${String(v)}` : "by hand";
}
