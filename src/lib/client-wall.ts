// The client wall (SPEC-phase7.md): the snapshot bms-dashboard pushes every 30 minutes, normalized to the keys the
// database matches on (lowercased email, its hash, the last ten digits of a phone). Matching itself lives in SQL
// (client_wall_hit) so the insert trigger and the sync agree by construction.
import { db } from "./db.ts";
import { emailHash, normalizeEmail } from "./registrants.ts";
import { INTEL_CHANNEL, postNotice } from "./slack.ts";
import { clientWallNotice } from "./notices.ts";

export type WallRow = { client_id: string; name: string | null; status: string | null; emails: string[]; email_hashes: string[]; phones: string[]; free_locals: string[]; client_since: string | null };

/** Personal mailboxes: the same name part on two of them is one person (a company domain's "andrew@" is many). */
const FREE_MAIL = /^[^@\s]+@(?:gmail|googlemail|icloud|me|mac|yahoo|ymail|hotmail|outlook|live|msn|aol|comcast|att|sbcglobal|verizon|protonmail|proton|gmx)\.[a-z.]+$/i;
const GENERIC = new Set(["info", "admin", "contact", "sales", "office", "hello", "support", "team", "realtor", "realestate", "homes", "properties", "mail", "email", "agent", "broker", "listings", "marketing", "noreply"]);

/** The look-alike key (Brishen, Oct 28: combsrealtor@gmail walled, back as combsrealtor@icloud): a personal mailbox's name part, six characters or more, not a role word. Mirrors free_locals in SQL (migration 047). */
export function freeLocal(email: string): string | null {
  const e = email.trim().toLowerCase();
  if (!FREE_MAIL.test(e)) return null;
  const local = e.split("@")[0];
  return local.length >= 6 && !GENERIC.has(local) ? local : null;
}

/** An address + browser that opened the 404 for exactly one client is that client's device; one seen for several is a scanner (Gmail checks every link in every email) or a shared proxy. */
export function isDeviceTell(registrantIds: string[]): boolean {
  return new Set(registrantIds).size === 1;
}

/** This address and browser opened a client's 404 in the last 30 days, and only ever that client's: their own device under a new email. Best-effort: a read error means no. */
/** Google's crawler and Gmail link-checker ranges: never one person's device. */
const GOOGLE = /^(?:172\.217|172\.253|173\.194|74\.125|66\.249|64\.233|209\.85|108\.177|142\.25[01]|216\.58)\./;

export async function walledDevice(ip: string | null, ua: string | null): Promise<boolean> {
  if (!ip || !ua || GOOGLE.test(ip)) return false;
  const { data, error } = await db().from("link_clicks").select("registrant_id").eq("outcome", "walled").eq("ip", ip).eq("user_agent", ua).eq("bot", false).gte("at", new Date(Date.now() - 30 * 86_400_000).toISOString()).limit(50);
  if (error) return false;
  return isDeviceTell((data ?? []).map((r) => String(r.registrant_id)));
}

/** A snapshot smaller than this is a bug upstream, not a directory; refusing it keeps a bad push from releasing everyone. */
export const MIN_SNAPSHOT = 100;
/** More than this many people walled in one sync is a bad snapshot; the database refuses and we tell Slack. */
export const FLAG_CAP = 300;

export function phoneKey(raw: unknown): string | null {
  const d = String(raw ?? "").replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-10) : null;
}

/** Rows the wall can match on; a client with no usable email or phone is dropped, duplicates collapse. */
export function normalizeClients(raw: unknown): WallRow[] {
  if (!Array.isArray(raw)) return [];
  const out: WallRow[] = [];
  for (const c of raw as Array<Record<string, unknown> | null>) {
    const id = String(c?.id ?? "").trim();
    if (!c || !id) continue;
    const emails = [...new Set((Array.isArray(c.emails) ? c.emails : []).map(normalizeEmail).filter((e): e is string => Boolean(e)))];
    const phones = [...new Set((Array.isArray(c.phones) ? c.phones : []).map(phoneKey).filter((p): p is string => Boolean(p)))];
    if (!emails.length && !phones.length) continue;
    const since = typeof c.since === "string" && !Number.isNaN(Date.parse(c.since)) ? new Date(c.since).toISOString() : null;
    const free_locals = [...new Set(emails.map(freeLocal).filter((l): l is string => Boolean(l)))];
    out.push({ client_id: id.slice(0, 80), name: typeof c.name === "string" ? c.name.slice(0, 120) : null, status: typeof c.status === "string" ? c.status.slice(0, 40) : null, emails, email_hashes: emails.map(emailHash), phones, free_locals, client_since: since });
  }
  return out;
}

/** One line to #autoweb-intel the first time in an hour a walled client opens a link; reloads stay quiet. */
export async function tellWallHit(r: { id: string; first_name: string; email: string | null; session_date: string }, eventTitle: string, path: "join" | "replay"): Promise<void> {
  const since = new Date(Date.now() - 3_600_000).toISOString();
  const { count } = await db().from("link_clicks").select("id", { count: "exact", head: true }).eq("registrant_id", r.id).in("outcome", ["walled", "walled_device"]).gte("at", since);
  if ((count ?? 0) > 1) return;
  await postNotice(INTEL_CHANNEL, clientWallNotice({ name: r.first_name, email: r.email, path, eventTitle, date: r.session_date }));
}
