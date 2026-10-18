// Give every ActiveCampaign contact who registered through EasyWebinar their OWN room link
// (SPEC-show-rate-recovery.md, William Oct 18: "anybody with EasyWebinar links needs their own unique link that works
// no matter how far ahead they click it"). A personal link never expires: the room moves the person to the session
// running now, or the next one.
//
//   doppler run -- node scripts/ac-personal-links.ts                 # dry run: counts only
//   doppler run -- node scripts/ac-personal-links.ts --apply         # create registrants + write links
//   --since 2026-08-01   --tag 304 (ailgr_registered)   --limit N   --plan FILE
//
// For each contact with the tag, created since --since, whose WebinarJoinLink is not already a personal watch link:
// reuse the room registrant with that email (any session) or insert one (source 'legacy', session_date = the AC
// WebinarSessionDate when it is in the past, else the contact's created day, never today or later, so tonight's
// registered count is untouched and no reminder fires until they click), then write
//   WebinarJoinLink = https://watch.bookmoreshowings.com/<token>
//   ReplayLink      = https://watch.bookmoreshowings.com/replay/<token>
// No confirmation email is sent: this is a link repair, not a registration moment.
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";

const base = (process.env.ACTIVECAMPAIGN_API_URL ?? "").replace(/\/$/, "");
const key = process.env.ACTIVECAMPAIGN_API_KEY ?? "";
const sbUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
if (!base || !key || !sbUrl || !sbKey) throw new Error("ActiveCampaign / Supabase env missing (run under doppler)");

const WATCH = "https://watch.bookmoreshowings.com";
const PERSONAL = /^https:\/\/watch\.bookmoreshowings\.com\/([abcdefghjkmnpqrstuvwxyz23456789]{12})$/;
const JOIN_FIELD = "47", REPLAY_FIELD = "49";
const args = process.argv.slice(2);
const apply = args.includes("--apply");
const opt = (n: string, d: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const since = opt("--since", "2026-08-01");
const tagId = opt("--tag", "304");
const limit = Number(opt("--limit", "Infinity"));
const planPath = opt("--plan", "");
const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Edmonton" });

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const newToken = () => { const b = randomBytes(12); let s = ""; for (let i = 0; i < 12; i++) s += ALPHABET[b[i] % ALPHABET.length]; return s; };
const emailHash = (e: string) => createHash("sha256").update(e.trim().toLowerCase()).digest("hex");
const sleep = (ms: number) => new Promise((f) => setTimeout(f, ms));
async function ac(path: string, init?: RequestInit, retried = false): Promise<any> {
  const r = await fetch(`${base}/api/3${path}`, { ...init, headers: { "Api-Token": key, "content-type": "application/json" } });
  if (r.status === 429 && !retried) { await sleep(1500); return ac(path, init, true); } // AC allows 5 requests a second; one breath, one retry
  if (!r.ok) throw new Error(`${init?.method ?? "GET"} ${path} → ${r.status} ${(await r.text()).slice(0, 160)}`);
  return r.json();
}
async function allPages<T>(path: string, pick: (page: any) => T[]): Promise<T[]> {
  const out: T[] = [];
  for (let off = 0; ; off += 100) {
    const page = await ac(`${path}${path.includes("?") ? "&" : "?"}limit=100&offset=${off}`);
    const rows = pick(page); out.push(...rows);
    if (rows.length < 100) break;
    await sleep(120);
  }
  return out;
}
/** "10/18/2026" or "2026-10-18" → "2026-10-18", else null. */
export function sessionDateFor(acSessionDate: string | undefined, cdate: string, todayIso: string): string {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(acSessionDate ?? "");
  const iso = m ? `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}` : /^\d{4}-\d{2}-\d{2}/.test(acSessionDate ?? "") ? (acSessionDate as string).slice(0, 10) : cdate.slice(0, 10);
  if (iso < todayIso) return iso;
  const d = new Date(`${todayIso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const db = createClient(sbUrl, sbKey);
  const ev = await db.from("events").select("id").eq("slug", "ailg-r").single();
  if (ev.error || !ev.data) throw new Error("event ailg-r not found");
  const eventId = ev.data.id as string;

  const contacts = await allPages<{ id: string; email: string; firstName: string; phone: string; cdate: string }>(`/contacts?tagid=${tagId}&filters[created_after]=${since}`, (p) => p.contacts ?? []);
  console.log(`contacts with tag ${tagId} created since ${since}: ${contacts.length}`);
  const fields = await ac("/fields?limit=100");
  const sessionFieldId = ((fields.fields ?? []) as Array<{ id: string; perstag: string }>).find((f) => f.perstag === "WEBINARSESSIONDATE")?.id;
  const byContact = new Map<string, { join?: { id: string; value: string }; replay?: { id: string; value: string }; session?: string }>();
  const fold = (rows: Array<{ id: string; contact: string; value: string }>, slot: "join" | "replay" | "session") => {
    for (const r of rows) { const o = byContact.get(r.contact) ?? {}; if (slot === "session") o.session = r.value; else o[slot] = { id: r.id, value: r.value }; byContact.set(r.contact, o); }
  };
  fold(await allPages(`/fieldValues?filters[fieldid]=${JOIN_FIELD}`, (p) => p.fieldValues ?? []), "join");
  fold(await allPages(`/fieldValues?filters[fieldid]=${REPLAY_FIELD}`, (p) => p.fieldValues ?? []), "replay");
  if (sessionFieldId) fold(await allPages(`/fieldValues?filters[fieldid]=${sessionFieldId}`, (p) => p.fieldValues ?? []), "session");

  // Every room registrant for the event, newest first per email: a person who already has a token keeps it.
  const tokenByEmail = new Map<string, string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("registrants").select("email, token, created_at").eq("event_id", eventId).not("email", "is", null).order("created_at", { ascending: false }).range(from, from + 999);
    if (error) throw new Error(error.message);
    for (const r of data ?? []) { const e = String(r.email).toLowerCase(); if (!tokenByEmail.has(e)) tokenByEmail.set(e, r.token as string); }
    if (!data || data.length < 1000) break;
  }

  const todo = contacts.filter((c) => c.email && !/-test-sample@/.test(c.email) && !PERSONAL.test(byContact.get(c.id)?.join?.value ?? ""));
  const haveToken = todo.filter((c) => tokenByEmail.has(c.email.toLowerCase())).length;
  console.log(`need a personal link: ${todo.length} (already registered in the room: ${haveToken}, to create: ${todo.length - haveToken})`);
  const kinds: Record<string, number> = {};
  for (const c of todo) { const v = byContact.get(c.id)?.join?.value ?? ""; const k = /easywebinar/i.test(v) ? "easywebinar" : /\/w\/ailg-r/.test(v) ? "generic" : v ? "other" : "empty"; kinds[k] = (kinds[k] ?? 0) + 1; }
  console.log("current join link kinds:", JSON.stringify(kinds));
  if (!apply) { console.log("dry run; pass --apply to write"); return; }

  const plan: Array<Record<string, string>> = [];
  let created = 0, written = 0, failed = 0;
  for (const c of todo.slice(0, Number.isFinite(limit) ? limit : undefined)) {
    try {
      const email = c.email.toLowerCase();
      let token = tokenByEmail.get(email);
      if (!token) {
        const sessionDate = sessionDateFor(byContact.get(c.id)?.session, c.cdate, today);
        token = newToken();
        const ins = await db.from("registrants").insert({ event_id: eventId, session_date: sessionDate, token, first_name: (c.firstName || email.split("@")[0]).slice(0, 80), email, email_hash: emailHash(email), phone: c.phone || null, source: "legacy", attribution: { ac_backfill: today, ac_contact: c.id } }).select("token").single();
        if (ins.error) {
          const again = await db.from("registrants").select("token").eq("event_id", eventId).eq("email", email).order("created_at", { ascending: false }).limit(1).maybeSingle();
          if (!again.data) throw new Error(`insert failed: ${ins.error.message}`);
          token = again.data.token as string;
        } else created++;
        tokenByEmail.set(email, token);
      }
      const joinNext = `${WATCH}/${token}`, replayNext = `${WATCH}/replay/${token}`;
      const cur = byContact.get(c.id) ?? {};
      plan.push({ contact: c.id, joinFrom: cur.join?.value ?? "", joinTo: joinNext, replayFrom: cur.replay?.value ?? "", replayTo: replayNext });
      if (cur.join) await ac(`/fieldValues/${cur.join.id}`, { method: "PUT", body: JSON.stringify({ fieldValue: { contact: c.id, field: JOIN_FIELD, value: joinNext } }) });
      else await ac(`/fieldValues`, { method: "POST", body: JSON.stringify({ fieldValue: { contact: c.id, field: JOIN_FIELD, value: joinNext } }) });
      await sleep(210);
      if (cur.replay) await ac(`/fieldValues/${cur.replay.id}`, { method: "PUT", body: JSON.stringify({ fieldValue: { contact: c.id, field: REPLAY_FIELD, value: replayNext } }) });
      else await ac(`/fieldValues`, { method: "POST", body: JSON.stringify({ fieldValue: { contact: c.id, field: REPLAY_FIELD, value: replayNext } }) });
      written++;
    } catch (e) { failed++; console.error(`contact ${c.id}: ${(e as Error).message}`); }
    if ((written + failed) % 250 === 0) console.log(`…${written} contacts written, ${created} registrants created, ${failed} failed`);
    await sleep(210);
  }
  if (planPath) await writeFile(planPath, JSON.stringify(plan));
  console.log(`done: ${written} contacts written, ${created} registrants created, ${failed} failed${planPath ? `, plan ${planPath}` : ""}`);
}
if (/ac-personal-links/.test(process.argv[1] ?? "")) main().catch((e) => { console.error(e.message); process.exit(1); });
