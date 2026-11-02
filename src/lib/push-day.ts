// The daily ActiveCampaign push (Jeremy, Nov 2 2026): the engaged, unbooked list is split into eight groups and one
// group is invited per weekday Mon–Thu at 5:50 pm Eastern, so each person is invited once every 14 days and the
// room is lifted four nights a week instead of two. ActiveCampaign's scheduled trigger admits a contact only once
// ever, so the pick lives here: the cron tags today's group `push_today` and automation 199 (AILG-R push) starts on
// that tag. Pure; the cron does the calls.

import { partsInTz } from "./tz.ts";

const TZ = "America/New_York";
export const GROUPS = 8;
/** Monday Nov 2 2026 is group 1's first push; groups follow in order on every Mon–Thu after it. */
export const ANCHOR = "2026-11-02";
export const PUSH_HOUR = 17;
export const PUSH_MINUTE = 50;
/** No one is pushed twice inside this many days, whatever the calendar says (a late join to a group, a forced run). */
export const HOLD_DAYS = 13;

/** ActiveCampaign tag ids (created Nov 2 2026): push_today, then push_g1 … push_g8. */
export const PUSH_TODAY_TAG = "421";
export const GROUP_TAGS: readonly string[] = ["422", "423", "424", "425", "426", "427", "428", "429"];
/** AILGR Missed (Re-Engagement): three days of its own invites after a missed night, so its contacts sit out. */
export const REENGAGEMENT_AUTOMATION = "192";
/** The push's eligibility rules live on automation 199's old scheduled trigger segment (registered, not a client or booked, missed or left early, opened in 30 days, created in 365 days). */
export const ELIGIBLE_SEGMENT = "1972";

export function easternDate(now: Date): { date: string; weekday: number; hour: number; minute: number } {
  const p = partsInTz(now, TZ);
  const pad = (n: number) => String(n).padStart(2, "0");
  return { date: `${p.year}-${pad(p.month)}-${pad(p.day)}`, weekday: p.weekday, hour: p.hour, minute: p.minute };
}

const isMonToThu = (weekday: number) => weekday >= 1 && weekday <= 4;

/** Mon–Thu are push days (Eastern). */
export function isPushDay(date: string): boolean {
  return isMonToThu(new Date(`${date}T12:00:00Z`).getUTCDay());
}

/** The cron runs at :50 in two UTC hours; only the run at 17:5x Eastern pushes. */
export function isPushMinute(now: Date): boolean {
  const { hour, minute } = easternDate(now);
  return hour === PUSH_HOUR && minute >= PUSH_MINUTE - 3 && minute <= PUSH_MINUTE + 5;
}

/** Group 1–8 for a push day: Mon–Thu days counted from the anchor, round the eight. null on other days or before the anchor. */
export function groupFor(date: string): number | null {
  if (!isPushDay(date) || date < ANCHOR) return null;
  let n = 0;
  for (let d = new Date(`${ANCHOR}T12:00:00Z`); d.toISOString().slice(0, 10) < date; d.setUTCDate(d.getUTCDate() + 1)) {
    if (isMonToThu(d.getUTCDay())) n++;
  }
  return (n % GROUPS) + 1;
}

/** The group a new contact joins: the smallest one (lowest number on a tie), so the eight stay even. */
export function smallestGroup(sizes: readonly number[]): number {
  let best = 0;
  for (let i = 1; i < GROUPS; i++) if ((sizes[i] ?? 0) < (sizes[best] ?? 0)) best = i;
  return best + 1;
}

/** Today's list: the group's members minus anyone in the re-engagement automation or pushed inside the hold. */
export function pickToday(members: readonly string[], inReengagement: ReadonlySet<string>, pushedRecently: ReadonlySet<string>): { push: string[]; skippedReengagement: number; skippedHold: number } {
  const push: string[] = [];
  let skippedReengagement = 0;
  let skippedHold = 0;
  for (const id of new Set(members)) {
    if (inReengagement.has(id)) skippedReengagement++;
    else if (pushedRecently.has(id)) skippedHold++;
    else push.push(id);
  }
  return { push, skippedReengagement, skippedHold };
}
