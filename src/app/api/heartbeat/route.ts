import { nextAttendance, type AttendanceRow } from "@/lib/attendance";
import { db } from "@/lib/db";
import { clientIp } from "@/lib/ip";
import { cleanParams } from "@/lib/params";
import { TOKEN_RE } from "@/lib/registrants";
import { postDuePrompts } from "@/lib/prompts";
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

  const reg = await db().from("registrants").select("id, event_id, session_date, ip, blocked_at, email, ghosted_at, auto_ghost_reason, event:events(id, katherine_enabled, prompts, cta_prompt_minutes, cta_at_seconds, cta_label, cta_href)").eq("token", token).maybeSingle();
  if (reg.error || !reg.data) return new Response(null, { status: 404 });
  if (reg.data.blocked_at) return new Response(null, { status: 403 });
  const { id, session_date } = reg.data;
  if (!reg.data.ip) {
    const ip = clientIp(request.headers);
    if (ip) await db().from("registrants").update({ ip, ip_seen_at: new Date().toISOString() }).eq("id", id).is("ip", null);
  }

  const prev = await db().from("attendance").select("seconds_watched, max_offset, last_seen_at, params, minutes_seen").eq("registrant_id", id).eq("session_date", session_date).eq("kind", kind).maybeSingle();
  const next = nextAttendance((prev.data as AttendanceRow | null) ?? null, new Date(), offset);
  const params = prev.data?.params && Object.keys(prev.data.params).length ? prev.data.params : cleanParams(b.params ?? {});
  // Which minutes of the recording they actually saw (phase 6.3: testimonials watched, consumption for PAR).
  const seen = new Set<number>((prev.data?.minutes_seen as number[] | null) ?? []);
  seen.add(Math.max(0, Math.floor(offset / 60)));
  const minutes_seen = [...seen].sort((a, b) => a - b).slice(-400);
  const { error } = await db().from("attendance").upsert({ registrant_id: id, session_date, kind, ...next, params, minutes_seen }, { onConflict: "registrant_id,session_date,kind" });
  if (error) {
    console.error("[heartbeat] upsert failed", { code: error.code });
    return new Response(null, { status: 500 });
  }
  const ev = reg.data.event as unknown as { id: string; katherine_enabled: boolean; prompts: Array<{ minute: number; text: string }> | null; cta_prompt_minutes: number[] | null; cta_at_seconds: number | null; cta_label: string | null; cta_href: string | null } | null;
  if (kind === "live" && ev) {
    // Katherine's timed lines and the book-now rows ride on the room's clock; once per session each.
    after(() => postDuePrompts(ev, session_date, offset));
    // A seat's first heartbeat: who have we seen before under this email? Ghosted or blocked before, or a third night: ghost quietly (they still see their own rows).
    if (!prev.data && reg.data.email && !reg.data.ghosted_at) {
      const email = reg.data.email as string;
      const eventId = reg.data.event_id as string;
      after(async () => {
        const { data: others } = await db().from("registrants").select("id, ghosted_at, blocked_at, session_date").eq("event_id", eventId).eq("email", email).neq("id", id);
        const ids = (others ?? []).map((o) => o.id as string);
        let prior = 0;
        if (ids.length) { const { data: a } = await db().from("attendance").select("session_date").in("registrant_id", ids).eq("kind", "live").lt("session_date", session_date); prior = new Set((a ?? []).map((x) => x.session_date as string)).size; }
        const badBefore = (others ?? []).some((o) => o.ghosted_at || o.blocked_at);
        const reason = badBefore ? "ghosted or blocked before" : prior >= 2 ? `third night (${prior} before)` : null;
        await db().from("registrants").update({ prior_sessions: prior, ...(reason ? { ghosted_at: new Date().toISOString(), auto_ghost_reason: reason } : {}) }).eq("id", id);
      });
    }
  }
  return new Response(null, { status: 204 });
}
