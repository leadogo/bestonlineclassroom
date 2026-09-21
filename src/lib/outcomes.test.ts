import { test } from "node:test";
import assert from "node:assert/strict";
import { retentionCurve, tagsFor, peakConcurrent } from "./outcomes.ts";

const names = { registered: "reg", attended: "a", missed: "m", watched_replay: "r", left_early: "le", stayed_40min: "w40", asked_question: "q", clicked_offer: "c", saw_offer_no_click: "s" };

test("tags: session-end outcomes wait for the end; replay, question and click do not", () => {
  const o = { registered: true, attended: true, missed: false, watched_replay: true, left_early: false, stayed_40min: true, asked_question: true, clicked_offer: false, saw_offer_no_click: true };
  assert.deepEqual(tagsFor(o, names, false), ["reg", "r", "q"]);
  assert.deepEqual(tagsFor(o, names, true), ["a", "w40", "s", "reg", "r", "q"]);
  assert.deepEqual(tagsFor({ ...o, attended: false, missed: true, watched_replay: false, asked_question: false, stayed_40min: false, saw_offer_no_click: false }, names, true), ["m", "reg"]);
  assert.deepEqual(tagsFor(o, { attended: "a" }, true), ["a"], "unnamed outcomes send nothing");
});

test("retention curve by 10-minute marks", () => {
  const curve = retentionCurve([300, 1500, 4600, 8000], 1800);
  assert.deepEqual(curve, [
    { at: 0, share: 1 },
    { at: 600, share: 0.75 },
    { at: 1200, share: 0.75 },
    { at: 1800, share: 0.5 },
  ]);
  assert.deepEqual(retentionCurve([], 600), [{ at: 0, share: 0 }, { at: 600, share: 0 }]);
});

test("peakConcurrent: the most overlapping intervals at any sampled minute", () => {
  const m = (n: number) => n * 60_000;
  assert.equal(peakConcurrent([]), 0);
  assert.equal(peakConcurrent([{ from: 0, to: m(10) }, { from: m(5), to: m(20) }, { from: m(30), to: m(40) }]), 2);
  assert.equal(peakConcurrent([{ from: 0, to: m(1) }, { from: m(2), to: m(3) }]), 1);
});
