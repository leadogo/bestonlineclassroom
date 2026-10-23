// Every ActiveCampaign contact who registered holds a personal watch link (SPEC-friday-unattended.md, E2). The sweep
// behind /api/cron/ac-links: the tagged contacts whose WebinarJoinLink is not a personal link get one, and a contact the
// room has never seen gets a room row first (source legacy, dated yesterday, so tonight's count and the reminders are
// untouched until they click). Oct 22: 79 of 13,964 tagged contacts had none; Theresa King's promo read "Webinar Link:"
// with nothing after it. The pure parts (the plan, the session date) are tested; the sweep reads and writes.
// ponytail: scripts/ac-personal-links.ts still holds the by-hand version of this; delete it once the cron has run clean.
import { acApi, JOIN_FIELD, PERSONAL_RE, REGISTERED_TAG_ID, REPLAY_FIELD, watchLinks } from "./activecampaign.ts";
import { db, pageAll } from "./db.ts";
import { emailHash, isTestIdentity, newToken } from "./registrants.ts";

export type AcContact = { id: string; email: string; firstName?: string; phone?: string; cdate: string };
/** The lists whose emails carry %WEBINARJOINLINK%: 4740 "AI For Agents Masterclass" and 4743 "30 day openers". */
export const LINK_LISTS = ["4740", "4743"];
export type LinkTask = { contact: AcContact; email: string; token: string | null; join?: { id: string } ; replay?: { id: string } };

/** Which contacts need a write: a tagged contact with an email, not a test sample, whose join field is not already a personal link. `token` is the room's when the email has a row; null means a row must be created first. */
export function linkPlan(contacts: AcContact[], fields: Map<string, { join?: { id: string; value: string }; replay?: { id: string } }>, tokenByEmail: Map<string, string>): LinkTask[] {
  const out: LinkTask[] = [];
  for (const c of contacts) {
    const email = (c.email ?? "").trim().toLowerCase();
    if (!email || isTestIdentity(email)) continue;
    const f = fields.get(c.id);
    if (PERSONAL_RE.test(f?.join?.value ?? "")) continue;
    out.push({ contact: c, email, token: tokenByEmail.get(email) ?? null, join: f?.join, replay: f?.replay });
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

export type SweepResult = { scanned: number; pending: number; written: number; created: number; failed: number; truncated: boolean; sample: string[] };

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

/** One sweep: reads the join and replay field values and the tagged contacts, plans, and (when `apply`) creates the missing room rows and writes both links, newest contacts first, until the budget is spent. */
export async function sweepLinks(opts: { apply: boolean; budgetMs?: number; eventSlug?: string; now?: Date }): Promise<SweepResult> {
  const t0 = Date.now();
  const budget = opts.budgetMs ?? 240_000;
  const ev = await db().from("events").select("id, timezone").eq("slug", opts.eventSlug ?? "ailg-r").maybeSingle();
  if (!ev.data) throw new Error("event not found");
  const eventId = ev.data.id as string;
  type FV = { id: string; contact: string; field: string; value: string };
  const fields = new Map<string, { join?: { id: string; value: string }; replay?: { id: string }; session?: string }>();
  const fold = (rows: FV[], slot: "join" | "replay") => { for (const r of rows) { const o = fields.get(r.contact) ?? {}; o[slot] = { id: r.id, value: r.value }; fields.set(r.contact, o); } };
  fold(await allPages<FV>(`/fieldValues?filters[fieldid]=${JOIN_FIELD}`, (p) => ((p as { fieldValues?: FV[] }).fieldValues ?? [])), "join");
  fold(await allPages<FV>(`/fieldValues?filters[fieldid]=${REPLAY_FIELD}`, (p) => ((p as { fieldValues?: FV[] }).fieldValues ?? [])), "replay");
  // The scope (SPEC-friday-unattended.md, E2): every registered contact (the tag) and every active member of the two lists the webinar emails go to. Oct 22: list 4743 "30 day openers" (Tuesday's email) held 823 contacts with no link, 399 of the first 400 untagged.
  const byId = new Map<string, AcContact>();
  for (const path of [`/contacts?tagid=${REGISTERED_TAG_ID}&orders[cdate]=DESC`, ...LINK_LISTS.map((l) => `/contacts?listid=${l}&status=1&orders[cdate]=DESC`)]) {
    for (const c of await allPages<AcContact>(path, (p) => ((p as { contacts?: AcContact[] }).contacts ?? []))) if (!byId.has(c.id)) byId.set(c.id, c);
  }
  const contacts = [...byId.values()].sort((a, b) => (a.cdate < b.cdate ? 1 : -1));
  const tokenByEmail = new Map<string, string>();
  const rows = await pageAll<{ email: string; token: string }>((from, to) => db().from("registrants").select("email, token").eq("event_id", eventId).not("email", "is", null).order("created_at", { ascending: false }).range(from, to));
  for (const r of rows) { const e = r.email.toLowerCase(); if (!tokenByEmail.has(e)) tokenByEmail.set(e, r.token); }
  const plan = linkPlan(contacts, fields, tokenByEmail);
  const result: SweepResult = { scanned: contacts.length, pending: plan.length, written: 0, created: 0, failed: 0, truncated: false, sample: plan.slice(0, 10).map((t) => t.email) };
  if (!opts.apply) return result;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: (ev.data.timezone as string) || "America/Edmonton" }).format(opts.now ?? new Date());
  for (const t of plan) {
    if (Date.now() - t0 > budget) { result.truncated = true; break; }
    try {
      let token = t.token;
      if (!token) {
        token = newToken();
        const ins = await db().from("registrants").insert({ event_id: eventId, session_date: sessionDateFor(undefined, t.contact.cdate, today), token, first_name: (t.contact.firstName || t.email.split("@")[0]).slice(0, 80), email: t.email, email_hash: emailHash(t.email), phone: t.contact.phone || null, source: "legacy", attribution: { ac_sweep: today, ac_contact: t.contact.id } }).select("token").single();
        if (ins.error) {
          const again = await db().from("registrants").select("token").eq("event_id", eventId).eq("email", t.email).order("created_at", { ascending: false }).limit(1).maybeSingle();
          if (!again.data) throw new Error(`insert failed: ${ins.error.message}`);
          token = again.data.token as string;
        } else result.created += 1;
        tokenByEmail.set(t.email, token);
      }
      const links = watchLinks(token);
      const write = async (field: string, value: string, have?: { id: string }) => {
        const r = have ? await acApi(`/fieldValues/${have.id}`, { method: "PUT", body: JSON.stringify({ fieldValue: { contact: t.contact.id, field, value } }) }) : await acApi("/fieldValues", { method: "POST", body: JSON.stringify({ fieldValue: { contact: t.contact.id, field, value } }) });
        if (!r) throw new Error(`field ${field} write failed for contact ${t.contact.id}`);
      };
      await write(JOIN_FIELD, links.join, t.join);
      await write(REPLAY_FIELD, links.replay, t.replay);
      result.written += 1;
    } catch (err) {
      result.failed += 1;
      console.error("[ac-links] contact failed", { contact: t.contact.id, err: String(err) });
    }
  }
  return result;
}

/** The Slack line after a run (SPEC-friday-unattended.md, E4). */
export function sweepLine(r: SweepResult, slot: string | null): string {
  const left = r.pending - r.written;
  const head = left === 0 ? "Links OK" : "Links: still blank";
  return `${head} (${slot ?? "forced"} sweep): ${r.written} repaired, ${r.created} room rows created, ${left} of ${r.scanned} tagged contacts still without a personal link${r.failed ? `, ${r.failed} failed` : ""}${r.truncated ? ", budget hit, the next run continues" : ""}.`;
}
