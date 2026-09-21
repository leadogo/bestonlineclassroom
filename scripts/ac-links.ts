// Replaces EasyWebinar links on ActiveCampaign contacts with ours (William, 2026-09-20 late). For every contact
// in the list whose join-link fields hold an easywebinar link: a registrant we know gets their own room and
// replay links; anyone else gets the open link with their email hash, which lets them in (name prompt if we
// don't know them). Run: npm run ac:links -- --list 4740 [--dry] [--max 500]
import { parseArgs } from "node:util";
import { db } from "../src/lib/db.ts";
import { emailHash, joinUrl, normalizeEmail, replayUrl } from "../src/lib/registrants.ts";

const { values } = parseArgs({ options: { list: { type: "string", default: "4740" }, dry: { type: "boolean", default: false }, max: { type: "string" } } });
const BASE = (process.env.ACTIVECAMPAIGN_API_URL ?? "").replace(/\/$/, "");
const KEY = process.env.ACTIVECAMPAIGN_API_KEY ?? "";
if (!BASE || !KEY) throw new Error("ActiveCampaign env missing");
const APP = (process.env.NEXT_PUBLIC_APP_URL ?? "https://bestonlineclassroom.com").replace(/\/$/, "");
const JOIN_FIELDS = ["47", "14"]; // WebinarJoinLink, joinURL
const REPLAY_FIELDS = ["49", "15"]; // ReplayLink, replayURL
const max = values.max ? Number(values.max) : Infinity;

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}/api/3${path}`, { ...init, headers: { "Api-Token": KEY, "content-type": "application/json" } });
  if (!res.ok) throw new Error(`${path} → ${res.status} ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as T;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Contact = { id: string; email: string; fieldValues?: string[] };
type FieldValue = { id: string; contact: string; field: string; value: string };

// Our registrants by email: the latest row per email
const ours = new Map<string, { token: string }>();
for (let from = 0; ; from += 1000) {
  const { data, error } = await db().from("registrants").select("email, token, created_at").not("email", "is", null).order("created_at", { ascending: false }).range(from, from + 999);
  if (error) throw error;
  for (const r of data ?? []) if (r.email && !ours.has(r.email)) ours.set(r.email, { token: r.token });
  if (!data || data.length < 1000) break;
}
console.log(`ours: ${ours.size} emails`);

let scanned = 0;
let changed = 0;
let own = 0;
let open = 0;
for (let offset = 0; ; offset += 100) {
  const page = await api<{ contacts: Contact[]; fieldValues?: FieldValue[]; meta: { total: string } }>(`/contacts?listid=${values.list}&limit=100&offset=${offset}&include=fieldValues`);
  if (page.contacts.length === 0) break;
  const fvByContact = new Map<string, FieldValue[]>();
  for (const fv of page.fieldValues ?? []) fvByContact.set(fv.contact, [...(fvByContact.get(fv.contact) ?? []), fv]);
  for (const c of page.contacts) {
    scanned += 1;
    if (changed >= max) break;
    const email = normalizeEmail(c.email);
    if (!email) continue;
    const fvs = fvByContact.get(c.id) ?? [];
    const joinOld = fvs.filter((f) => JOIN_FIELDS.includes(f.field) && /easywebinar/i.test(f.value));
    const replayOld = fvs.filter((f) => REPLAY_FIELDS.includes(f.field) && /easywebinar/i.test(f.value));
    if (joinOld.length === 0 && replayOld.length === 0) continue;
    const mine = ours.get(email);
    const join = mine ? joinUrl(mine.token) : `${APP}/w/ailg-r?src=email&eh=${emailHash(email)}`;
    const replay = mine ? replayUrl(mine.token) : "";
    const fieldValues = [...joinOld.map((f) => ({ field: f.field, value: join })), ...(replay ? replayOld.map((f) => ({ field: f.field, value: replay })) : [])];
    if (fieldValues.length === 0) continue;
    if (mine) own += 1;
    else open += 1;
    changed += 1;
    if (values.dry) continue;
    await api("/contact/sync", { method: "POST", body: JSON.stringify({ contact: { email, fieldValues } }) });
    await sleep(220);
  }
  if (changed >= max) break;
  if (scanned >= Number(page.meta.total)) break;
  await sleep(220);
}
console.log(`${values.dry ? "would change" : "changed"} ${changed} of ${scanned} scanned: ${own} with their own room link, ${open} with the open link`);
