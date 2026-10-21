import { nextAttendance, type AttendanceRow } from "@/lib/attendance";
import { db } from "@/lib/db";
import { clientIp } from "@/lib/ip";
import { cleanParams } from "@/lib/params";
import { TOKEN_RE } from "@/lib/registrants";
import { postDuePrompts } from "@/lib/prompts";
import { asAutopilot, asMode, sweepHandoffs } from "@/lib/kaitlyn";
import { backstopMove } from "@/lib/outcomes";
import { roomState, scheduleOf } from "@/lib/daily-schedule";
import { after } from "next/server";

export const dynamic = "force-dynamic";

/** POST { token, offset, params?, kind? }: on open, every 30 s, and on pagehide. One attendance row per registrant per session per kind (live | replay). */
export async function POST(request: Request) {
  let b: { token?: string; offset?: number; params?: Record<string, string>; kind?: string };
  try {
    b = (await request.json()) as typeof b;
  } catch {
    return new Response(null, { status: 400 });
  }
  const token = String(b.token ?? "");
  if (!TOKEN_RE.test(token)) return new Response(null, { status: 400 });
  const offset = typeof b.offset === "number" && Number.isFinite(b.offset) ? b.offset : 0;
  const kind = b.kind === "replay" ? "replay" : "live";

  const reg = await db().from("registrants").select("id, event_id, session_date, ip, blocked_at, email, ghosted_at, auto_ghost_reason, token, site_registration_id, room_join_reported_at, source, event:events(id, timezone, start_time, video_seconds, days, katherine_enabled, prompts, cta_prompt_minutes, cta_at_seconds, cta_label, cta_href, kaitlyn_mode, autopilot)").eq("token", token).maybeSingle();
  if (reg.error || !reg.data) return new Response(null, { status: 404 });
  if (reg.data.blocked_at) return new Response(null, { status: 403 });
  const { id, session_date } = reg.data;
  // A row the render did not move (a scanner-looking open; SPEC-link-opens.md, A and B) beats under the running session's date on its own row, so an older session's row is never touched; at the two-minute beat the person is moved in (below).
  const sched = reg.data.event as unknown as { timezone: string; start_time: string; video_seconds: number | null; days: number[] | null } | null;
  const running = kind === "live" && sched ? roomState(scheduleOf(sched), new Date()) : null;
  const behind = Boolean(running && running.state === "live" && running.session.date !== session_date);
  const effDate = behind && running ? running.session.date : session_date;
  if (!reg.data.ip) {
    const ip = clientIp(request.headers);
    if (ip) await db().from("registrants").update({ ip, ip_seen_at: new Date().toISOString() }).eq("id", id).is("ip", null);
  }

  const prev = await db().from("attendance").select("seconds_watched, max_offset, last_seen_at, params, minutes_seen, cta_clicked_at").eq("registrant_id", id).eq("session_date", effDate).eq("kind", kind).maybeSingle();
  const next = nextAttendance((prev.data as AttendanceRow | null) ?? null, new Date(), offset);
  const params = prev.data?.params && Object.keys(prev.data.params).length ? prev.data.params : cleanParams(b.params ?? {});
  // Which minutes of the recording they actually saw (phase 6.3: testimonials watched, consumption for PAR).
  const seen = new Set<number>((prev.data?.minutes_seen as number[] | null) ?? []);
  seen.add(Math.max(0, Math.floor(offset / 60)));
  const minutes_seen = [...seen].sort((a, b) => a - b).slice(-400);
  const { error } = await db().from("attendance").upsert({ registrant_id: id, session_date: effDate, kind, ...next, params, minutes_seen }, { onConflict: "registrant_id,session_date,kind" });
  if (error) {
    console.error("[heartbeat] upsert failed", { code: error.code });
    return new Response(null, { status: 500 });
  }
  const ev = reg.data.event as unknown as { id: string; timezone: string; start_time: string; video_seconds: number | null; days: number[] | null; katherine_enabled: boolean; prompts: Array<{ minute: number; text: string }> | null; cta_prompt_minutes: number[] | null; cta_at_seconds: number | null; cta_label: string | null; cta_href: string | null; kaitlyn_mode?: string | null; autopilot?: string | null } | null;
  if (kind === "live" && ev) {
    // Katherine's timed lines and the book-now rows ride on the room's clock; once per session each.
    after(() => postDuePrompts(ev, effDate, offset));
    // Her hand-off line for any card the desk left for 90 s (SPEC-kaitlyn-ghosts.md, A3) and the sure replies the desk passed on (SPEC-kaitlyn-solo.md, B); nothing to do when Kaitlyn is off.
    if (ev.kaitlyn_mode && ev.kaitlyn_mode !== "off") after(() => sweepHandoffs(ev.id, effDate, asAutopilot(ev.autopilot), offset, asMode(ev.kaitlyn_mode)));
    // The backstop move (SPEC-link-opens.md, B): once this row's own beats tonight make a person, the registrant becomes tonight's, and the site hears the room_join the render skipped. A move that loses to another row of theirs (the unique email per session) is left alone.
    if (behind && backstopMove(session_date, { state: running!.state, date: running!.session.date }, { seconds_watched: next.seconds_watched, cta_clicked_at: (prev.data?.cta_clicked_at as string | null) ?? null })) {
      const me = reg.data as unknown as { token: string; site_registration_id: string | null; room_join_reported_at: string | null; source: string | null };
      after(async () => {
        const moved = await db().from("registrants").update({ session_date: effDate, moved_in_at: new Date().toISOString() }).eq("id", id).eq("session_date", session_date).select("id");
        if (!moved.data?.length) return;
        if (me.site_registration_id && !me.room_join_reported_at) {
          const q = new URLSearchParams({ k: me.token, rid: me.site_registration_id, sd: effDate, ...(me.source === "test" ? { t: "1" } : {}) });
          await fetch(`https://thefuturerealestateagent.com/join?${q}`, { redirect: "manual", signal: AbortSignal.timeout(5000) }).catch(() => {});
          await db().from("registrants").update({ room_join_reported_at: new Date().toISOString() }).eq("id", id);
        }
      });
    }
    // A seat's first heartbeat: who have we seen before under this email? Ghosted or blocked before, or a third night: ghost quietly (they still see their own rows).
    if (!prev.data && reg.data.email && !reg.data.ghosted_at) {
      const email = reg.data.email as string;
      const eventId = reg.data.event_id as string;
      after(async () => {
        const { data: others } = await db().from("registrants").select("id, ghosted_at, blocked_at, session_date").eq("event_id", eventId).eq("email", email).neq("id", id);
        const ids = (others ?? []).map((o) => o.id as string);
        let prior = 0;
        if (ids.length) { const { data: a } = await db().from("attendance").select("session_date").in("registrant_id", ids).eq("kind", "live").lt("session_date", effDate); prior = new Set((a ?? []).map((x) => x.session_date as string)).size; }
        const badBefore = (others ?? []).some((o) => o.ghosted_at || o.blocked_at);
        const reason = badBefore ? "ghosted or blocked before" : prior >= 2 ? `third night (${prior} before)` : null;
        await db().from("registrants").update({ prior_sessions: prior, ...(reason ? { ghosted_at: new Date().toISOString(), auto_ghost_reason: reason } : {}) }).eq("id", id);
      });
    }
  }
  return new Response(null, { status: 204 });
}
