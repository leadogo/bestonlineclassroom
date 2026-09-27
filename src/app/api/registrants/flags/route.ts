import { db } from "@/lib/db";
import { TOKEN_RE } from "@/lib/registrants";

export const dynamic = "force-dynamic";
const SECRET = process.env.REGISTER_SECRET ?? "";
const ALLOWED = new Set(["hot", "ultra_hot", "training_minutes", "training_completed"]);

/**
 * PATCH /api/registrants/flags (Bearer REGISTER_SECRET) { token, flags }: merges the site's training flags into the
 * registrant (hot, ultra_hot, training_minutes, training_completed). The moderator view shows hot as a badge.
 */
export async function PATCH(request: Request) {
  if (!SECRET || request.headers.get("authorization") !== `Bearer ${SECRET}`) return Response.json({ error: "Unauthorized" }, { status: 401 });
  let body: { token?: unknown; flags?: unknown };
  try {
    body = (await request.json()) as { token?: unknown; flags?: unknown };
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const token = typeof body.token === "string" ? body.token : "";
  if (!TOKEN_RE.test(token) || !body.flags || typeof body.flags !== "object") return Response.json({ error: "Bad request" }, { status: 400 });
  const incoming: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body.flags as Record<string, unknown>)) if (ALLOWED.has(k) && (typeof v === "boolean" || typeof v === "number" || Array.isArray(v))) incoming[k] = v;
  const reg = await db().from("registrants").select("id, flags").eq("token", token).maybeSingle();
  if (reg.error || !reg.data) return Response.json({ error: "Not found" }, { status: 404 });
  const flags = { ...((reg.data.flags as Record<string, unknown>) ?? {}), ...incoming };
  const up = await db().from("registrants").update({ flags }).eq("id", reg.data.id);
  if (up.error) return Response.json({ error: "Update failed" }, { status: 500 });
  return Response.json({ ok: true, flags });
}
