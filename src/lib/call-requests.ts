// "Contact me at (647) 555-0100" (phase 6.4, Q26): the number never shows in the room; the person asked for a call,
// so it is stored and handed to leadogo, which posts it to #sales-reporting with a setter assigned round-robin.
import { db } from "./db.ts";

export { PHONE_RE } from "./chat.ts";

const LEADOGO = (process.env.LEADOGO_URL ?? "https://app.leadogo.com").replace(/\/$/, "");
const SECRET = process.env.REGISTER_SECRET ?? "";

export async function forwardCallRequest(input: { registrantId: string; eventId: string; sessionDate: string; firstName: string; email: string | null; phone: string; message: string; offset: number }): Promise<void> {
  const ins = await db().from("call_requests").insert({ event_id: input.eventId, session_date: input.sessionDate, registrant_id: input.registrantId, phone: input.phone, message: input.message }).select("id").single();
  if (ins.error) { console.error("[call-requests] insert failed", { code: ins.error.code }); return; }
  const att = (await db().from("attendance").select("seconds_watched, cta_clicked_at").eq("registrant_id", input.registrantId).eq("session_date", input.sessionDate).eq("kind", "live").maybeSingle()).data;
  const ev = (await db().from("events").select("slug").eq("id", input.eventId).single()).data;
  try {
    const res = await fetch(`${LEADOGO}/api/webhooks/classroom-call-request`, {
      method: "POST",
      headers: { authorization: `Bearer ${SECRET}`, "content-type": "application/json" },
      body: JSON.stringify({ event: ev?.slug ?? null, session_date: input.sessionDate, name: input.firstName, email: input.email, phone: input.phone, message: input.message, minutes: Math.round(((att?.seconds_watched as number) ?? 0) / 60), clicked: Boolean(att?.cta_clicked_at), at: input.offset }),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) await db().from("call_requests").update({ forwarded_at: new Date().toISOString() }).eq("id", ins.data.id);
    else console.error("[call-requests] forward failed", { status: res.status });
  } catch (err) {
    console.error("[call-requests] forward threw", { err: String(err) });
  }
}
