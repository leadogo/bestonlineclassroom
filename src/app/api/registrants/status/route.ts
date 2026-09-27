import { db } from "@/lib/db";
import { TOKEN_RE } from "@/lib/registrants";

export const dynamic = "force-dynamic";
const SECRET = process.env.REGISTER_SECRET ?? "";

/**
 * GET /api/registrants/status?token= (Bearer REGISTER_SECRET): what the free training needs to know about one
 * registrant: who they are and whether they attended (any live attendance row) and for how long.
 */
export async function GET(request: Request) {
  if (!SECRET || request.headers.get("authorization") !== `Bearer ${SECRET}`) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!TOKEN_RE.test(token)) return Response.json({ error: "Not found" }, { status: 404 });
  const reg = await db().from("registrants").select("id, site_registration_id, session_date, first_name, email, phone, flags").eq("token", token).maybeSingle();
  if (reg.error || !reg.data) return Response.json({ error: "Not found" }, { status: 404 });
  const att = await db().from("attendance").select("seconds_watched").eq("registrant_id", reg.data.id).eq("kind", "live");
  const seconds = (att.data ?? []).reduce((s, a) => s + ((a.seconds_watched as number) ?? 0), 0);
  return Response.json(
    // email: the site's engagement Zap finds the sheet row by it; pin: the return-visit PIN the site shows once.
    { site_registration_id: reg.data.site_registration_id, session_date: reg.data.session_date, first_name: reg.data.first_name, email: reg.data.email ?? "", pin: (reg.data.phone ?? "").replace(/\D/g, "").slice(-4), attended: (att.data ?? []).length > 0, seconds_watched: seconds, flags: reg.data.flags ?? {} },
    { headers: { "cache-control": "no-store" } },
  );
}
