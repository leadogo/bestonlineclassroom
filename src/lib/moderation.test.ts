import { test } from "node:test";
import assert from "node:assert/strict";
import { countReactions, EMOJIS, GHOST_REASONS, ghostReason } from "./moderation.ts";

test("reactions: one row per person per emoji becomes counts; anything outside the set is ignored", () => {
  assert.deepEqual(countReactions([{ emoji: "❤️" }, { emoji: "❤️" }, { emoji: "🔥" }, { emoji: "💀" }]), { "❤️": 2, "🔥": 1 });
  assert.deepEqual(countReactions([]), {});
  assert.equal(EMOJIS.length, 5);
});

test("ghostReason: the desk's chip becomes the stored reason; anything else is a plain by-hand ghost (SPEC-kaitlyn-ghosts.md, B4)", () => {
  assert.equal(ghostReason("price"), "by hand: price");
  assert.equal(ghostReason("not a prospect"), "by hand: not a prospect");
  assert.equal(ghostReason("other"), "by hand");
  assert.equal(ghostReason(undefined), "by hand");
  assert.equal(ghostReason("drop table"), "by hand");
  assert.equal(GHOST_REASONS.length, 6);
});
