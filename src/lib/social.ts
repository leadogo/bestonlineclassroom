// Stacy, William's social manager bot (Instagram @willkabrall + the Book More Showings Page), asks two things of the
// room: has this person registered / attended / booked (the DM follow-up and booking rules), and how many of her
// links turned into registrants, attendees and bookings each week. Pure parts here, tested; loading below.
import { db } from "./db.ts";

/** Attended = 15 minutes or more live, the same bar as the "attended" ActiveCampaign tag (outcomes.ts). */
export const ATTENDED_SECONDS = 900;
/** Stacy's links carry utm_source=social and the channel in utm_medium (ig_dm, fb_dm, ig_comment, fb_comment). */
export const SOCIAL_SOURCE = "social";

export type Reg = { id: string; email: string | null; session_date: string; attribution?: Record<string, unknown> | null };
export type Att = { registrant_id: string; seconds_watched: number };
export type Book = { registrant_id: string | null; email: string | null; status: string | null };
export type LookupAnswer = { registered: boolean; attended: boolean; booked: boolean; last_event_date: string | null };

const live = (b: Book) => !/cancel/i.test(b.status ?? "");

/** One person's answer: yes/no only, and the newest session they registered for. */
export function lookupAnswer(regs: Reg[], att: Att[], books: Book[]): LookupAnswer {
  const ids = new Set(regs.map((r) => r.id));
  const last = regs.map((r) => r.session_date).sort().at(-1) ?? null;
  return {
    registered: regs.length > 0,
    attended: att.some((a) => ids.has(a.registrant_id) && a.seconds_watched >= ATTENDED_SECONDS),
    booked: books.some(live),
    last_event_date: last,
  };
}

/** Monday (UTC date) of the week holding `date` (YYYY-MM-DD). */
export function weekStart(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

export type Counts = { registered: number; attended: number; booked: number };
export type Week = { week_start: string; total: Counts; by_medium: Record<string, Counts> };

/** Social registrants by session week and utm_medium, then how many of them attended and booked. Newest week first. */
export function funnelWeeks(regs: Reg[], att: Att[], books: Book[]): Week[] {
  const attended = new Set(att.filter((a) => a.seconds_watched >= ATTENDED_SECONDS).map((a) => a.registrant_id));
  const bookedIds = new Set(books.filter(live).map((b) => b.registrant_id).filter(Boolean));
  const bookedEmails = new Set(books.filter(live).map((b) => (b.email ?? "").toLowerCase()).filter(Boolean));
  // One person counts once per week (the channel of their first registration that week); any of their rows that
  // week can make them attended or booked.
  const people = new Map<string, Reg[]>();
  for (const r of [...regs].sort((a, b) => a.session_date.localeCompare(b.session_date))) {
    const who = `${weekStart(r.session_date)}|${(r.email ?? r.id).toLowerCase()}`;
    people.set(who, [...(people.get(who) ?? []), r]);
  }
  const weeks = new Map<string, Week>();
  const zero = (): Counts => ({ registered: 0, attended: 0, booked: 0 });
  for (const rs of people.values()) {
    const ws = weekStart(rs[0].session_date);
    const medium = String(rs[0].attribution?.utm_medium ?? "") || "unknown";
    const w = weeks.get(ws) ?? { week_start: ws, total: zero(), by_medium: {} };
    weeks.set(ws, w);
    const m = (w.by_medium[medium] ??= zero());
    const a = rs.some((r) => attended.has(r.id)) ? 1 : 0;
    const b = rs.some((r) => bookedIds.has(r.id) || (r.email && bookedEmails.has(r.email.toLowerCase()))) ? 1 : 0;
    for (const c of [w.total, m]) { c.registered++; c.attended += a; c.booked += b; }
  }
  return [...weeks.values()].sort((a, b) => b.week_start.localeCompare(a.week_start));
}

const calls: number[] = [];
/** Bearer SOCIAL_LOOKUP_SECRET (Stacy's own token, never REGISTER_SECRET) and about 60 calls a minute: 401 / 429 or null when fine. */
export function socialGate(request: Request, now = Date.now()): Response | null {
  const secret = process.env.SOCIAL_LOOKUP_SECRET ?? "";
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "Unauthorized" }, { status: 401 });
  // ponytail: per-instance window, so a burst spread over several instances can pass ~60 each; a DB counter if that matters
  while (calls.length && calls[0] < now - 60_000) calls.shift();
  if (calls.length >= 60) return Response.json({ error: "Too many requests" }, { status: 429, headers: { "retry-after": "60" } });
  calls.push(now);
  return null;
}

async function attendanceFor(ids: string[]): Promise<Att[]> {
  const out: Att[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await db().from("attendance").select("registrant_id, seconds_watched").eq("kind", "live").in("registrant_id", ids.slice(i, i + 200));
    if (error) throw error;
    out.push(...((data ?? []) as Att[]));
  }
  return out;
}

export async function lookupPerson(email: string): Promise<LookupAnswer> {
  const { data: regs, error } = await db().from("registrants").select("id, email, session_date").eq("email", email).limit(200);
  if (error) throw error;
  const ids = (regs ?? []).map((r) => r.id as string);
  const att = await attendanceFor(ids);
  const byEmail = await db().from("bookings").select("registrant_id, email, status").ilike("email", email).limit(50);
  if (byEmail.error) throw byEmail.error;
  const byId = ids.length ? await db().from("bookings").select("registrant_id, email, status").in("registrant_id", ids.slice(0, 200)).limit(50) : { data: [], error: null };
  if (byId.error) throw byId.error;
  return lookupAnswer((regs ?? []) as Reg[], att, [...(byEmail.data ?? []), ...(byId.data ?? [])] as Book[]);
}

export async function loadFunnel(sinceDate: string): Promise<Week[]> {
  const { data: regs, error } = await db().from("registrants").select("id, email, session_date, attribution").eq("attribution->>utm_source", SOCIAL_SOURCE).gte("session_date", sinceDate).limit(5000);
  if (error) throw error;
  const rs = (regs ?? []) as Reg[];
  const ids = rs.map((r) => r.id);
  const att = await attendanceFor(ids);
  const books: Book[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error: e } = await db().from("bookings").select("registrant_id, email, status").in("registrant_id", ids.slice(i, i + 200));
    if (e) throw e;
    books.push(...((data ?? []) as Book[]));
  }
  const emails = [...new Set(rs.map((r) => r.email).filter((e): e is string => Boolean(e)))];
  for (let i = 0; i < emails.length; i += 200) {
    const { data, error: e } = await db().from("bookings").select("registrant_id, email, status").in("email", emails.slice(i, i + 200));
    if (e) throw e;
    books.push(...((data ?? []) as Book[]));
  }
  return funnelWeeks(rs, att, books);
}
