// The one rule every instant in the room follows. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { zoned } from "./tz.ts";
import { AILG_R, currentOrNextSession, fourZones, nextSession, pickRunningOrNext, roomState, scheduleOf, sessionFor } from "./daily-schedule.ts";

const S = AILG_R;
const mt = (y: number, m: number, d: number, h: number, min = 0, sec = 0) => new Date(zoned(y, m, d, h, min, S.timezone).getTime() + sec * 1000);
const startOf = (now: Date) => nextSession(S, now).start.toISOString();

test("today's 5 PM Mountain session until it starts, then tomorrow's", () => {
  assert.equal(startOf(mt(2026, 9, 21, 16, 59)), "2026-09-21T23:00:00.000Z", "4:59 PM MDT: today");
  assert.equal(nextSession(S, mt(2026, 9, 21, 16, 59)).date, "2026-09-21");
  assert.equal(startOf(mt(2026, 9, 21, 17, 0)), "2026-09-22T23:00:00.000Z", "5:00 PM MDT sharp: already tomorrow");
  assert.equal(startOf(mt(2026, 9, 21, 0, 0)), "2026-09-21T23:00:00.000Z", "midnight: today");
  assert.equal(startOf(mt(2026, 9, 30, 18, 0)), "2026-10-01T23:00:00.000Z", "month boundary");
});

test("the session lasts exactly the video: 8386 s", () => {
  const s = nextSession(S, mt(2026, 9, 21, 12, 0));
  assert.equal((s.end.getTime() - s.start.getTime()) / 1000, 8386);
});

test("daylight saving ends Nov 1 2026: 5 PM MST is 00:00 UTC the next day, the local date stays Nov 1", () => {
  const s = nextSession(S, mt(2026, 11, 1, 12, 0));
  assert.equal(s.start.toISOString(), "2026-11-02T00:00:00.000Z");
  assert.equal(s.date, "2026-11-01", "the Mountain date, not the UTC date");
  assert.equal(sessionFor(S, "2026-11-01")?.start.toISOString(), "2026-11-02T00:00:00.000Z");
  assert.equal(roomState(S, mt(2026, 11, 1, 17, 0)).state, "live", "17:00 local on the DST day is live");
});

test("sessionFor: the session a registrant was booked for, by its local date", () => {
  assert.equal(sessionFor(S, "2026-09-21")?.start.toISOString(), "2026-09-21T23:00:00.000Z");
  assert.equal(sessionFor(S, "2026-09-21")?.date, "2026-09-21");
  assert.equal(sessionFor(S, "nope"), null);
  assert.equal(sessionFor(S, undefined), null);
});

test("currentOrNextSession: tonight's session while it runs, otherwise the next one", () => {
  assert.equal(currentOrNextSession(S, new Date("2026-09-21T23:04:00Z")).date, "2026-09-21", "7:04 PM ET: tonight");
  assert.equal(currentOrNextSession(S, new Date("2026-09-22T01:40:00Z")).date, "2026-09-22", "after the video ends: tomorrow");
  assert.equal(currentOrNextSession(S, new Date("2026-09-21T22:00:00Z")).date, "2026-09-21", "4 PM MT: tonight");
});

test("a late session still running past midnight is the current one (found 2026-09-21 00:02 in a test run)", () => {
  const late = { ...S, startHour: 23, startMinute: 46 };
  const s = currentOrNextSession(late, mt(2026, 9, 21, 0, 2));
  assert.equal(s.date, "2026-09-20", "yesterday's session, not tomorrow's countdown");
  assert.equal(roomState(late, mt(2026, 9, 21, 0, 2)).state, "live");
  assert.equal(currentOrNextSession(late, mt(2026, 9, 21, 2, 30)).date, "2026-09-21", "after it ends: tonight's");
});

test("roomState without a date: countdown, live at the offset, then tomorrow's countdown", () => {
  const a = roomState(S, mt(2026, 9, 21, 16, 59, 59));
  assert.deepEqual([a.state, a.offsetSeconds, a.session.date], ["countdown", 0, "2026-09-21"]);
  const b = roomState(S, mt(2026, 9, 21, 17, 0, 0));
  assert.deepEqual([b.state, b.offsetSeconds], ["live", 0]);
  const c = roomState(S, mt(2026, 9, 21, 17, 45));
  assert.deepEqual([c.state, c.offsetSeconds], ["live", 2700]);
  const d = roomState(S, mt(2026, 9, 21, 17, 0, 8385));
  assert.deepEqual([d.state, d.offsetSeconds], ["live", 8385], "one second before the end");
  const e = roomState(S, mt(2026, 9, 21, 17, 0, 8386));
  assert.deepEqual([e.state, e.session.date], ["countdown", "2026-09-22"], "undated visit after the end: tomorrow's countdown, never ended");
});

test("roomState with a registrant's date: that session, past → ended, future → countdown", () => {
  const ended = roomState(S, mt(2026, 9, 21, 17, 0, 8386), "2026-09-21");
  assert.deepEqual([ended.state, ended.offsetSeconds], ["ended", 8386]);
  const late = roomState(S, mt(2026, 9, 22, 9, 0), "2026-09-21");
  assert.equal(late.state, "ended", "clicking the next morning");
  const tomorrow = roomState(S, mt(2026, 9, 21, 18, 0), "2026-09-22");
  assert.deepEqual([tomorrow.state, tomorrow.offsetSeconds, tomorrow.session.date], ["countdown", 0, "2026-09-22"], "dated tomorrow at 6 PM tonight");
  const live = roomState(S, mt(2026, 9, 21, 17, 30), "2026-09-21");
  assert.deepEqual([live.state, live.offsetSeconds], ["live", 1800]);
  assert.equal(roomState(S, mt(2026, 9, 21, 12, 0), "garbage").session.date, "2026-09-21", "a bad date falls back to the rule");
});

test("weekdays: a Tue/Thu schedule skips the other days everywhere", () => {
  const tt = { ...S, days: [2, 4] };
  // 2026-09-23 is a Wednesday: the next session is Thursday the 24th
  assert.equal(nextSession(tt, mt(2026, 9, 23, 12)).date, "2026-09-24");
  // Thursday at 17:00 sharp: already next Tuesday
  assert.equal(nextSession(tt, mt(2026, 9, 24, 17, 0)).date, "2026-09-29");
  assert.equal(sessionFor(tt, "2026-09-23"), null, "no session on a Wednesday");
  assert.equal(sessionFor(tt, "2026-09-24")?.date, "2026-09-24");
  assert.equal(roomState(tt, mt(2026, 9, 23, 18), "2026-09-23").session.date, "2026-09-24", "a registrant dated an off day is shown the next session");
  assert.equal(currentOrNextSession(tt, mt(2026, 9, 24, 17, 30)).date, "2026-09-24", "Thursday's room while it runs");
});

test("pickRunningOrNext: the running webinar wins, otherwise the earliest next start", () => {
  const five = { slug: "five", timezone: "America/Edmonton", start_time: "17:00:00", video_seconds: 8386, days: [0, 1, 2, 3, 4, 5, 6] };
  const noon = { slug: "noon", timezone: "America/Edmonton", start_time: "12:00:00", video_seconds: 3600, days: [0, 1, 2, 3, 4, 5, 6] };
  assert.equal(pickRunningOrNext([five, noon], mt(2026, 9, 21, 17, 30))?.slug, "five", "five is running at 5:30 PM");
  assert.equal(pickRunningOrNext([five, noon], mt(2026, 9, 21, 12, 10))?.slug, "noon", "noon is running at 12:10");
  assert.equal(pickRunningOrNext([five, noon], mt(2026, 9, 21, 14, 0))?.slug, "five", "at 2 PM the next start is 5 PM today");
  assert.equal(pickRunningOrNext([five, noon], mt(2026, 9, 21, 20, 0))?.slug, "noon", "at 8 PM the next start is noon tomorrow");
  assert.equal(pickRunningOrNext([], mt(2026, 9, 21, 20, 0)), null);
});

test("scheduleOf reads an events row; fourZones is computed from the start", () => {
  const s = scheduleOf({ timezone: "America/Edmonton", start_time: "17:00:00", video_seconds: 8386 });
  assert.deepEqual(s, { ...AILG_R, days: [0, 1, 2, 3, 4, 5, 6] });
  assert.deepEqual(scheduleOf({ timezone: "America/New_York", start_time: "19:30", video_seconds: 10 }).startMinute, 30);
  assert.throws(() => scheduleOf({ timezone: "UTC", start_time: "noon", video_seconds: 1 }));
  assert.deepEqual(fourZones(nextSession(S, mt(2026, 9, 21, 12))), [
    ["Pacific", "4 PM"],
    ["Mountain", "5 PM"],
    ["Central", "6 PM"],
    ["Eastern", "7 PM"],
  ]);
  assert.deepEqual(fourZones(nextSession({ ...S, startMinute: 45 }, mt(2026, 9, 21, 12)))[1], ["Mountain", "5:45 PM"], "minutes show when the start is not on the hour");
});
