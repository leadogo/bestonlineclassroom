import { createGuest, type GuestSource } from "@/lib/attendees";
import { cleanName } from "@/lib/chat-filter";
import { getEvent } from "@/lib/events";
import { emailHash, isTestIdentity, nameFromEmail, normalizeEmail } from "@/lib/registrants";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST { slug, first_name, email?, session_date, src, rid } → { token }: a guest registrant for the open link's card.
 * When the event's open link asks for an email (SPEC-phase7.md) the email is required and the name may be blank; the
 * database walls a client on insert, and their link then shows the 404.
 */
export async function POST(request: Request) {
  let b: Record<string, unknown>;
  try {
    b = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const session_date = String(b.session_date ?? "");
  if (!DATE_RE.test(session_date)) return Response.json({ error: "Invalid session." }, { status: 422 });
  const event = await getEvent(String(b.slug ?? "")).catch(() => null);
  if (!event) return Response.json({ error: "Unknown event." }, { status: 404 });
  const email = normalizeEmail(b.email);
  if (event.open_link_field === "email" && !email) return Response.json({ error: "Enter the email you registered with." }, { status: 422 });
  const typed = cleanName(String(b.first_name ?? ""));
  const first_name = typed || (email ? cleanName(nameFromEmail(email)) : null) || "Guest";
  if (!typed && !email) return Response.json({ error: "Please enter your first name, as you would like it shown." }, { status: 422 });
  const source: GuestSource = b.src === "legacy" ? "legacy" : b.src === "skool" ? "skool" : "guest";
  const rid = typeof b.rid === "string" && UUID_RE.test(b.rid) ? b.rid.toLowerCase() : null;
  try {
    const r = await createGuest({ eventId: event.id, sessionDate: session_date, firstName: first_name, source: email && isTestIdentity(email) ? ("test" as never) : source, email: email ?? null, emailHash: email ? emailHash(email) : undefined, siteRegistrationId: rid });
    return Response.json({ token: r.token });
  } catch (err) {
    console.error("[guest] create failed", { err: String(err) });
    return Response.json({ error: "Please try again." }, { status: 500 });
  }
}
