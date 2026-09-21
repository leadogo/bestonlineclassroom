import { test } from "node:test";
import assert from "node:assert/strict";
import { countReactions, EMOJIS } from "./moderation.ts";

test("reactions: one row per person per emoji becomes counts; anything outside the set is ignored", () => {
  assert.deepEqual(countReactions([{ emoji: "❤️" }, { emoji: "❤️" }, { emoji: "🔥" }, { emoji: "💀" }]), { "❤️": 2, "🔥": 1 });
  assert.deepEqual(countReactions([]), {});
  assert.equal(EMOJIS.length, 5);
});
