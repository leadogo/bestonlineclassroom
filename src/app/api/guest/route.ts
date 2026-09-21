import { createGuest, type GuestSource } from "@/lib/attendees";
import { getEvent } from "@/lib/events";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** POST { slug, first_name, session_date, src, rid } → { token }: a guest registrant for the open link's name prompt. */
export async function POST(request: Request) {
  let b: Record<string, unknown>;
  try {
    b = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const first_name = String(b.first_name ?? "").trim().slice(0, 40);
  if (!first_name) return Response.json({ error: "Please enter your first name." }, { status: 422 });
  const session_date = String(b.session_date ?? "");
  if (!DATE_RE.test(session_date)) return Response.json({ error: "Invalid session." }, { status: 422 });
  const event = await getEvent(String(b.slug ?? "")).catch(() => null);
  if (!event) return Response.json({ error: "Unknown event." }, { status: 404 });
  const source: GuestSource = b.src === "legacy" ? "legacy" : b.src === "skool" ? "skool" : "guest";
  const rid = typeof b.rid === "string" && UUID_RE.test(b.rid) ? b.rid.toLowerCase() : null;
  try {
    const r = await createGuest({ eventId: event.id, sessionDate: session_date, firstName: first_name, source, siteRegistrationId: rid });
    return Response.json({ token: r.token });
  } catch (err) {
    console.error("[guest] create failed", { err: String(err) });
    return Response.json({ error: "Please try again." }, { status: 500 });
  }
}
