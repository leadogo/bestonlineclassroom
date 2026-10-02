import { db } from "@/lib/db";
import { localDate, scheduleOf, sessionFor } from "@/lib/daily-schedule";
import type { EventRow } from "@/lib/events";
import { openLinkLine, shiftDay, type Funnel } from "@/lib/open-link";
import { postToIntel } from "@/lib/slack";

export const dynamic = "force-dynamic";

const GUEST_SOURCES = ["skool", "guest", "legacy"];
const BASELINE_NIGHTS = 7;

async function funnel(eventId: string, from: string, to: string): Promise<Funnel> {
  const cards = await db().from("link_clicks").select("id", { count: "exact", head: true }).eq("event_id", eventId).eq("path", "w").eq("outcome", "prompt").gte("session_date", from).lte("session_date", to);
  const submitted = await db().from("registrants").select("id", { count: "exact", head: true }).eq("event_id", eventId).in("source", GUEST_SOURCES).gte("session_date", from).lte("session_date", to);
  const joined = await db().from("attendance").select("id, registrant:registrants!inner(event_id, source)", { count: "exact", head: true }).eq("kind", "live").gte("session_date", from).lte("session_date", to).eq("registrant.event_id", eventId).in("registrant.source", GUEST_SOURCES);
  return { cards: cards.count ?? 0, submitted: submitted.count ?? 0, joined: joined.count ?? 0 };
}

/**
 * The nightly open-link line (SPEC-phase7.md), after the session: for an event whose open link asks for an email,
 * tonight's cards → emails → joined against the name-only nights before the switch; for every event, how many
 * clients the wall turned away today. Schedule in vercel.json (8:50 PM Mountain in summer, 7:50 PM in winter).
 */
export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const now = new Date();
  const { data: events } = await db().from("events").select("*");
  const lines: string[] = [];
  for (const e of ((events ?? []) as EventRow[]).filter((x) => !x.slug.startsWith("test"))) {
    const schedule = scheduleOf(e);
    const today = localDate(schedule, now);
    if (!sessionFor(schedule, today)) continue;
    if (e.open_link_field === "email" && e.open_link_email_since) {
      const tonight = await funnel(e.id, today, today);
      const baseline = await funnel(e.id, shiftDay(e.open_link_email_since, -BASELINE_NIGHTS), shiftDay(e.open_link_email_since, -1));
      lines.push(openLinkLine(e.title, today, tonight, baseline, BASELINE_NIGHTS));
    }
    const walled = await db().from("registrants").select("id", { count: "exact", head: true }).eq("event_id", e.id).eq("session_date", today).eq("block_reason", "client");
    const hits = await db().from("link_clicks").select("id", { count: "exact", head: true }).eq("event_id", e.id).eq("session_date", today).eq("outcome", "walled");
    lines.push(`🚧 Client wall, ${e.title} ${today}: ${walled.count ?? 0} client${walled.count === 1 ? "" : "s"} held a link, ${hits.count ?? 0} opened it and got the 404.`);
  }
  const posted = lines.length ? await postToIntel(lines.join("\n")) : { ok: true };
  return Response.json({ ok: posted.ok, lines }, { headers: { "cache-control": "no-store" } });
}
