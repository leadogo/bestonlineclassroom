import { test } from "node:test";
import assert from "node:assert/strict";
import { canPost, mergeUpdates, simulatedCursor, slackLine, trimList, type ChatItem } from "./chat.ts";

const rows = [33, 37, 37, 60, 4460].map((o, i) => ({ offset_seconds: o, name: `n${i}`, body: `b${i}` }));

test("simulatedCursor: whole history on the first call, then only what was crossed since", () => {
  const first = simulatedCursor(rows, 40, 0);
  assert.deepEqual(first.items.map((r) => r.body), ["b0", "b1", "b2"]);
  const same = simulatedCursor(rows, 41, first.nextIndex);
  assert.deepEqual(same.items, []);
  const next = simulatedCursor(rows, 60, same.nextIndex);
  assert.deepEqual(next.items.map((r) => r.body), ["b3"]);
  assert.equal(simulatedCursor(rows, 9999, next.nextIndex).items.length, 1);
  assert.deepEqual(simulatedCursor(rows, 0, 0), { items: [], nextIndex: 0 });
});

test("mergeUpdates: deletes remove, reactions update in place, simulated rows untouched", () => {
  const list: ChatItem[] = [
    { key: "s1", name: "Sim", role: "simulated", body: "hi", at: 1, reactions: {} },
    { key: "r1", id: 1, name: "Ana", role: "attendee", body: "q", at: 2, reactions: {} },
    { key: "r2", id: 2, name: "Bo", role: "attendee", body: "x", at: 3, reactions: {} },
  ];
  const out = mergeUpdates(list, [{ id: 1, reactions: { "❤️": 2 }, deleted: false }, { id: 2, reactions: {}, deleted: true }, { id: 9, reactions: {}, deleted: true }]);
  assert.deepEqual(out.map((i) => i.key), ["s1", "r1"]);
  assert.deepEqual(out[1].reactions, { "❤️": 2 });
  assert.equal(mergeUpdates(list, []), list);
});

test("posting rule and Slack line", () => {
  assert.equal(canPost(null, 1000), true);
  assert.equal(canPost(1000, 2500), false);
  assert.equal(canPost(1000, 3000), true);
  assert.equal(slackLine("Ana", "ana@x.com", "Is this recorded?"), "Ana / ana@x.com / Is this recorded?");
  assert.equal(slackLine("Bo", null, "hi"), "Bo / guest / hi");
  assert.equal(trimList(Array.from({ length: 450 }, (_, i) => ({ key: String(i), name: "", role: "simulated" as const, body: "", at: i, reactions: {} }))).length, 400);
});
