// Katherine AI (SPEC-phase5.md, crowd-realism): a named moderator who answers one question, "is there a replay",
// once per person per session, a few seconds after they ask, only when the event's switch is on.
import { db } from "./db.ts";

export const KATHERINE = "Katherine AI";
export const KATHERINE_REPLY = "A replay will be sent tonight after the event!";
const ASKS = /\b(replay|recording|recorded|record(ing)? this|re-?watch|watch (it |this )?later|catch (it |this )?later)\b/i;

export function asksForReplay(body: string): boolean {
  return ASKS.test(body);
}

export async function katherineReply(reg: { id: string; event_id: string; session_date: string; first_name: string }, body: string, offset: number): Promise<boolean> {
  if (!asksForReplay(body)) return false;
  const prior = await db().from("chat_messages").select("id").eq("event_id", reg.event_id).eq("session_date", reg.session_date).eq("author_name", KATHERINE).contains("mentions", [reg.id]).limit(1);
  if (prior.data?.length) return false;
  await new Promise((r) => setTimeout(r, 4000 + Math.floor(Math.random() * 6000)));
  const { error } = await db().from("chat_messages").insert({ event_id: reg.event_id, session_date: reg.session_date, team_member_id: null, author_name: KATHERINE, role: "moderator", body: `@${reg.first_name} ${KATHERINE_REPLY}`, offset_seconds: offset + 6, mentions: [reg.id], mention_names: [reg.first_name] });
  if (error) console.error("[katherine] reply failed", { code: error.code });
  return !error;
}
