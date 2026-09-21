// Registrants from before the cutover, so their links keep working as if they were ours (William, 2026-09-20).
// EasyWebinar's registrant list (name, email, phone, date) joined with leadogo's opt-in events (the site's
// registration id, by email hash), upserted as `legacy` registrants for their session. Nothing is emailed or
// tagged here. Run: npm run import:legacy -- --from 2026-09-21 [--dry]
//   needs EASYWEBINAR_API_KEY, LEADOGO_SUPABASE_URL and LEADOGO_SUPABASE_KEY in the environment.
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { db } from "../src/lib/db.ts";
import { AILG_R, localDate } from "../src/lib/daily-schedule.ts";
import { emailHash, newToken, normalizeEmail } from "../src/lib/registrants.ts";

const { values } = parseArgs({ options: { event: { type: "string", default: "ailg-r" }, from: { type: "string" }, dry: { type: "boolean", default: false } } });
if (!values.from) throw new Error("--from YYYY-MM-DD (earliest local session date to import)");
const EW_KEY = process.env.EASYWEBINAR_API_KEY ?? "";
const WEBINAR = process.env.EASYWEBINAR_WEBINAR_ID ?? "206685";
if (!EW_KEY) throw new Error("EASYWEBINAR_API_KEY missing");

type EwRow = { first_name: string; last_name: string; email: string; phone: string; webinar_date: string; webinar_time: string; create_time: string };

// 1. EasyWebinar, newest first, until the dates fall before --from
const rows: EwRow[] = [];
for (let page = 1; page <= 30; page++) {
  const res = await fetch(`https://app.easywebinar.com/v1/easywebinar/v1/webinar/registrants?webinar_id=${WEBINAR}&page=${page}`, { headers: { "x-api-key": EW_KEY, "webinar-id": WEBINAR } });
  if (!res.ok) throw new Error(`EasyWebinar ${res.status}`);
  const body = (await res.json()) as { data?: { registrants?: EwRow[] } };
  const batch = body.data?.registrants ?? [];
  if (batch.length === 0) break;
  rows.push(...batch);
  const oldest = batch.map((r) => r.webinar_date).sort()[0];
  if (oldest < values.from) break;
}
const sessionOf = (r: EwRow) => localDate(AILG_R, new Date(`${r.webinar_date}T${r.webinar_time}Z`));
const wanted = rows
  .map((r) => ({ ...r, email: normalizeEmail(r.email), session_date: sessionOf(r) }))
  .filter((r) => r.email && r.session_date >= values.from! && !/@thefuturerealestateagent\.com$/i.test(r.email));
console.log(`EasyWebinar: ${rows.length} fetched, ${wanted.length} with a session on or after ${values.from}`);

// 2. leadogo: the site's registration id per email hash
const ridByHash = new Map<string, string>();
if (process.env.LEADOGO_SUPABASE_URL && process.env.LEADOGO_SUPABASE_KEY) {
  const lg = createClient(process.env.LEADOGO_SUPABASE_URL, process.env.LEADOGO_SUPABASE_KEY, { auth: { persistSession: false } });
  const { data, error } = await lg.from("funnel_page_events").select("registration_id, email_hash").eq("event", "optin").eq("environment", "production").gte("occurred_at", "2026-09-19").not("email_hash", "is", null).limit(5000);
  if (error) throw error;
  for (const e of data ?? []) if (e.email_hash && e.registration_id) ridByHash.set(e.email_hash as string, e.registration_id as string);
  console.log(`leadogo: ${ridByHash.size} opt-ins with a registration id`);
} else console.log("leadogo keys not set: importing without registration ids");

// 3. upsert ours
const { data: event } = await db().from("events").select("id").eq("slug", values.event!).single();
if (!event) throw new Error("event not found");
let created = 0;
let existing = 0;
let matched = 0;
for (const r of wanted) {
  const email = r.email as string;
  const hash = emailHash(email);
  const rid = ridByHash.get(hash) ?? null;
  if (rid) matched += 1;
  const have = await db().from("registrants").select("id, site_registration_id").eq("event_id", event.id).eq("session_date", r.session_date).eq("email", email).maybeSingle();
  if (have.data) {
    existing += 1;
    if (rid && !have.data.site_registration_id && !values.dry) await db().from("registrants").update({ site_registration_id: rid }).eq("id", have.data.id);
    continue;
  }
  if (values.dry) {
    created += 1;
    continue;
  }
  const { error } = await db().from("registrants").insert({ event_id: event.id, session_date: r.session_date, token: newToken(), first_name: (r.first_name || "there").trim().slice(0, 60), email, email_hash: hash, phone: r.phone || null, source: "legacy", site_registration_id: rid, created_at: r.create_time ? new Date(r.create_time.replace(" ", "T") + "Z").toISOString() : undefined });
  if (error) console.error("insert failed", email.replace(/^(.).*@/, "$1…@"), error.message);
  else created += 1;
}
console.log(`${values.dry ? "would create" : "created"} ${created}, already had ${existing}, ${matched} with the site's registration id`);
