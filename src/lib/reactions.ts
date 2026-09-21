// One reaction per person per emoji per message, Slack-style: tap to add, tap again to remove. The message's
// `reactions` counts are recomputed on every change so the polls keep shipping one number per emoji.
import { db } from "./db.ts";
import { countReactions, isEmoji } from "./moderation.ts";

export async function toggleReaction(messageId: number, who: string, emoji: string): Promise<{ reactions: Record<string, number>; on: boolean } | null> {
  if (!isEmoji(emoji)) return null;
  const existing = await db().from("message_reactions").select("emoji").eq("message_id", messageId).eq("who", who).eq("emoji", emoji).maybeSingle();
  const on = !existing.data;
  if (on) await db().from("message_reactions").insert({ message_id: messageId, who, emoji });
  else await db().from("message_reactions").delete().eq("message_id", messageId).eq("who", who).eq("emoji", emoji);
  const all = await db().from("message_reactions").select("emoji").eq("message_id", messageId);
  const reactions = countReactions(all.data ?? []);
  await db().from("chat_messages").update({ reactions, updated_at: new Date().toISOString() }).eq("id", messageId);
  return { reactions, on };
}

/** Which emojis `who` has on these messages. */
export async function mine(who: string, ids: number[]): Promise<Array<{ id: number; emoji: string }>> {
  if (!ids.length) return [];
  const { data } = await db().from("message_reactions").select("message_id, emoji").eq("who", who).in("message_id", ids);
  return (data ?? []).map((r) => ({ id: r.message_id as number, emoji: r.emoji as string }));
}
