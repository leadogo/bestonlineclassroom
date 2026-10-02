import { test } from "node:test";
import assert from "node:assert/strict";
import { openLinkLine, openLinkVerdict, shiftDay } from "./open-link.ts";

const base = { cards: 186, submitted: 82, joined: 64 }; // the 11 name-only nights measured Oct 1

test("a blast night at the old rate is green", () => {
  const v = openLinkVerdict({ cards: 57, submitted: 37, joined: 33 }, base);
  assert.equal(v.light, "🟢");
  assert.ok(Math.abs((v.rate ?? 0) - 0.65) < 0.01);
});

test("a blast night far under the baseline is red and says what to flip", () => {
  const v = openLinkVerdict({ cards: 40, submitted: 12, joined: 10 }, base);
  assert.equal(v.light, "🔴");
  assert.match(v.note, /flip Settings/);
});

test("a quiet night never alarms, and no baseline never alarms", () => {
  assert.equal(openLinkVerdict({ cards: 9, submitted: 1, joined: 0 }, base).light, "⚪");
  assert.equal(openLinkVerdict({ cards: 60, submitted: 10, joined: 5 }, { cards: 0, submitted: 0, joined: 0 }).light, "⚪");
});

test("the line reads as one sentence with the numbers in it", () => {
  const line = openLinkLine("AI For Agents Masterclass", "2026-10-02", { cards: 34, submitted: 23, joined: 22 }, base, 7);
  assert.match(line, /^🟢 Open link, AI For Agents Masterclass 2026-10-02: 34 cards → 23 emails \(68%\) → 22 joined\. name-only baseline 44% over 7 nights \(82 of 186\)\.$/);
});

test("shiftDay moves whole days across a month end", () => {
  assert.equal(shiftDay("2026-10-01", -7), "2026-09-24");
  assert.equal(shiftDay("2026-09-30", 1), "2026-10-01");
});
