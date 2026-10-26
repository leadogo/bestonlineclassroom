// The night report (SPEC-post-session.md, C): the session's numbers in one Slack line at 7:50 PM, from the room's own
// rows and the two-minute rule William's Oct 20 report used. Pure; the cron route reads and posts.
import { isPerson, peakConcurrent, PERSON_SECONDS, PRESENCE_GRACE_MS } from "./outcomes.ts";
import { partsInTz } from "./tz.ts";
import type { Notice } from "./slack.ts";

export { isPerson, PERSON_SECONDS };
export type LiveRow = { registrant_id: string; joined_at: string; last_seen_at: string; seconds_watched: number; cta_clicked_at: string | null; source?: string | null };

export type NightCounts = { people: number; visits: number; peak: number; at_pitch: number | null; clicked: number; stayed_40: number; people_ids: Set<string> };

/** The night's counts over persons; `visits` is every live row, for the record. Peak on one-minute steps. */
export function nightCounts(rows: LiveRow[], pitchAtMs: number | null): NightCounts {
  const real = rows.filter((r) => r.source !== "test");
  const people = real.filter(isPerson);
  const spans = people.map((p) => ({ from: Date.parse(p.joined_at), to: Date.parse(p.last_seen_at) }));
  return {
    people: people.length,
    visits: real.length,
    peak: peakConcurrent(spans, 60_000),
    at_pitch: pitchAtMs === null ? null : spans.filter((s) => s.from <= pitchAtMs && s.to + PRESENCE_GRACE_MS >= pitchAtMs).length,
    clicked: people.filter((p) => p.cta_clicked_at !== null).length,
    stayed_40: people.filter((p) => p.seconds_watched >= 2400).length,
    people_ids: new Set(people.map((p) => p.registrant_id)),
  };
}

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

export type Emails = { taps: number; watched: number; booked: number };

/** The night as one 📊: people and bookings against the median on the headline, the rest on the number line, the promo email taps as the note when there were any. The thread names how many nights the median covers (fewer than seven in the first week or on a two-night schedule). */
export function nightReportNotice(o: { label: string; counts: NightCounts; booked: number; medians: { people: number | null; booked: number | null; nights: number }; emails?: Emails | null }): Notice {
  const c = o.counts;
  const med = (n: number | null) => (n === null || !o.medians.nights ? "" : ` (median ${n})`);
  return {
    kind: "read",
    headline: `${o.label}: ${c.people} people${med(o.medians.people)}, ${o.booked} booked${med(o.medians.booked)}`,
    numbers: [`peak ${c.peak}`, ...(c.at_pitch !== null ? [`${c.at_pitch} at the pitch`] : []), `${c.clicked} offer clicks · ${c.stayed_40} stayed 40+`],
    note: o.emails && o.emails.taps ? `emails ${o.emails.taps} taps → ${o.emails.watched} watched → ${o.emails.booked} booked` : null,
    detail: o.medians.nights ? [`the median covers the previous ${o.medians.nights} night${o.medians.nights === 1 ? "" : "s"}`] : [],
  };
}

/** Due from 7:45 PM in the event's zone for the rest of that day (so a failed 7:50 post is retried at 8:50), once the session has ended, once a day. `today` is the local date to record. */
export function nightReportDue(now: Date, lastOn: string | null, sessionEndMs: number, tz: string): { due: boolean; today: string } {
  const p = partsInTz(now, tz);
  const today = `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
  const due = (p.hour > 19 || (p.hour === 19 && p.minute >= 45)) && now.getTime() >= sessionEndMs && lastOn !== today;
  return { due, today };
}
