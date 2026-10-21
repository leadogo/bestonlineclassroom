// Moving a registrant into the running session when the render did not (SPEC-link-opens.md, B): a scanner-looking open
// (a Linux-desktop agent) whose person then posts a line or clicks the offer. The room's date for such a row, the move
// itself, and the site's room_join report (what /j does at render) live here so chat, the offer click and the join page
// share one rule.
import { roomState, type Schedule } from "./daily-schedule.ts";
import { db } from "./db.ts";

export type Movable = { id: string; session_date: string; token: string; site_registration_id: string | null; room_join_reported_at: string | null; source: string | null };

/** The date the room shows for a row: the running session when it is live and the row's own session is over (the render's rejoin rule); `behind` says the row still sits on its old date. A row whose own session has not ended (tonight's, a future date, a preview of one) is never behind. */
export function roomDateFor(schedule: Schedule, rowDate: string, now = new Date()): { date: string; behind: boolean } {
  const running = roomState(schedule, now);
  const own = roomState(schedule, now, rowDate);
  const behind = running.state === "live" && own.state === "ended" && running.session.date !== rowDate;
  return { date: behind ? running.session.date : rowDate, behind };
}

/** Moves the row to `toDate` and stamps `moved_in_at`. False, logged, and nothing else when another row of theirs already holds that date (one email per session) or the update fails. The room_join report is the caller's, in `after()`. */
export async function moveIn(r: Movable, toDate: string): Promise<boolean> {
  if (r.session_date === toDate) return false;
  const moved = await db().from("registrants").update({ session_date: toDate, moved_in_at: new Date().toISOString() }).eq("id", r.id).eq("session_date", r.session_date).select("id");
  if (moved.error) { console.error("[move-in] failed", { code: moved.error.code }); return false; }
  if (!moved.data?.length) { console.error("[move-in] blocked", { id: r.id, from: r.session_date, to: toDate }); return false; }
  r.session_date = toDate;
  return true;
}

/** The site's /join records room_join for leadogo, the ritual sheet and Slack; once per registrant. ponytail: replace with a direct leadogo event when analytics N2 lands. */
export async function reportRoomJoin(r: Movable, date: string): Promise<void> {
  if (!r.site_registration_id || r.room_join_reported_at) return;
  const q = new URLSearchParams({ k: r.token, rid: r.site_registration_id, sd: date, ...(r.source === "test" ? { t: "1" } : {}) });
  await fetch(`https://thefuturerealestateagent.com/join?${q}`, { redirect: "manual", signal: AbortSignal.timeout(5000) }).catch(() => {});
  r.room_join_reported_at = new Date().toISOString();
  await db().from("registrants").update({ room_join_reported_at: r.room_join_reported_at }).eq("id", r.id);
}
