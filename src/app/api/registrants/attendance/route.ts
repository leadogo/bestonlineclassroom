import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
const SECRET = process.env.REGISTER_SECRET ?? "";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f-]{36}$/i;

/**
 * POST /api/registrants/attendance { date, ids } (Bearer REGISTER_SECRET): live seconds on one session date for
 * the given registrants, whichever day they registered. Katherine's re-invite calls bring back people who
 * registered days earlier and join with their original link, so the day list alone does not see them.
 */
export async function POST(request: Request) {
  if (!SECRET || request.headers.get("authorization") !== `Bearer ${SECRET}`) return Response.json({ error: "Unauthorized" }, { status: 401 });
  let body: { date?: unknown; ids?: unknown };
  try { body = await request.json(); } catch { return Response.json({ error: "Bad JSON" }, { status: 400 }); }
  const date = typeof body.date === "string" && DATE_RE.test(body.date) ? body.date : null;
  const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === "string" && UUID.test(x)).slice(0, 2000) : [];
  if (!date) return Response.json({ error: "Bad date" }, { status: 400 });

  const attended: Record<string, number> = {};
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await db().from("attendance").select("registrant_id, seconds_watched").eq("session_date", date).eq("kind", "live").in("registrant_id", ids.slice(i, i + 200));
    if (error) return Response.json({ error: "Read failed" }, { status: 500 });
    for (const a of data ?? []) attended[String(a.registrant_id)] = Number(a.seconds_watched ?? 0);
  }
  return Response.json({ date, attended }, { headers: { "cache-control": "no-store" } });
}
