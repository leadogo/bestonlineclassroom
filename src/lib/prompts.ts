// Katherine's timed lines and the per-viewer "book now" row (phase 6.4). The heartbeat calls this on the room's clock;
// a prompt posts once per session (prompt_posts) and only while the event's Katherine switch is on.
import { db } from "./db.ts";
import { KATHERINE } from "./katherine.ts";

type PromptEvent = { id: string; katherine_enabled: boolean; prompts: Array<{ minute: number; text: string }> | null; cta_prompt_minutes: number[] | null; cta_at_seconds: number | null; cta_label: string | null; cta_href: string | null };

const lastCheck = new Map<string, number>();

/** Posts every prompt whose minute has come and has not been posted for this session. Cheap: one read per event every 10 s at most. */
export async function postDuePrompts(event: PromptEvent, sessionDate: string, offsetSeconds: number): Promise<number> {
  if (!event.katherine_enabled) return 0;
  const key = `${event.id}:${sessionDate}`;
  const now = Date.now();
  if ((lastCheck.get(key) ?? 0) > now - 10_000) return 0;
  lastCheck.set(key, now);
  const minute = Math.floor(offsetSeconds / 60);
  const due: Array<{ minute: number; kind: "text" | "cta"; text: string }> = [];
  for (const p of event.prompts ?? []) if (typeof p?.minute === "number" && p.minute <= minute && p.minute >= minute - 3 && p.text) due.push({ minute: p.minute, kind: "text", text: String(p.text).slice(0, 500) });
  if (event.cta_at_seconds !== null && event.cta_href) {
    const pitch = Math.floor(event.cta_at_seconds / 60);
    for (const m of event.cta_prompt_minutes ?? [0, 3, 8, 15]) { const at = pitch + m; if (at <= minute && at >= minute - 3) due.push({ minute: at, kind: "cta", text: m === 0 ? "This is the part where people book their call. The button below is yours, with your details already filled in." : "Still deciding? Your booking button is below, your name and number already on it." }); }
  }
  let posted = 0;
  for (const d of due) {
    const { error } = await db().from("prompt_posts").insert({ event_id: event.id, session_date: sessionDate, minute: d.minute, kind: d.kind });
    if (error) continue; // already posted (primary key), or a race the other request won
    const ins = await db().from("chat_messages").insert({ event_id: event.id, session_date: sessionDate, team_member_id: null, author_name: KATHERINE, role: "moderator", body: d.text, offset_seconds: d.minute * 60, mentions: [], mention_names: [], kind: d.kind });
    if (!ins.error) posted += 1;
  }
  return posted;
}
