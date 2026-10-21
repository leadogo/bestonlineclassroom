// Moving a registrant into the running session when the render did not (SPEC-link-opens.md, B): a scanner-looking open
// (a Linux-desktop agent) whose person then posts a line or clicks the offer. Reports the site's room_join once, as /j
// does. False, and nothing else, when another row of theirs already holds tonight (one email per session).
import { db } from "./db.ts";

export type Movable = { id: string; session_date: string; token: string; site_registration_id: string | null; room_join_reported_at: string | null; source: string | null };

export async function moveIn(r: Movable, toDate: string): Promise<boolean> {
  if (r.session_date === toDate) return false;
  const moved = await db().from("registrants").update({ session_date: toDate, moved_in_at: new Date().toISOString() }).eq("id", r.id).eq("session_date", r.session_date).select("id");
  if (moved.error) { console.error("[move-in] failed", { code: moved.error.code }); return false; }
  if (!moved.data?.length) return false;
  r.session_date = toDate;
  if (r.site_registration_id && !r.room_join_reported_at) {
    const q = new URLSearchParams({ k: r.token, rid: r.site_registration_id, sd: toDate, ...(r.source === "test" ? { t: "1" } : {}) });
    await fetch(`https://thefuturerealestateagent.com/join?${q}`, { redirect: "manual", signal: AbortSignal.timeout(5000) }).catch(() => {});
    r.room_join_reported_at = new Date().toISOString();
    await db().from("registrants").update({ room_join_reported_at: r.room_join_reported_at }).eq("id", r.id);
  }
  return true;
}
