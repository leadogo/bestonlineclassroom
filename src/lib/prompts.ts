// Katherine's timed lines and the per-viewer "book now" row (phase 6.4), and Kaitlyn's one timed line, the link at the
// pitch minute (Kevin posted it by hand at minute 75 on 46 nights). The heartbeat calls this on the room's clock; a
// prompt posts once per session (prompt_posts) and only while its switch is on.
import { KAITLYN } from "./chat.ts";
import { db } from "./db.ts";
import { KATHERINE } from "./katherine.ts";
import { withQuery } from "./params.ts";

type PromptEvent = { id: string; katherine_enabled: boolean; prompts: Array<{ minute: number; text: string }> | null; cta_prompt_minutes: number[] | null; cta_at_seconds: number | null; cta_label: string | null; cta_href: string | null; kaitlyn_mode?: string | null };

const lastCheck = new Map<string, number>();

/** Kaitlyn's line at the pitch: the booking link with src=chat, or null when the event has no link. */
export function kaitlynLinkLine(href: string | null): string | null {
  if (!href) return null;
  try {
    return `Here's the link William's talking about 🙌 ${withQuery(href, { src: "chat" })}`;
  } catch {
    return null;
  }
}

/** Posts every prompt whose minute has come and has not been posted for this session. Cheap: one read per event every 10 s at most. */
export async function postDuePrompts(event: PromptEvent, sessionDate: string, offsetSeconds: number): Promise<number> {
  const kaitlyn = Boolean(event.kaitlyn_mode && event.kaitlyn_mode !== "off");
  if (!event.katherine_enabled && !kaitlyn) return 0;
  const key = `${event.id}:${sessionDate}`;
  const now = Date.now();
  if ((lastCheck.get(key) ?? 0) > now - 10_000) return 0;
  lastCheck.set(key, now);
  const minute = Math.floor(offsetSeconds / 60);
  const due: Array<{ minute: number; kind: "text" | "cta" | "kaitlyn"; text: string; author: string }> = [];
  const pitch = event.cta_at_seconds !== null ? Math.floor(event.cta_at_seconds / 60) : null;
  if (event.katherine_enabled) {
    for (const p of event.prompts ?? []) if (typeof p?.minute === "number" && p.minute <= minute && p.minute >= minute - 3 && p.text) due.push({ minute: p.minute, kind: "text", text: String(p.text).slice(0, 500), author: KATHERINE });
    if (pitch !== null && event.cta_href) {
      for (const m of event.cta_prompt_minutes ?? [0, 3, 8, 15]) { const at = pitch + m; if (at <= minute && at >= minute - 3) due.push({ minute: at, kind: "cta", text: m === 0 ? "This is the part where people book their call. The button below is yours, with your details already filled in." : "Still deciding? Your booking button is below, your name and number already on it.", author: KATHERINE }); }
    }
  }
  const link = kaitlyn ? kaitlynLinkLine(event.cta_href) : null;
  if (link && pitch !== null && pitch <= minute && pitch >= minute - 3) due.push({ minute: pitch, kind: "kaitlyn", text: link, author: KAITLYN });
  let posted = 0;
  for (const d of due) {
    const { error } = await db().from("prompt_posts").insert({ event_id: event.id, session_date: sessionDate, minute: d.minute, kind: d.kind });
    if (error) continue; // already posted (primary key), or a race the other request won
    const ins = await db().from("chat_messages").insert({ event_id: event.id, session_date: sessionDate, team_member_id: null, author_name: d.author, role: "moderator", body: d.text, offset_seconds: d.minute * 60, mentions: [], mention_names: [], kind: d.kind });
    if (!ins.error) posted += 1;
  }
  return posted;
}
