// One rule decides every instant in the app: an event runs one session a day at its start time in its
// timezone, lasting exactly as long as its video. Today's session is the one until it starts, then tomorrow's,
// so an opt-in at 17:01 is for tomorrow while one at 16:59 is for today. Callers ask at the moment they need
// it and never cache the answer. Copied from the site's daily-schedule.ts with the constants turned into a
// Schedule argument; the EasyWebinar and ActiveCampaign helpers stayed behind.
import { partsInTz, zoned } from "./tz.ts";

export type Schedule = {
  /** IANA zone, e.g. America/Edmonton */
  timezone: string;
  startHour: number;
  startMinute: number;
  /** The video's length: the session ends exactly when the recording does. */
  seconds: number;
  /** Weekdays with a session, 0 = Sunday … 6 = Saturday. All seven = daily. */
  days?: number[];
};

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const runsOn = (s: Schedule, weekday: number) => (s.days && s.days.length ? s.days : ALL_DAYS).includes(weekday);

export type Session = {
  start: Date;
  end: Date;
  /** YYYY-MM-DD, the session's calendar date in the event's timezone. */
  date: string;
};

export type RoomState = {
  state: "countdown" | "live" | "ended";
  session: Session;
  /** Seconds into the recording right now, clamped to [0, seconds]. 0 before the start. */
  offsetSeconds: number;
};

/** Tonight's event: 5:00 PM Mountain, the 139m46s recording. The seed script and tests use it; routes read the DB. */
export const AILG_R: Schedule = { timezone: "America/Edmonton", startHour: 17, startMinute: 0, seconds: 8386 };

const pad2 = (n: number) => String(n).padStart(2, "0");

/** The calendar date of an instant in the schedule's zone. */
export function localDate(s: Schedule, d: Date): string {
  const p = partsInTz(d, s.timezone);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

function sessionAt(s: Schedule, year: number, month: number, day: number): Session {
  const start = zoned(year, month, day, s.startHour, s.startMinute, s.timezone);
  return { start, end: new Date(start.getTime() + s.seconds * 1000), date: localDate(s, start) };
}

/**
 * The evergreen rule: today's session until it starts, then the next day the webinar runs. At the start instant
 * it is already the next one. Days the webinar does not run are skipped.
 */
export function nextSession(s: Schedule, now: Date = new Date()): Session {
  const p = partsInTz(now, s.timezone);
  for (let add = 0; add < 8; add++) {
    const c = sessionAt(s, p.year, p.month, p.day + add);
    if (!runsOn(s, partsInTz(c.start, s.timezone).weekday)) continue;
    if (add === 0 && now.getTime() >= c.start.getTime()) continue;
    return c;
  }
  return sessionAt(s, p.year, p.month, p.day + 1);
}

/** The session on a given local calendar date (YYYY-MM-DD), e.g. the one a registrant was booked for. Null if malformed or a day the webinar does not run. */
export function sessionFor(s: Schedule, date: string | null | undefined): Session | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date ?? "");
  if (!m) return null;
  const c = sessionAt(s, Number(m[1]), Number(m[2]), Number(m[3]));
  return runsOn(s, partsInTz(c.start, s.timezone).weekday) ? c : null;
}

/** Today's session while it is in progress (start ≤ now < end), otherwise the next one. */
export function currentOrNextSession(s: Schedule, now: Date = new Date()): Session {
  const tonight = sessionFor(s, localDate(s, now));
  if (tonight && tonight.start.getTime() <= now.getTime() && now.getTime() < tonight.end.getTime()) return tonight;
  return nextSession(s, now);
}

/**
 * What the room shows right now. With a registrant's `date` the answer is about that session (past → ended,
 * future → countdown); without one it is tonight's session while it runs, else a countdown to the next, so an
 * undated visit never sees "ended".
 */
export function roomState(s: Schedule, now: Date = new Date(), date?: string | null): RoomState {
  const session = (date ? sessionFor(s, date) : null) ?? currentOrNextSession(s, now);
  const elapsed = Math.floor((now.getTime() - session.start.getTime()) / 1000);
  const offsetSeconds = Math.min(Math.max(elapsed, 0), s.seconds);
  const state = now.getTime() < session.start.getTime() ? "countdown" : now.getTime() >= session.end.getTime() ? "ended" : "live";
  return { state, session, offsetSeconds };
}

/** The Schedule for an `events` row (`start_time` is Postgres `time`: "17:00:00" or "17:00"). */
export function scheduleOf(event: { timezone: string; start_time: string; video_seconds: number | null; days?: number[] | null }): Schedule {
  const m = /^(\d{1,2}):(\d{2})/.exec(event.start_time);
  if (!m) throw new Error(`Bad start_time: ${event.start_time}`);
  return { timezone: event.timezone, startHour: Number(m[1]), startMinute: Number(m[2]), seconds: event.video_seconds ?? 0, days: event.days && event.days.length ? event.days : ALL_DAYS };
}

const ZONES: Array<[string, string]> = [
  ["Pacific", "America/Los_Angeles"],
  ["Mountain", "America/Denver"],
  ["Central", "America/Chicago"],
  ["Eastern", "America/New_York"],
];

/** [["Pacific", "4 PM"], ["Mountain", "5 PM"], …] computed from the session start, for the countdown page. */
export function fourZones(session: Session): Array<[string, string]> {
  return ZONES.map(([label, tz]) => [label, new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric" }).format(session.start)]);
}
