// Who is in the room: a registrant found by their token, or by the identity a link carries (email hash from an
// email or SMS send, the site's registration id on a legacy link), or a guest created from a first name. A known
// person clicking the open link on a later day gets a fresh registrant row for tonight with their name carried
// over, so the room never says "ended" to someone who came to watch.
import { db } from "./db.ts";
import type { EventRow } from "./events.ts";
import { newToken } from "./registrants.ts";

export type Registrant = {
  id: string;
  event_id: string;
  session_date: string;
  token: string;
  first_name: string;
  email: string | null;
  email_hash: string;
  phone: string | null;
  source: string;
  site_registration_id: string | null;
  blocked_at: string | null;
  replay_opened_at: string | null;
  confirmation_sent_at: string | null;
  room_join_reported_at: string | null;
};

const COLS = "id, event_id, session_date, token, first_name, email, email_hash, phone, source, site_registration_id, blocked_at, replay_opened_at, confirmation_sent_at, room_join_reported_at";

export async function registrantByToken(token: string): Promise<(Registrant & { event: EventRow }) | null> {
  const { data, error } = await db().from("registrants").select(`${COLS}, event:events(*)`).eq("token", token).maybeSingle();
  if (error) throw error;
  return (data as unknown as (Registrant & { event: EventRow }) | null) ?? null;
}

/** The most recent registrant for this identity on this event, any session. */
async function latestBy(eventId: string, column: "email_hash" | "site_registration_id", value: string): Promise<Registrant | null> {
  const { data, error } = await db().from("registrants").select(COLS).eq("event_id", eventId).eq(column, value).order("session_date", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return (data as Registrant | null) ?? null;
}

export type GuestSource = "skool" | "legacy" | "guest";

export async function createGuest(input: { eventId: string; sessionDate: string; firstName: string; source: GuestSource; email?: string | null; emailHash?: string; phone?: string | null; siteRegistrationId?: string | null }): Promise<Registrant> {
  const { data, error } = await db()
    .from("registrants")
    .insert({
      event_id: input.eventId,
      session_date: input.sessionDate,
      token: newToken(),
      first_name: input.firstName,
      email: input.email ?? null,
      email_hash: input.emailHash ?? "",
      phone: input.phone ?? null,
      source: input.source,
      site_registration_id: input.siteRegistrationId ?? null,
    })
    .select(COLS)
    .single();
  if (error) throw error;
  return data as Registrant;
}

/**
 * For the open link: the registrant to use tonight for an identity the link carries, or null when nobody is
 * known (the page then asks for a first name). A match on another date becomes a new row for tonight.
 */
export async function resolveForSession(eventId: string, sessionDate: string, ids: { eh?: string; rid?: string }, source: GuestSource): Promise<Registrant | null> {
  const known = (ids.eh && /^[0-9a-f]{64}$/.test(ids.eh) ? await latestBy(eventId, "email_hash", ids.eh) : null) ?? (ids.rid ? await latestBy(eventId, "site_registration_id", ids.rid) : null);
  if (!known) return null;
  if (known.session_date === sessionDate) return known;
  try {
    return await createGuest({ eventId, sessionDate, firstName: known.first_name, source, email: known.email, emailHash: known.email_hash, phone: known.phone, siteRegistrationId: known.site_registration_id });
  } catch {
    // The unique (event, date, email) index says a row for tonight already exists (a race): use it.
    return known.email_hash ? latestBy(eventId, "email_hash", known.email_hash) : null;
  }
}
