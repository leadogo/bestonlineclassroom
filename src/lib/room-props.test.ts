import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRoom } from "./room-props.ts";
import { zoned } from "./tz.ts";
import type { EventRow } from "./events.ts";
import type { Registrant } from "./attendees.ts";

const event = { id: "e", slug: "ailg-r", title: "T", host_name: "William Kabrall", timezone: "America/Edmonton", start_time: "17:00:00", video_url: "https://v", video_seconds: 8386, cta_at_seconds: 4500, cta_hide_seconds: null, cta_label: "Book", cta_href: "https://x/y", end_url: "https://x/expired", simulated_names: [], logo_url: null, icon_url: null, chapters: [], replay_hours: 72, replay_copy: {}, tags: {}, reminder_rules: [], days: [0, 1, 2, 3, 4, 5, 6], confirmation: {} } as unknown as EventRow;
const reg = (session_date: string) => ({ id: "r", event_id: "e", session_date, token: "abcdefghijkl", first_name: "Sarah", email: "s@x.com", email_hash: "", phone: null, source: "site", site_registration_id: null, blocked_at: null, replay_opened_at: null, confirmation_sent_at: null, room_join_reported_at: null, legacy_key: null, skool_invited_at: null } as unknown as Registrant);
const mt = (y: number, m: number, d: number, h: number, min = 0) => zoned(y, m, d, h, min, "America/Edmonton");

test("an old link joins the session running now, waits for the next one after a day, and shows the end page only within a day of its own session", () => {
  const old = buildRoom(event, reg("2026-09-16"), {}, mt(2026, 9, 21, 17, 30));
  assert.equal(old.kind, "room");
  if (old.kind === "room") {
    assert.equal(old.props.state, "live");
    assert.equal(old.rejoinDate, "2026-09-21");
    assert.equal(old.props.sessionDate, "2026-09-21");
  }
  const waiting = buildRoom(event, reg("2026-09-16"), {}, mt(2026, 9, 21, 9, 0));
  assert.equal(waiting.kind, "room");
  if (waiting.kind === "room") {
    assert.equal(waiting.props.state, "countdown");
    assert.equal(waiting.rejoinDate, "2026-09-21");
  }
  const justEnded = buildRoom(event, reg("2026-09-21"), {}, mt(2026, 9, 21, 20, 0));
  assert.equal(justEnded.kind, "ended", "an hour after their own session: the end page");
  const nextDay = buildRoom(event, reg("2026-09-21"), {}, mt(2026, 9, 22, 21, 0));
  assert.equal(nextDay.kind, "room", "more than a day later: the next session's countdown");
});
