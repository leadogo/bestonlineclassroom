import { after } from "next/server";
import { db } from "@/lib/db";
import { tagNow } from "@/lib/tagging";
import { TOKEN_RE } from "@/lib/registrants";
import { postToIntel } from "@/lib/slack";
import { scheduleOf, sessionFor } from "@/lib/daily-schedule";

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
  const reg = await db().from("registrants").select("id, session_date, first_name, phone, source, event_id, event:events(cta_label, timezone, start_time, video_seconds, days)").eq("token", token).maybeSingle();
  if (reg.error || !reg.data) return new Response(null, { status: 404 });
  const registrantId = reg.data.id;
  const now = new Date().toISOString();
  const { error } = await db()
    .from("attendance")
    .upsert({ registrant_id: reg.data.id, session_date: reg.data.session_date, kind, cta_clicked_at: now, last_seen_at: now }, { onConflict: "registrant_id,session_date,kind", ignoreDuplicates: false });
  if (error) return new Response(null, { status: 500 });
  after(() => tagNow(registrantId, "clicked_offer"));
  // The intel channel hears about it within the minute: who, their phone, how far into the session, which click of the night.
  const ev = reg.data.event as unknown as { cta_label: string | null; timezone: string; start_time: string; video_seconds: number | null; days: number[] } | null;
  if (reg.data.source !== "test" && ev) {
    const r = reg.data;
    after(async () => {
      const session = sessionFor(scheduleOf(ev), r.session_date);
      const secs = session ? Math.max(0, Math.floor((Date.now() - session.start.getTime()) / 1000)) : 0;
      const at = `${Math.floor(secs / 3600)}:${String(Math.floor((secs % 3600) / 60)).padStart(2, "0")}`;
      const n = await db().from("attendance").select("registrant_id, registrant:registrants!inner(event_id)", { count: "exact", head: true }).eq("session_date", r.session_date).eq("kind", "live").not("cta_clicked_at", "is", null).eq("registrant.event_id", r.event_id);
      const nth = n.count ?? 0;
      await postToIntel(`🔔 *${r.first_name}*${r.phone ? ` · ${r.phone}` : ""} clicked *${ev.cta_label ?? "the offer"}*${kind === "replay" ? " on the replay" : ` at ${at} into the session`}${nth ? ` · click #${nth} tonight` : ""}`);
    });
  }
  return new Response(null, { status: 204 });
}
