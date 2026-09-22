// A throwaway second webinar for an end-to-end test: copies an event (video included) into --slug, starting at
// --at HH:MM in the event's timezone every day, registers --email through the production webhook (so the real
// confirmation email, calendar invite and reminders go out) and prints the links. ActiveCampaign tags are
// blanked on the copy so the test never tags a real contact. --teardown removes the event and everything under it.
// Run: npm run test:event -- --at 22:30            then later: npm run test:event -- --teardown
import { parseArgs } from "node:util";
import { db } from "../src/lib/db.ts";

const { values } = parseArgs({
  options: {
    at: { type: "string" },
    slug: { type: "string", default: "test-run" },
    from: { type: "string", default: "ailg-r" },
    email: { type: "string", default: "william@leadogo.com" },
    first: { type: "string", default: "William" },
    teardown: { type: "boolean", default: false },
    "no-register": { type: "boolean", default: false },
    /** Shorten the session (video_seconds) so the end and the replay gate can be tested in minutes. */
    seconds: { type: "string" },
    /** "HH:MM" local: when the replay opens (events.replay_opens_at). Blank = at the session's end. */
    "replay-at": { type: "string" },
  },
});
const seconds = values.seconds ? Number(values.seconds) : null;
const replayAt = values["replay-at"] ? `${values["replay-at"]}:00` : null;
const APP = (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.bestonlineclassroom.com").replace(/\/$/, "").replace("://bestonlineclassroom.com", "://www.bestonlineclassroom.com");
const slug = values.slug!;
if (slug === "ailg-r") throw new Error("Not the main webinar.");

if (values.teardown) {
  const ev = await db().from("events").select("id").eq("slug", slug).maybeSingle();
  if (!ev.data) {
    console.log(`no event ${slug}`);
    process.exit(0);
  }
  const id = ev.data.id as string;
  const rids = ((await db().from("registrants").select("id").eq("event_id", id)).data ?? []).map((r) => r.id as string);
  if (rids.length) {
    await db().from("attendance").delete().in("registrant_id", rids);
    await db().from("chat_messages").delete().in("registrant_id", rids);
    await db().from("outcome_tags").delete().in("registrant_id", rids);
    await db().from("reminder_sends").delete().in("registrant_id", rids);
  }
  await db().from("chat_messages").delete().eq("event_id", id);
  await db().from("simulated_messages").delete().eq("event_id", id);
  await db().from("link_clicks").delete().eq("event_id", id);
  await db().from("registrants").delete().eq("event_id", id);
  const { error } = await db().from("events").delete().eq("id", id);
  if (error) throw new Error(error.message);
  console.log(`deleted ${slug}: ${rids.length} registrants and everything under them`);
  process.exit(0);
}

if (!/^\d{1,2}:\d{2}$/.test(values.at ?? "")) throw new Error("--at HH:MM (24 h, Mountain) is required");
const src = await db().from("events").select("*").eq("slug", values.from!).single();
if (src.error) throw new Error(src.error.message);
const { id: fromId, created_at: _c, ...copy } = src.data as Record<string, unknown> & { id: string; created_at: string };
void _c;
const row = { ...copy, slug, title: "Test run", start_time: values.at, days: [0, 1, 2, 3, 4, 5, 6], tags: {}, replay_opens_at: replayAt, ...(seconds ? { video_seconds: seconds } : {}) };
const existing = await db().from("events").select("id").eq("slug", slug).maybeSingle();
let eventId: string;
if (existing.data) {
  eventId = existing.data.id as string;
  const { error } = await db().from("events").update({ start_time: values.at, title: "Test run", replay_opens_at: replayAt, ...(seconds ? { video_seconds: seconds } : {}) }).eq("id", eventId);
  if (error) throw new Error(error.message);
  const rids = ((await db().from("registrants").select("id").eq("event_id", eventId)).data ?? []).map((r) => r.id as string);
  if (rids.length) {
    await db().from("attendance").delete().in("registrant_id", rids);
    await db().from("registrants").update({ blocked_at: null, ghosted_at: null, replay_opened_at: null }).in("id", rids);
  }
  await db().from("chat_messages").delete().eq("event_id", eventId);
  await db().from("link_clicks").delete().eq("event_id", eventId);
  console.log(`updated ${slug} to start at ${values.at}; previous round's chat, attendance and clicks wiped`);
} else {
  const ins = await db().from("events").insert(row).select("id").single();
  if (ins.error) throw new Error(ins.error.message);
  eventId = ins.data.id as string;
  const sim = await db().from("simulated_messages").select("offset_seconds, name, body").eq("event_id", fromId);
  if (sim.data?.length) await db().from("simulated_messages").insert(sim.data.map((m) => ({ ...m, event_id: eventId })));
  console.log(`created ${slug} at ${values.at} ${copy.timezone}, video ${copy.video_seconds}s, ${sim.data?.length ?? 0} simulated messages`);
}
console.log(`open link: ${APP}/w/${slug}    admin: ${APP}/admin/events/${slug}    moderate: ${APP}/mod/${slug}`);

if (!values["no-register"]) {
  const res = await fetch(`${APP}/api/register`, {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.REGISTER_SECRET}`, "content-type": "application/json" },
    body: JSON.stringify({ event: slug, first_name: values.first, email: values.email, source: "zapier" }),
  });
  const j = (await res.json()) as Record<string, unknown>;
  if (!res.ok) throw new Error(`register ${res.status}: ${JSON.stringify(j)}`);
  console.log(`registered ${values.email}:`, JSON.stringify(j, null, 2));
}
