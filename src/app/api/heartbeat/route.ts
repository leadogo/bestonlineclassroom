import { nextAttendance, type AttendanceRow } from "@/lib/attendance";
import { db } from "@/lib/db";
import { cleanParams } from "@/lib/params";
import { TOKEN_RE } from "@/lib/registrants";

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

  const reg = await db().from("registrants").select("id, session_date").eq("token", token).maybeSingle();
  if (reg.error || !reg.data) return new Response(null, { status: 404 });
  const { id, session_date } = reg.data;

  const prev = await db().from("attendance").select("seconds_watched, max_offset, last_seen_at, params").eq("registrant_id", id).eq("session_date", session_date).eq("kind", kind).maybeSingle();
  const next = nextAttendance((prev.data as AttendanceRow | null) ?? null, new Date(), offset);
  const params = prev.data?.params && Object.keys(prev.data.params).length ? prev.data.params : cleanParams(b.params ?? {});
  const { error } = await db().from("attendance").upsert({ registrant_id: id, session_date, kind, ...next, params }, { onConflict: "registrant_id,session_date,kind" });
  if (error) {
    console.error("[heartbeat] upsert failed", { code: error.code });
    return new Response(null, { status: 500 });
  }
  return new Response(null, { status: 204 });
}
