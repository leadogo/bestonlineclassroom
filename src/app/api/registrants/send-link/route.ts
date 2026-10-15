import { db } from "@/lib/db";
import type { EventRow } from "@/lib/events";
import { scheduleOf, sessionFor } from "@/lib/daily-schedule";
import { sendLinkEmail } from "@/lib/mailer";
import { TOKEN_RE } from "@/lib/registrants";

export const dynamic = "force-dynamic";
const SECRET = process.env.REGISTER_SECRET ?? "";
const RULE_KEY = "link_request";

/**
 * POST /api/registrants/send-link (Bearer REGISTER_SECRET) { token }: emails the person their own join link, the
 * way the reminders do (same sender, same footer), once per registrant. Katherine calls it mid-call when someone
 * asks for the link by email. Answers { ok, already } so the caller can say "sent" or "already in your inbox".
 */
export async function POST(request: Request) {
  if (!SECRET || request.headers.get("authorization") !== `Bearer ${SECRET}`) return Response.json({ error: "Unauthorized" }, { status: 401 });
  let body: { token?: unknown };
  try {
    body = (await request.json()) as { token?: unknown };
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const token = typeof body.token === "string" ? body.token : "";
  if (!TOKEN_RE.test(token)) return Response.json({ error: "Bad request" }, { status: 400 });

  const reg = await db().from("registrants").select("id, event_id, session_date, first_name, email, token, no_email").eq("token", token).maybeSingle();
  if (reg.error || !reg.data) return Response.json({ error: "Not found" }, { status: 404 });
  if (!reg.data.email || reg.data.no_email) return Response.json({ ok: false, reason: "no_email" });

  const done = await db().from("reminder_sends").select("sent_at").eq("registrant_id", reg.data.id).eq("rule_key", RULE_KEY).maybeSingle();
  if (done.data) return Response.json({ ok: true, already: true });

  const ev = await db().from("events").select("*").eq("id", reg.data.event_id).maybeSingle();
  if (ev.error || !ev.data) return Response.json({ error: "Not found" }, { status: 404 });
  const event = ev.data as EventRow;
  const session = sessionFor(scheduleOf(event), reg.data.session_date as string);
  if (!session) return Response.json({ error: "Bad session" }, { status: 500 });

  const res = await sendLinkEmail({ id: reg.data.id, first_name: reg.data.first_name, email: reg.data.email, token: reg.data.token }, event, session);
  if (!res.ok) return Response.json({ ok: false, reason: res.error ?? "send_failed" }, { status: 502 });
  await db().from("reminder_sends").insert({ registrant_id: reg.data.id, rule_key: RULE_KEY });
  return Response.json({ ok: true, already: false });
}
