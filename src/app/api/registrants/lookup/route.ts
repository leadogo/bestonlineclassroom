import { db } from "@/lib/db";
import { getEvent } from "@/lib/events";
import { normalizeEmail } from "@/lib/registrants";

export const dynamic = "force-dynamic";
const SECRET = process.env.REGISTER_SECRET ?? "";

/**
 * GET /api/registrants/lookup?email=&pin=&event= (Bearer REGISTER_SECRET): the site's return-visit door for the
 * free training. The PIN is the last four digits of the phone they registered with. Answers the newest registrant
 * for that email, or 404 for anything that does not match (never says which part was wrong).
 */
export async function GET(request: Request) {
  if (!SECRET || request.headers.get("authorization") !== `Bearer ${SECRET}`) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const q = new URL(request.url).searchParams;
  const email = normalizeEmail(q.get("email"));
  const pin = (q.get("pin") ?? "").trim();
  if (!email || !/^\d{4}$/.test(pin)) return Response.json({ error: "Not found" }, { status: 404 });
  const event = await getEvent(q.get("event") ?? "ailg-r").catch(() => null);
  if (!event) return Response.json({ error: "Not found" }, { status: 404 });
  const { data } = await db().from("registrants").select("token, site_registration_id, session_date, first_name, phone").eq("event_id", event.id).eq("email", email).order("created_at", { ascending: false }).limit(5);
  const hit = (data ?? []).find((r) => (r.phone ?? "").replace(/\D/g, "").slice(-4) === pin);
  if (!hit) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ token: hit.token, site_registration_id: hit.site_registration_id, session_date: hit.session_date, first_name: hit.first_name }, { headers: { "cache-control": "no-store" } });
}
