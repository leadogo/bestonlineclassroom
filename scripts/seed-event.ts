// Tonight's event, as the admin UI will one day enter it. Idempotent: re-running updates the same row and keeps
// whatever the upload script stored for the video. Run: npm run seed -- --event ailg-r
import { parseArgs } from "node:util";
import { db } from "../src/lib/db.ts";

const EVENTS: Record<string, Record<string, unknown>> = {
  "ailg-r": {
    slug: "ailg-r",
    title: "AI For Agents Masterclass",
    host_name: "William Kabrall",
    timezone: "America/Edmonton",
    start_time: "17:00",
    cta_at_seconds: 4500, // 1:15:00
    cta_hide_seconds: 8259, // 2:17:39, as EasyWebinar was set
    cta_label: "Book your call",
    cta_href: "https://aiforagentsmasterclass.com/join-community",
    end_url: "https://aiforagentsmasterclass.com/join-community-expired",
  },
};

const { values } = parseArgs({ options: { event: { type: "string", default: "ailg-r" } } });
const event = EVENTS[values.event!];
if (!event) throw new Error(`Unknown event ${values.event}; known: ${Object.keys(EVENTS).join(", ")}`);

const { data, error } = await db().from("events").upsert(event, { onConflict: "slug" }).select("id, slug, video_url, video_seconds, cta_at_seconds").single();
if (error) throw error;
console.log("event", data);
