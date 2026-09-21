import { db } from "@/lib/db";
import { TOKEN_RE } from "@/lib/registrants";

export const dynamic = "force-dynamic";

/** POST { token } (a beacon): the first CTA click per registrant per session. */
export async function POST(request: Request) {
  let token = "";
  try {
    token = String(((await request.json()) as { token?: string }).token ?? "");
  } catch {
    return new Response(null, { status: 400 });
  }
  if (!TOKEN_RE.test(token)) return new Response(null, { status: 400 });
  const reg = await db().from("registrants").select("id, session_date").eq("token", token).maybeSingle();
  if (reg.error || !reg.data) return new Response(null, { status: 404 });
  const now = new Date().toISOString();
  const { error } = await db()
    .from("attendance")
    .upsert({ registrant_id: reg.data.id, session_date: reg.data.session_date, kind: "live", cta_clicked_at: now, last_seen_at: now }, { onConflict: "registrant_id,session_date,kind", ignoreDuplicates: false });
  if (error) return new Response(null, { status: 500 });
  return new Response(null, { status: 204 });
}
