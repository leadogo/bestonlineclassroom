// Loads the simulated chat for an event from EasyWebinar's CSV and sets the simulated attendee names from it.
// Replaces what was there. Run: npm run import:chat -- --event ailg-r --file "~/Downloads/chat.csv"
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { db } from "../src/lib/db.ts";
import { distinctNames, parseChatCsv } from "../src/lib/csv.ts";

const { values } = parseArgs({ options: { event: { type: "string", default: "ailg-r" }, file: { type: "string" } } });
if (!values.file) throw new Error("--file <csv> is required");

const rows = parseChatCsv(readFileSync(values.file.replace(/^~/, process.env.HOME ?? ""), "utf8"));
const names = distinctNames(rows);
if (rows.length === 0) throw new Error("No messages parsed");

const { data: event, error: e1 } = await db().from("events").select("id").eq("slug", values.event!).single();
if (e1 || !event) throw e1 ?? new Error("event not found; run the seed first");

const { error: e2 } = await db().from("simulated_messages").delete().eq("event_id", event.id);
if (e2) throw e2;
for (let i = 0; i < rows.length; i += 500) {
  const { error } = await db().from("simulated_messages").insert(rows.slice(i, i + 500).map((r) => ({ event_id: event.id, ...r })));
  if (error) throw error;
}
const { error: e3 } = await db().from("events").update({ simulated_names: names }).eq("id", event.id);
if (e3) throw e3;

const last = rows[rows.length - 1];
console.log(`imported ${rows.length} messages, ${names.length} names; last at ${Math.floor(last.offset_seconds / 60)}m${last.offset_seconds % 60}s`);
