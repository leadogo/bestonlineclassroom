// Every ActiveCampaign contact who registered holds a personal watch link (SPEC-friday-unattended.md, E2). The sweep
// behind /api/cron/ac-links: the tagged contacts whose WebinarJoinLink is not a personal link get one, and a contact the
// room has never seen gets a room row first (source legacy, dated yesterday, so tonight's count and the reminders are
// untouched until they click). Oct 22: 79 of 13,964 tagged contacts had none; Theresa King's promo read "Webinar Link:"
// with nothing after it. The pure parts (the plan, the session date) are tested; the sweep reads and writes.
// ponytail: scripts/ac-personal-links.ts still holds the by-hand version of this; delete it once the cron has run clean.
import { acApi, JOIN_FIELD, PERSONAL_RE, REGISTERED_TAG_ID, REPLAY_FIELD, watchLinks } from "./activecampaign.ts";
import { db, pageAll } from "./db.ts";
import { cleanName } from "./chat-filter.ts";
import { emailHash, isTestIdentity, nameFromEmail, newToken, normalizeEmail } from "./registrants.ts";
import type { Notice } from "./slack.ts";

export type AcContact = { id: string; email: string; firstName?: string; phone?: string; cdate: string };
/** The lists whose emails carry %WEBINARJOINLINK%: 4740 "AI For Agents Masterclass" and 4743 "30 day openers". */
export const LINK_LISTS = ["4740", "4743"];
export type LinkTask = { contact: AcContact; email: string; token: string | null };

/** Which contacts need a write: a tagged contact with an email, not a test sample, whose join field is not already a personal link. `token` is the room's when the email has a row; null means a row must be created first. */
export function linkPlan(contacts: AcContact[], fields: Map<string, { join?: { id: string; value: string } }>, tokenByEmail: Map<string, string>): LinkTask[] {
  const out: LinkTask[] = [];
  for (const c of contacts) {
    // The same rules as a registration: a real address, lowercased; nothing from ActiveCampaign reaches the room's tables raw (security pass, Oct 22).
    const email = normalizeEmail(c.email);
    if (!email || isTestIdentity(email)) continue;
    const f = fields.get(c.id);
    if (PERSONAL_RE.test(f?.join?.value ?? "")) continue;
    out.push({ contact: c, email, token: tokenByEmail.get(email) ?? null });
  }
  return out;
}

/** The session date for a row the sweep creates: the contact's ActiveCampaign session date when it is past ("10/18/2026" or ISO), else the contact's created day, never today or later (yesterday at the latest). */
export function sessionDateFor(acSessionDate: string | undefined, cdate: string, todayIso: string): string {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(acSessionDate ?? "");
  const iso = m ? `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}` : /^\d{4}-\d{2}-\d{2}/.test(acSessionDate ?? "") ? (acSessionDate as string).slice(0, 10) : cdate.slice(0, 10);
  if (iso < todayIso) return iso;
  const d = new Date(`${todayIso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** The slot a run belongs to in the event's zone: the 3 AM slot from 3 to 14 o'clock, the 3 PM slot from 15 on, none in the small hours. Recorded on the event so each slot runs once and a failed run is retried the next hour. */
export function linkSlot(now: Date, tz = "America/Edmonton"): string | null {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const hour = Number(get("hour")) % 24;
  const day = `${get("year")}-${get("month")}-${get("day")}`;
  return hour >= 15 ? `${day}T15` : hour >= 3 ? `${day}T03` : null;
}

/** The contact listings a sweep reads: full, every tagged contact and every active list member; incremental, the tagged contacts created and the list members updated since `since` (YYYY-MM-DD). */
export function linkSources(full: boolean, since: string): string[] {
  return full
    ? [`/contacts?tagid=${REGISTERED_TAG_ID}&orders[cdate]=DESC`, ...LINK_LISTS.map((l) => `/contacts?listid=${l}&status=1&orders[cdate]=DESC`)]
    : [`/contacts?tagid=${REGISTERED_TAG_ID}&filters[created_after]=${since}&orders[cdate]=DESC`, ...LINK_LISTS.map((l) => `/contacts?listid=${l}&status=1&filters[updated_after]=${since}&orders[cdate]=DESC`)];
}

export type SweepResult = { scanned: number; pending: number; written: number; created: number; failed: number; truncated: boolean; sample: string[]; /** full (every contact) or the days of the incremental window */ scope: string };

async function allPages<T>(path: string, pick: (page: unknown) => T[]): Promise<T[]> {
  const out: T[] = [];
  for (let off = 0; ; off += 100) {
    const page = await acApi<unknown>(`${path}${path.includes("?") ? "&" : "?"}limit=100&offset=${off}`);
    if (!page) throw new Error(`ActiveCampaign read failed: ${path}`);
    const rows = pick(page);
    out.push(...rows);
    if (rows.length < 100) return out;
  }
}

const dayIso = (d: Date, tz: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(d);

/**
 * One sweep. The join field is read in bulk (140 pages, about a minute: the one listing every mode needs); the contacts
 * come from the tag and the two lists, all of them in `full` mode (the by-hand run: 14,789 contacts, 241 s of reads on
 * Oct 22, too slow for the cron) or, in the cron's incremental mode, the tagged contacts created in the last `sinceDays`
 * plus the list members updated in that window (a contact added to "30 day openers" is an update). The plan is every
 * contact whose join field is not a personal link; the writes go newest first until the budget is spent, each with one
 * read of the contact's own field values (the replay field's id), a room row when the email has none, and both links.
 */
export async function sweepLinks(opts: { apply: boolean; budgetMs?: number; eventSlug?: string; now?: Date; full?: boolean; sinceDays?: number }): Promise<SweepResult> {
  const t0 = Date.now();
  const budget = opts.budgetMs ?? 240_000;
  const now = opts.now ?? new Date();
  const ev = await db().from("events").select("id, timezone").eq("slug", opts.eventSlug ?? "ailg-r").maybeSingle();
  if (!ev.data) throw new Error("event not found");
  const eventId = ev.data.id as string;
  const tz = (ev.data.timezone as string) || "America/Edmonton";
  type FV = { id: string; contact: string; field: string; value: string };
  const fields = new Map<string, { join?: { id: string; value: string }; replay?: { id: string } }>();
  for (const r of await allPages<FV>(`/fieldValues?filters[fieldid]=${JOIN_FIELD}`, (p) => ((p as { fieldValues?: FV[] }).fieldValues ?? []))) fields.set(r.contact, { join: { id: r.id, value: r.value } });
  const days = opts.sinceDays ?? 3;
  const since = dayIso(new Date(now.getTime() - days * 86_400_000), tz);
  const sources = linkSources(Boolean(opts.full), since);
  const byId = new Map<string, AcContact>();
  for (const path of sources) for (const c of await allPages<AcContact>(path, (p) => ((p as { contacts?: AcContact[] }).contacts ?? []))) if (!byId.has(c.id)) byId.set(c.id, c);
  const contacts = [...byId.values()].sort((a, b) => (a.cdate < b.cdate ? 1 : -1));
  const tokenByEmail = new Map<string, string>();
  const rows = await pageAll<{ email: string; token: string }>((from, to) => db().from("registrants").select("email, token").eq("event_id", eventId).not("email", "is", null).order("created_at", { ascending: false }).range(from, to));
  for (const r of rows) { const e = r.email.toLowerCase(); if (!tokenByEmail.has(e)) tokenByEmail.set(e, r.token); }
  const plan = linkPlan(contacts, fields, tokenByEmail);
  const result: SweepResult = { scanned: contacts.length, pending: plan.length, written: 0, created: 0, failed: 0, truncated: false, sample: plan.slice(0, 10).map((t) => t.email), scope: opts.full ? "full" : `${days} days` };
  if (!opts.apply) return result;
  const today = dayIso(now, tz);
  for (const t of plan) {
    if (Date.now() - t0 > budget) { result.truncated = true; break; }
    try {
      let token = t.token;
      if (!token) {
        token = newToken();
        // Dated at least 9 days back: outside the outcome push's 8-day window, so a list member who never registered is never tagged missed; a click moves the row into the running session and the tags start from there.
        const dated = sessionDateFor(undefined, t.contact.cdate, today);
        const floor = dayIso(new Date(now.getTime() - 9 * 86_400_000), tz);
        const ins = await db().from("registrants").insert({ event_id: eventId, session_date: dated < floor ? dated : floor, token, first_name: cleanName(t.contact.firstName ?? "") ?? nameFromEmail(t.email), email: t.email, email_hash: emailHash(t.email), phone: (t.contact.phone ?? "").trim().slice(0, 32) || null, source: "legacy", attribution: { ac_sweep: today, ac_contact: t.contact.id } }).select("token").single();
        if (ins.error) {
          const again = await db().from("registrants").select("token").eq("event_id", eventId).eq("email", t.email).order("created_at", { ascending: false }).limit(1).maybeSingle();
          if (!again.data) throw new Error(`insert failed: ${ins.error.message}`);
          token = again.data.token as string;
        } else result.created += 1;
        tokenByEmail.set(t.email, token);
      }
      // The contact's own field rows: the replay field's id (not in the bulk read) and the join field's, fresh.
      const have = (await acApi<{ fieldValues: FV[] }>(`/contacts/${t.contact.id}/fieldValues`))?.fieldValues ?? [];
      const links = watchLinks(token);
      // The join field is the "done" marker linkPlan reads, so it is written last: a replay write that fails leaves the contact pending for the next pass.
      for (const [field, value] of [[REPLAY_FIELD, links.replay], [JOIN_FIELD, links.join]] as const) {
        const existing = have.find((f) => f.field === field);
        const body = JSON.stringify({ fieldValue: { contact: t.contact.id, field, value } });
        const r = existing ? await acApi(`/fieldValues/${existing.id}`, { method: "PUT", body }) : await acApi("/fieldValues", { method: "POST", body });
        if (!r) throw new Error(`field ${field} write failed for contact ${t.contact.id}`);
      }
      result.written += 1;
    } catch (err) {
      result.failed += 1;
      console.error("[ac-links] contact failed", { contact: t.contact.id, err: String(err) });
    }
  }
  return result;
}

/** After a run (SPEC-friday-unattended.md, E4; Oct 26 2026: green is silent): nothing when every contact ends up with a link (a repair is the sweep working; the 9 AM digest's thread carries the count), a 🚨 when contacts are still blank or writes failed. */
export function sweepNotice(r: SweepResult, slot: string | null): Notice | null {
  const left = r.pending - r.written;
  if (left === 0 && !r.failed) return null;
  const contacts = (n: number) => `${n} contact${n === 1 ? "" : "s"}`;
  return {
    kind: "alert",
    headline: left > 0 ? `Links sweep: ${contacts(left)} still ${left === 1 ? "has" : "have"} no personal link` : `Links sweep: ${contacts(r.written)} had no personal link, repaired`,
    numbers: [`${r.written} repaired`, `${r.created} room rows created`, `${left} of ${r.scanned} checked still blank`],
    note: [`${slot ?? "forced"} sweep, ${r.scope}`, ...(r.failed ? [`${r.failed} failed`] : []), ...(r.truncated ? ["budget hit, the next run continues"] : [])].join(" · "),
  };
}

export function sweepFailedNotice(err: string): Notice {
  return { kind: "alert", headline: "Links sweep failed: contacts may get a blank promo", note: `${err.slice(0, 120)} · next try in an hour` };
}
