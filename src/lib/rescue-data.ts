// The rescue lists for one session, read from the classroom (SPEC-bookings-recovery.md M4). Shared by the endpoint
// Katherine reads and the cron that tags `ailgr_rescue`.
import { db, pageAll } from "./db.ts";
import { joinUrl } from "./registrants.ts";
import { secondRing, type Attendee, type Clicker } from "./rescue.ts";

export type RescuePerson = { id: string; token: string; first_name: string; email: string | null; phone: string | null; join_url: string; session_date: string; registered_at: string };
export type RescueLists = { rescue: Array<RescuePerson & Clicker & { clicked_at: string }>; second_ring: RescuePerson[] };

type Row = { registrant_id: string; max_offset: number | null; cta_clicked_at: string | null; registrant: { token: string; first_name: string; email: string | null; phone: string | null; blocked_at: string | null; created_at: string; source: string | null; event_id: string } };

export async function loadRescueLists(eventId: string, sessionDate: string): Promise<RescueLists> {
  // Paged: PostgREST answers at most 1,000 rows a call whatever the limit says.
  const data = await pageAll<Row>((from, to) =>
    db()
      .from("attendance")
      .select("registrant_id, max_offset, cta_clicked_at, registrant:registrants!inner(token, first_name, email, phone, blocked_at, created_at, source, event_id)")
      .eq("session_date", sessionDate)
      .eq("kind", "live")
      .eq("registrant.event_id", eventId)
      .order("registrant_id")
      .range(from, to) as unknown as PromiseLike<{ data: Row[] | null; error: { message: string } | null }>,
  );
  const rows = data.filter((r) => r.registrant.source !== "test");

  // Bookings by these rows or the same emails, with when they were made (a booking before tonight's click is not tonight's).
  const ids = rows.map((r) => r.registrant_id);
  const emails = [...new Set(rows.map((r) => r.registrant.email?.toLowerCase()).filter((e): e is string => Boolean(e)))];
  const byId = new Map<string, string[]>(), byEmail = new Map<string, string[]>();
  const add = (m: Map<string, string[]>, k: string, v: string) => m.set(k, [...(m.get(k) ?? []), v]);
  for (let i = 0; i < ids.length; i += 200) {
    const b = await db().from("bookings").select("registrant_id, booked_at").in("registrant_id", ids.slice(i, i + 200));
    // A failed bookings read must stop the run: read as "nobody booked", it would text and call people who booked.
    if (b.error) throw new Error(`rescue bookings read failed: ${b.error.message}`);
    for (const x of b.data ?? []) if (x.registrant_id) add(byId, String(x.registrant_id), String(x.booked_at));
  }
  for (let i = 0; i < emails.length; i += 200) {
    const b = await db().from("bookings").select("email, booked_at").in("email", emails.slice(i, i + 200));
    if (b.error) throw new Error(`rescue bookings read failed: ${b.error.message}`);
    for (const x of b.data ?? []) if (x.email) add(byEmail, String(x.email).toLowerCase(), String(x.booked_at));
  }
  const bookedSince = (r: Row, sinceIso: string) => [...(byId.get(r.registrant_id) ?? []), ...(byEmail.get(r.registrant.email?.toLowerCase() ?? "") ?? [])].some((t) => Date.parse(t) >= Date.parse(sinceIso) - 60_000);

  const person = (r: Row): RescuePerson => ({ id: r.registrant_id, token: r.registrant.token, first_name: r.registrant.first_name, email: r.registrant.email, phone: r.registrant.phone, join_url: joinUrl(r.registrant.token), session_date: sessionDate, registered_at: r.registrant.created_at });
  const rescue = rows
    .filter((r) => r.cta_clicked_at)
    .map((r) => ({ ...person(r), clickedAt: r.cta_clicked_at as string, clicked_at: r.cta_clicked_at as string, booked: bookedSince(r, r.cta_clicked_at as string), blocked: Boolean(r.registrant.blocked_at) }));
  const attendees: Array<Attendee & { row: Row }> = rows.map((r) => ({ id: r.registrant_id, maxOffset: Number(r.max_offset ?? 0), clicked: Boolean(r.cta_clicked_at), booked: bookedSince(r, `${sessionDate}T00:00:00Z`), blocked: Boolean(r.registrant.blocked_at), registeredAt: r.registrant.created_at, row: r }));
  return { rescue, second_ring: secondRing(attendees).map((a) => person(a.row)) };
}
