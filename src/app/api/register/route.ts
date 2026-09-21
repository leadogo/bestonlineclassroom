import { db } from "@/lib/db";
import { getEvent } from "@/lib/events";
import { nextSession, scheduleOf, sessionFor } from "@/lib/daily-schedule";
import { emailHash, isTestIdentity, joinUrl, newToken, parseRegisterBody } from "@/lib/registrants";

export const dynamic = "force-dynamic";

const SECRET = process.env.REGISTER_SECRET ?? "";

/**
 * POST /api/register (Bearer REGISTER_SECRET): an opt-in becomes a registrant with a unique join link
 * (SPEC-registration-webhook.md). Called by the site before Zapier, and by Zapier for future landing pages.
 * Idempotent on event + session date + email: a retry returns the existing token. Never counts a Test Sample.
 */
export async function POST(request: Request) {
  if (!SECRET || request.headers.get("authorization") !== `Bearer ${SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = parseRegisterBody(body);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 422 });
  const input = parsed.input;

  const event = await getEvent(input.event).catch(() => null);
  if (!event) return Response.json({ error: "Unknown event" }, { status: 404 });
  const schedule = scheduleOf(event);
  const session = sessionFor(schedule, input.session_date) ?? nextSession(schedule);

  const existing = await db()
    .from("registrants")
    .select("id, token")
    .eq("event_id", event.id)
    .eq("session_date", session.date)
    .eq("email", input.email)
    .maybeSingle();
  if (existing.error) return Response.json({ error: "Lookup failed" }, { status: 500 });

  let id: string;
  let token: string;
  if (existing.data) {
    ({ id, token } = existing.data);
  } else {
    token = newToken();
    const inserted = await db()
      .from("registrants")
      .insert({
        event_id: event.id,
        session_date: session.date,
        token,
        first_name: input.first_name,
        email: input.email,
        email_hash: emailHash(input.email),
        phone: input.phone || null,
        source: isTestIdentity(input.email) ? "test" : input.source,
        site_registration_id: input.registration_id,
        attribution: input.attribution,
      })
      .select("id, token")
      .single();
    if (inserted.error) {
      // A concurrent retry won the unique index: return its row.
      const again = await db().from("registrants").select("id, token").eq("event_id", event.id).eq("session_date", session.date).eq("email", input.email).maybeSingle();
      if (!again.data) {
        console.error("[register] insert failed", { code: inserted.error.code, message: inserted.error.message });
        return Response.json({ error: "Could not register" }, { status: 500 });
      }
      ({ id, token } = again.data);
    } else {
      ({ id, token } = inserted.data);
    }
  }

  return Response.json({
    registrant_id: id,
    token,
    join_url: joinUrl(token),
    replay_url: "",
    session_date: session.date,
    session_start_iso: session.start.toISOString(),
    session_end_iso: session.end.toISOString(),
  });
}
