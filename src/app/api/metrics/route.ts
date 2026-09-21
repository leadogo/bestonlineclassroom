import { db } from "@/lib/db";
import { getEvent } from "@/lib/events";
import { peakConcurrent, retentionCurve } from "@/lib/outcomes";

export const dynamic = "force-dynamic";

const SECRET = process.env.REGISTER_SECRET ?? "";

/**
 * GET /api/metrics?event=ailg-r&date=YYYY-MM-DD (Bearer REGISTER_SECRET): the session's numbers for leadogo's
 * Funnel Performance, replacing what it used to fetch from EasyWebinar. Without `date`, the last 31 sessions
 * (`limit` up to 400).
 */
export async function GET(request: Request) {
  if (!SECRET || request.headers.get("authorization") !== `Bearer ${SECRET}`) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const q = new URL(request.url).searchParams;
  const event = await getEvent(q.get("event") ?? "ailg-r").catch(() => null);
  if (!event) return Response.json({ error: "Unknown event" }, { status: 404 });
  const date = q.get("date");
  const limit = Math.min(400, Math.max(1, Number(q.get("limit")) || 31));
  let query = db().from("session_metrics").select("*").eq("event_id", event.id).order("session_date", { ascending: false }).limit(limit);
  if (date) query = query.eq("session_date", date);
  const { data, error } = await query;
  if (error) return Response.json({ error: "Lookup failed" }, { status: 500 });
  const sessions = [];
  for (const row of data ?? []) {
    const att = await db().from("attendance").select("max_offset, joined_at, last_seen_at, registrant:registrants!inner(source)").eq("session_date", row.session_date).eq("kind", "live").eq("registrant.event_id", event.id);
    const real = (att.data ?? []).filter((a) => (a.registrant as unknown as { source: string }).source !== "test");
    const offsets = real.map((a) => a.max_offset as number);
    const peak_live = peakConcurrent(real.map((a) => ({ from: new Date(a.joined_at as string).getTime(), to: new Date(a.last_seen_at as string).getTime() })));
    // Opt-ins: people who registered themselves for this session (site or Zap), not imports, Skool links or guests.
    const opt = await db().from("registrants").select("id", { count: "exact", head: true }).eq("event_id", event.id).eq("session_date", row.session_date).in("source", ["site", "zapier"]);
    sessions.push({ ...row, optins: opt.count ?? 0, peak_live, retention: retentionCurve(offsets, event.video_seconds ?? 0), show_up_rate: row.registered ? row.joined / row.registered : 0 });
  }
  return Response.json({ event: event.slug, sessions }, { headers: { "cache-control": "no-store" } });
}
