// Scoring a Skool broadcast (pure): the funnel from the email to a booked call, and the one line that reports it.
// Jeremy (Oct 18): bookings that night decide a win; clicks and joins lead, the pitch-room count is the strongest
// of those; judge a title on at least four sends; two fixed posts for two weeks, then champion vs one challenger.

export const SKOOL_MEMBERS = 6200; // the community's member count, the email's reach; update when it moves
export const SENDS_BEFORE_JUDGING = 4;

export type BroadcastResult = { emailed: number; doorClicks: number; entered: number; joined: number; atPitch: number; booked: number };

const pct = (part: number, whole: number) => (whole > 0 ? `${(100 * part / whole).toFixed(part / whole < 0.1 ? 1 : 0)}%` : "n/a");

export function resultLine(weekday: string, date: string, title: string, r: BroadcastResult): string {
  return `📊 *Skool ${weekday} broadcast · ${date}* "${title}" · ${r.emailed.toLocaleString()} emailed · ${r.doorClicks} door clicks (${pct(r.doorClicks, r.emailed)}) · ${r.entered} entered an email · ${r.joined} joined · ${r.atPitch} at the pitch · *${r.booked} booked*`;
}

/** The brief for Jeremy after each run of sends: one row per broadcast, then the ask. */
export function reviewBrief(rows: Array<{ date: string; weekday: string; title: string; result: BroadcastResult }>): string {
  const byTitle = new Map<string, { weekday: string; sends: number; totals: BroadcastResult }>();
  for (const row of rows) {
    const cur = byTitle.get(row.title) ?? { weekday: row.weekday, sends: 0, totals: { emailed: 0, doorClicks: 0, entered: 0, joined: 0, atPitch: 0, booked: 0 } };
    cur.sends++;
    for (const k of Object.keys(cur.totals) as Array<keyof BroadcastResult>) cur.totals[k] += row.result[k];
    byTitle.set(row.title, cur);
  }
  const lines = [...byTitle.entries()].map(([title, t]) => `- ${t.weekday} · "${title}" · ${t.sends} send${t.sends === 1 ? "" : "s"}${t.sends < SENDS_BEFORE_JUDGING ? " (not yet a read)" : ""} · clicks ${t.totals.doorClicks} · joined ${t.totals.joined} · at pitch ${t.totals.atPitch} · booked ${t.totals.booked}`);
  return `Skool broadcast results, ${rows.length} send${rows.length === 1 ? "" : "s"}:\n${lines.join("\n")}\n\nWhich title is the champion in each slot, and what is the one challenger title for next week? Same body structure, title the only change.`;
}
