// William's grades from the review page into her knowledge (SPEC-friday-unattended.md, A): each "wrong" with his line
// becomes the approved answer under the key named in the fixes file (his words verbatim, approved on the spot, by his
// seat). A key that exists keeps its question and counts; a new key gets the question from the file.
// Run: doppler run -p bestonlineclassroom -c prd -- node --no-warnings scripts/kaitlyn-review-apply.ts --fixes <file.json> [--apply]
// The file: [{ "key": "crm-recommend", "question": "...", "answer": "his words", "from": "r1-45" }, ...]
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { db } from "../src/lib/db.ts";
import { KB_KEY_RE } from "../src/lib/kaitlyn-kb.ts";

const { values } = parseArgs({ options: { fixes: { type: "string" }, apply: { type: "boolean", default: false }, event: { type: "string", default: "ailg-r" }, seat: { type: "string", default: "william@leadogo.com" } } });
if (!values.fixes) throw new Error("--fixes <file.json>");
const fixes = JSON.parse(readFileSync(values.fixes, "utf8")) as Array<{ key: string; question: string; answer: string; from?: string }>;
const ev = (await db().from("events").select("id").eq("slug", values.event!).maybeSingle()).data;
if (!ev) throw new Error(`event ${values.event} not found`);
const seat = (await db().from("team_members").select("id").eq("email", values.seat!).maybeSingle()).data;
if (!seat) throw new Error(`seat ${values.seat} not found`);
const now = new Date().toISOString();
for (const f of fixes) {
  if (!KB_KEY_RE.test(f.key)) throw new Error(`bad key ${f.key}`);
  const have = (await db().from("kaitlyn_kb").select("key, question, approved").eq("event_id", ev.id).eq("key", f.key).maybeSingle()).data;
  const answer = f.answer.trim();
  console.log(`${have ? "update" : "insert"} ${f.key} (${f.from ?? "-"})${have?.approved ? `\n   was: ${String(have.approved).slice(0, 120)}` : ""}\n   now: ${answer.slice(0, 120)}`);
  if (!values.apply) continue;
  const row = { answer, approved: answer, approved_at: now, answered_at: now, answered_by: seat.id, handling: "answer", updated_at: now };
  const { error } = have
    ? await db().from("kaitlyn_kb").update(row).eq("event_id", ev.id).eq("key", f.key)
    : await db().from("kaitlyn_kb").insert({ event_id: ev.id, key: f.key, question: f.question, asked: 1, last_asked_at: now, ...row });
  if (error) throw new Error(`${f.key}: ${error.message}`);
}
console.log(values.apply ? `${fixes.length} answers written` : "dry run; pass --apply to write");
