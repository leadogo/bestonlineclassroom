// Removes one name from an event's simulated chat: every message by them and their entry in the attendee list.
// Run: npm run simulated:remove -- --event ailg-r --name "Exact Name"
import { parseArgs } from "node:util";
import { db } from "../src/lib/db.ts";

const { values } = parseArgs({ options: { event: { type: "string", default: "ailg-r" }, name: { type: "string" } } });
if (!values.name) throw new Error("--name is required");

const { data: event, error } = await db().from("events").select("id, simulated_names").eq("slug", values.event!).single();
if (error || !event) throw error ?? new Error("event not found");

const before = await db().from("simulated_messages").select("id", { count: "exact", head: true }).eq("event_id", event.id).eq("name", values.name);
const del = await db().from("simulated_messages").delete().eq("event_id", event.id).eq("name", values.name);
if (del.error) throw del.error;
const names = (event.simulated_names as string[]).filter((n) => n !== values.name);
const upd = await db().from("events").update({ simulated_names: names }).eq("id", event.id);
if (upd.error) throw upd.error;
const total = await db().from("simulated_messages").select("id", { count: "exact", head: true }).eq("event_id", event.id);
console.log(`removed ${before.count ?? 0} message(s) by "${values.name}"; attendee list ${(event.simulated_names as string[]).length} → ${names.length}; ${total.count} simulated messages remain`);
