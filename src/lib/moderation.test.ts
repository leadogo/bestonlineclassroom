import { test } from "node:test";
import assert from "node:assert/strict";
import { applyReaction, EMOJIS } from "./moderation.ts";

test("reactions: increments within the set, rejects anything else", () => {
  assert.deepEqual(applyReaction(null, "❤️"), { "❤️": 1 });
  assert.deepEqual(applyReaction({ "❤️": 2, "🔥": 1 }, "🔥"), { "❤️": 2, "🔥": 2 });
  assert.equal(applyReaction({}, "💀"), null);
  assert.equal(EMOJIS.length, 5);
});
