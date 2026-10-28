// Who is in the room: a registrant found by their token, or by the identity a link carries (email hash from an
// email or SMS send, the site's registration id on a legacy link), or a guest created from a first name. A known
// person clicking the open link on a later day gets a fresh registrant row for tonight with their name carried
// over, so the room never says "ended" to someone who came to watch.
import { db } from "./db.ts";
import type { EventRow } from "./events.ts";
import { isUniqueViolation, newToken } from "./registrants.ts";

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
  block_reason: string | null;
  replay_opened_at: string | null;
  confirmation_sent_at: string | null;
  room_join_reported_at: string | null;
  legacy_key: string | null;
  skool_invited_at: string | null;
};

const COLS = "id, event_id, session_date, token, first_name, email, email_hash, phone, source, site_registration_id, blocked_at, block_reason, replay_opened_at, confirmation_sent_at, room_join_reported_at, legacy_key, skool_invited_at";

export async function registrantByToken(token: string): Promise<(Registrant & { event: EventRow }) | null> {
  const { data, error } = await db().from("registrants").select(`${COLS}, event:events(*)`).eq("token", token).maybeSingle();
  if (error) throw error;
  return (data as unknown as (Registrant & { event: EventRow }) | null) ?? null;
}

/**
 * Ghosted in chat on this event, on this seat or any seat under the same email: the live room 404s for them (William,
 * Oct 28 2026: every ghost, by hand or by rule; the replay stays open). Best-effort: a read error lets them in.
 */
export async function everGhosted(r: { id: string; event_id: string; email: string | null }): Promise<boolean> {
  const ghosted = () => db().from("registrants").select("id", { count: "exact", head: true }).eq("event_id", r.event_id).not("ghosted_at", "is", null);
  const [self, same] = await Promise.all([ghosted().eq("id", r.id), r.email ? ghosted().eq("email", r.email) : Promise.resolve({ count: 0, error: null })]);
  if (self.error || same.error) return false;
  return (self.count ?? 0) + (same.count ?? 0) > 0;
}

/** The most recent registrant for this identity on this event, any session. */
async function latestBy(eventId: string, column: "email_hash" | "site_registration_id" | "legacy_key", value: string): Promise<Registrant | null> {
  const { data, error } = await db().from("registrants").select(COLS).eq("event_id", eventId).eq(column, value).order("session_date", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return (data as Registrant | null) ?? null;
}

export type GuestSource = "skool" | "legacy" | "guest" | "sms" | "email";

export async function createGuest(input: { eventId: string; sessionDate: string; firstName: string; source: GuestSource | "legacy-import"; email?: string | null; emailHash?: string; phone?: string | null; siteRegistrationId?: string | null; legacyKey?: string | null }): Promise<Registrant> {
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
      legacy_key: input.legacyKey ?? null,
    })
    .select(COLS)
    .single();
  if (error) {
    // The unique (event, date, email) index: this email already holds a seat tonight (a registrant typing the
    // email they signed up with at the open door, or two taps on Join). Their own row, never "Please try again".
    const theirs = isUniqueViolation(error) && input.email ? await seatFor(input.eventId, input.sessionDate, input.email) : null;
    if (theirs) return theirs;
    throw error;
  }
  return data as Registrant;
}

async function seatFor(eventId: string, sessionDate: string, email: string): Promise<Registrant | null> {
  const { data } = await db().from("registrants").select(COLS).eq("event_id", eventId).eq("session_date", sessionDate).eq("email", email).limit(1).maybeSingle();
  return (data as Registrant | null) ?? null;
}

/**
 * For the open link: the registrant to use tonight for an identity the link carries, or null when nobody is
 * known (the page then asks for a first name). A match on another date becomes a new row for tonight.
 */
export async function resolveForSession(eventId: string, sessionDate: string, ids: { eh?: string; rid?: string; lk?: string }, source: GuestSource): Promise<Registrant | null> {
  const known =
    (ids.eh && /^[0-9a-f]{64}$/.test(ids.eh) ? await latestBy(eventId, "email_hash", ids.eh) : null) ??
    (ids.rid ? await latestBy(eventId, "site_registration_id", ids.rid) : null) ??
    (ids.lk && /^[0-9a-f]{32}$/.test(ids.lk) ? await latestBy(eventId, "legacy_key", ids.lk) : null);
  if (!known) return null;
  if (known.session_date === sessionDate) return known;
  try {
    return await createGuest({ eventId, sessionDate, firstName: known.first_name, source, email: known.email, emailHash: known.email_hash, phone: known.phone, siteRegistrationId: known.site_registration_id, legacyKey: known.legacy_key });
  } catch {
    // The unique (event, date, email) index says a row for tonight already exists (a race): use it.
    return known.email_hash ? latestBy(eventId, "email_hash", known.email_hash) : null;
  }
}
