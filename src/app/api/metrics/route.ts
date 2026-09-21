import { db } from "@/lib/db";
import { getEvent } from "@/lib/events";
import { retentionCurve } from "@/lib/outcomes";

export const dynamic = "force-dynamic";

const SECRET = process.env.REGISTER_SECRET ?? "";

/**
 * GET /api/metrics?event=ailg-r&date=YYYY-MM-DD (Bearer REGISTER_SECRET): the session's numbers for leadogo's
 * Funnel Performance, replacing what it used to fetch from EasyWebinar. Without `date`, the last 31 sessions.
 */
export async function GET(request: Request) {
  if (!SECRET || request.headers.get("authorization") !== `Bearer ${SECRET}`) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const q = new URL(request.url).searchParams;
  const event = await getEvent(q.get("event") ?? "ailg-r").catch(() => null);
  if (!event) return Response.json({ error: "Unknown event" }, { status: 404 });
  const date = q.get("date");
  let query = db().from("session_metrics").select("*").eq("event_id", event.id).order("session_date", { ascending: false }).limit(31);
  if (date) query = query.eq("session_date", date);
  const { data, error } = await query;
  if (error) return Response.json({ error: "Lookup failed" }, { status: 500 });
  const sessions = [];
  for (const row of data ?? []) {
    const att = await db().from("attendance").select("max_offset, registrant:registrants!inner(source)").eq("session_date", row.session_date).eq("kind", "live").eq("registrant.event_id", event.id);
    const offsets = (att.data ?? []).filter((a) => (a.registrant as unknown as { source: string }).source !== "test").map((a) => a.max_offset as number);
    sessions.push({ ...row, retention: retentionCurve(offsets, event.video_seconds ?? 0), show_up_rate: row.registered ? row.attended / row.registered : 0 });
  }
  return Response.json({ event: event.slug, sessions }, { headers: { "cache-control": "no-store" } });
}
