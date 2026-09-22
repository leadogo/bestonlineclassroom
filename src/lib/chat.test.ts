import { test } from "node:test";
import assert from "node:assert/strict";
import { canPost, mergeUpdates, simulatedCursor, slackLine, splitBody, trimCrowd, trimList, type ChatItem, splitMentions } from "./chat.ts";

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

test("splitMentions: only the stored names are marked; without names, one word after @", () => {
  assert.deepEqual(splitMentions("hi @Sarah Lee how are you @bob", ["Sarah Lee"]), [
    { text: "hi ", mention: false },
    { text: "@Sarah Lee", mention: true },
    { text: " how are you @bob", mention: false },
  ]);
  assert.deepEqual(splitMentions("@Will Great point", ["Will"]), [
    { text: "@Will", mention: true },
    { text: " Great point", mention: false },
  ]);
  assert.deepEqual(splitMentions("@Will Great point"), [
    { text: "@Will", mention: true },
    { text: " Great point", mention: false },
  ]);
  assert.deepEqual(splitMentions("no mentions"), [{ text: "no mentions", mention: false }]);
  assert.deepEqual(splitMentions("@Ann"), [{ text: "@Ann", mention: true }]);
  assert.deepEqual(splitMentions("@Willow here", ["Will"]), [{ text: "@Willow here", mention: false }]);
  assert.deepEqual(splitMentions("mail me@example.com", ["Sarah"]), [{ text: "mail me@example.com", mention: false }]);
});

test("splitBody: links only when asked, trailing period stays text, mentions still coloured", () => {
  assert.deepEqual(splitBody("@Priya Here you go: https://bookmoreshowings.com/book?fn=Priya.", ["Priya"], true), [
    { text: "@Priya", kind: "mention" },
    { text: " Here you go: ", kind: "text" },
    { text: "https://bookmoreshowings.com/book?fn=Priya", kind: "link" },
    { text: ".", kind: "text" },
  ]);
  assert.deepEqual(splitBody("see www.example.com now", [], true), [
    { text: "see ", kind: "text" },
    { text: "www.example.com", kind: "link" },
    { text: " now", kind: "text" },
  ]);
  assert.deepEqual(splitBody("see https://example.com now", [], false), [{ text: "see https://example.com now", kind: "text" }]);
});

test("trimCrowd: real rows are never dropped, only the oldest crowd rows", () => {
  const list = Array.from({ length: 705 }, (_, i) => ({ key: String(i), name: "", role: i % 141 === 0 ? ("attendee" as const) : ("simulated" as const), body: "", at: i, reactions: {} }));
  const kept = trimCrowd(list, 300);
  assert.equal(kept.filter((x) => x.role === "attendee").length, list.filter((x) => x.role === "attendee").length);
  assert.equal(kept.filter((x) => x.role === "simulated").length, 300);
  assert.equal(kept[kept.length - 1].key, "704");
  assert.equal(trimCrowd(list.slice(0, 50), 300).length, 50);
});
