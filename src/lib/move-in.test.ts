import { test } from "node:test";
import assert from "node:assert/strict";
import { AILG_R } from "./daily-schedule.ts";
import { roomDateFor } from "./move-in.ts";

test("roomDateFor: an old row during a live session is behind and reads tonight; tonight's row, a future row and any row outside the live window are not (SPEC-link-opens.md, B)", () => {
  const live = new Date("2026-10-20T23:30:00Z"); // 5:30 PM Mountain, the room is live
  assert.deepEqual(roomDateFor(AILG_R, "2026-09-21", live), { date: "2026-10-20", behind: true });
  assert.deepEqual(roomDateFor(AILG_R, "2026-10-20", live), { date: "2026-10-20", behind: false }, "already tonight's");
  assert.deepEqual(roomDateFor(AILG_R, "2026-10-22", live), { date: "2026-10-22", behind: false }, "a future row (a preview, a later registration) is never moved");
  const countdown = new Date("2026-10-20T22:00:00Z"); // 4 PM Mountain
  assert.deepEqual(roomDateFor(AILG_R, "2026-09-21", countdown), { date: "2026-09-21", behind: false }, "nothing moves before the room is live");
  const ended = new Date("2026-10-21T02:00:00Z"); // 8 PM Mountain
  assert.deepEqual(roomDateFor(AILG_R, "2026-09-21", ended), { date: "2026-09-21", behind: false });
});
