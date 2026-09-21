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
