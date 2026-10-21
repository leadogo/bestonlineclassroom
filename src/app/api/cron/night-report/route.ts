import { localDate, scheduleOf, sessionFor } from "@/lib/daily-schedule";
import { db, pageAll } from "@/lib/db";
import { isScannerAgent } from "@/lib/scanner";
import { median, nightCounts, nightReportDue, nightReportText, type LiveRow } from "@/lib/night-report";
import { postToIntel } from "@/lib/slack";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DAY_MS = 86_400_000;

/**
 * The night report (SPEC-post-session.md, C): hourly at :50 (vercel.json); when it is 7:45 PM or later in the event's
 * zone and today's session has ended, one line to #autoweb-intel with the night's numbers against the previous seven
 * sessions, plus the promo email taps when there were any. `events.night_report_on` records the day so it posts once.
 * `?dry=1` returns the text without posting or recording; `?force=1` ignores the clock.
 */
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const dry = params.get("dry") === "1";
  const force = params.get("force") === "1";
  const now = new Date();
  const { data: events } = await db().from("events").select("id, slug, timezone, start_time, video_seconds, days, cta_at_seconds, night_report_on");
  const report: Array<{ event: string; due: boolean; text: string | null }> = [];
  for (const e of events ?? []) {
    if (e.slug.startsWith("test")) continue;
    const schedule = scheduleOf(e);
    const today = localDate(schedule, now);
    const session = sessionFor(schedule, today);
    if (!session) { report.push({ event: e.slug, due: false, text: null }); continue; }
    const { due } = nightReportDue(now, e.night_report_on, session.end.getTime(), e.timezone);
    if (!due && !force && !dry) { report.push({ event: e.slug, due: false, text: null }); continue; }
    const since = new Date(session.start.getTime() - 12 * DAY_MS).toISOString().slice(0, 10);
    // Paged (pageAll): twelve days of live rows pass the 1,000-row answer cap after one Tuesday.
    const [att, bookings] = await Promise.all([
      pageAll<Record<string, unknown>>((from, to) => db().from("attendance").select("registrant_id, session_date, joined_at, last_seen_at, seconds_watched, cta_clicked_at, registrant:registrants!inner(source, event_id)").eq("kind", "live").gte("session_date", since).lte("session_date", today).eq("registrant.event_id", e.id).order("session_date").order("registrant_id").range(from, to)),
      db().from("bookings").select("session_date, registrant_id").eq("event_id", e.id).eq("status", "scheduled").gte("session_date", since).lte("session_date", today).limit(1000),
    ]);
    const byDate = new Map<string, LiveRow[]>();
    for (const a of att) {
      const list = byDate.get(a.session_date as string) ?? [];
      list.push({ registrant_id: a.registrant_id as string, joined_at: a.joined_at as string, last_seen_at: a.last_seen_at as string, seconds_watched: Number(a.seconds_watched) || 0, cta_clicked_at: (a.cta_clicked_at as string | null) ?? null, source: (a.registrant as unknown as { source: string }).source });
      byDate.set(a.session_date as string, list);
    }
    const booked = new Map<string, Array<string | null>>();
    for (const b of bookings.data ?? []) booked.set(b.session_date as string, [...(booked.get(b.session_date as string) ?? []), (b.registrant_id as string | null) ?? null]);
    const pitchAt = e.cta_at_seconds !== null ? session.start.getTime() + Number(e.cta_at_seconds) * 1000 : null;
    const tonight = nightCounts(byDate.get(today) ?? [], pitchAt);
    const previous = [...byDate.keys()].filter((d) => d < today).sort().slice(-7);
    const medians = { people: median(previous.map((d) => nightCounts(byDate.get(d) ?? [], null).people)), booked: median(previous.map((d) => (booked.get(d) ?? []).length)) };
    // The promo emails' taps that afternoon (SPEC-link-opens.md): human agents only, from two hours before the start to the pitch.
    const taps = await pageAll<{ registrant_id: string; user_agent: string | null }>((from, to) => db().from("link_clicks").select("registrant_id, user_agent").eq("event_id", e.id).eq("path", "j").eq("src", "email").not("registrant_id", "is", null).gte("at", new Date(session.start.getTime() - 2 * 3_600_000).toISOString()).lt("at", new Date(pitchAt ?? session.end.getTime()).toISOString()).order("id").range(from, to));
    const tapped = new Set(taps.filter((t) => !isScannerAgent(t.user_agent)).map((t) => t.registrant_id));
    const bookedTonight = new Set((booked.get(today) ?? []).filter((x): x is string => Boolean(x)));
    const emails = { taps: tapped.size, watched: [...tapped].filter((id) => tonight.people_ids.has(id)).length, booked: [...tapped].filter((id) => bookedTonight.has(id)).length };
    const label = new Intl.DateTimeFormat("en-US", { timeZone: e.timezone, weekday: "short", month: "short", day: "numeric" }).format(session.start).replace(",", "");
    const text = nightReportText({ label, counts: tonight, booked: (booked.get(today) ?? []).length, medians, emails });
    if (!dry) {
      const sent = await postToIntel(text);
      // A Slack hiccup leaves the day unrecorded, so the next hourly run tries again.
      if (sent.ok) await db().from("events").update({ night_report_on: today }).eq("id", e.id);
    }
    report.push({ event: e.slug, due, text });
  }
  return Response.json({ now: now.toISOString(), dry, report });
}
