import { after } from "next/server";
import { db } from "@/lib/db";
import { tagNow } from "@/lib/tagging";
import { TOKEN_RE } from "@/lib/registrants";

export const dynamic = "force-dynamic";

/** POST { token, kind? } (a beacon): the CTA click per registrant per session, live or replay. */
export async function POST(request: Request) {
  let token = "";
  let kind = "live";
  try {
    const b = (await request.json()) as { token?: string; kind?: string };
    token = String(b.token ?? "");
    kind = b.kind === "replay" ? "replay" : "live";
  } catch {
    return new Response(null, { status: 400 });
  }
  if (!TOKEN_RE.test(token)) return new Response(null, { status: 400 });
  const reg = await db().from("registrants").select("id, session_date").eq("token", token).maybeSingle();
  if (reg.error || !reg.data) return new Response(null, { status: 404 });
  const registrantId = reg.data.id;
  const now = new Date().toISOString();
  const { error } = await db()
    .from("attendance")
    .upsert({ registrant_id: reg.data.id, session_date: reg.data.session_date, kind, cta_clicked_at: now, last_seen_at: now }, { onConflict: "registrant_id,session_date,kind", ignoreDuplicates: false });
  if (error) return new Response(null, { status: 500 });
  after(() => tagNow(registrantId, "clicked_offer"));
  return new Response(null, { status: 204 });
}
