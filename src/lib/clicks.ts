// A row per link open (SPEC-analytics.md): which link, who, and what they got. `ended` and `replay_expired` are
// the ones to watch: a person clicked and could not see the session. Best-effort, never blocks the page.
import { db } from "./db.ts";

export type ClickOutcome = "live" | "countdown" | "ended" | "replay" | "replay_expired" | "invalid" | "prompt" | "scan";

export async function logClick(input: { path: "j" | "w" | "replay" | "qr"; outcome: ClickOutcome; token?: string | null; registrantId?: string | null; eventId?: string | null; sessionDate?: string | null; src?: string | null; userAgent?: string | null }): Promise<void> {
  try {
    await db().from("link_clicks").insert({
      path: input.path,
      outcome: input.outcome,
      token: input.token ?? null,
      registrant_id: input.registrantId ?? null,
      event_id: input.eventId ?? null,
      session_date: input.sessionDate ?? null,
      src: input.src?.slice(0, 40) ?? null,
      user_agent: input.userAgent?.slice(0, 300) ?? null,
    });
  } catch (err) {
    console.error("[clicks] insert failed", { err: String(err) });
  }
}
