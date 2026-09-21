// What a moderator can do to a message, kept pure: the fixed reaction set and the counter update.
export const EMOJIS = ["❤️", "👍", "🔥", "😂", "👏"] as const;
export type Emoji = (typeof EMOJIS)[number];

export function isEmoji(s: string): s is Emoji {
  return (EMOJIS as readonly string[]).includes(s);
}

/** A new reactions map with `emoji` incremented, or null when the emoji is not in the set. */
export function applyReaction(reactions: Record<string, number> | null | undefined, emoji: string): Record<string, number> | null {
  if (!isEmoji(emoji)) return null;
  const out = { ...(reactions ?? {}) };
  out[emoji] = (out[emoji] ?? 0) + 1;
  return out;
}
