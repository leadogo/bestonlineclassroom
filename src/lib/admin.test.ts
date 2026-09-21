import { test } from "node:test";
import assert from "node:assert/strict";
import { chaptersText, parseChapters, parseNames, parseSeconds, secondsText } from "./admin.ts";

test("chapters round-trip through text", () => {
  const text = "0:00 Start\n5:00 Who William is\n1:15:00 Offer and next steps\nnot a chapter\n";
  const c = parseChapters(text);
  assert.deepEqual(c, [
    { at: 0, label: "Start" },
    { at: 300, label: "Who William is" },
    { at: 4500, label: "Offer and next steps" },
  ]);
  assert.equal(chaptersText(c), "0:00 Start\n5:00 Who William is\n1:15:00 Offer and next steps");
  assert.deepEqual(parseChapters("1:24:00 Q&A\n0:27:00 System"), [
    { at: 1620, label: "System" },
    { at: 5040, label: "Q&A" },
  ]);
});

test("seconds and names", () => {
  assert.equal(parseSeconds("1:15:00"), 4500);
  assert.equal(parseSeconds("75:00"), 4500);
  assert.equal(parseSeconds("4500"), 4500);
  assert.equal(parseSeconds("soon"), null);
  assert.equal(secondsText(8259), "2:17:39");
  assert.deepEqual(parseNames("Connor, Chris Hrista\n Connor \nDeb"), ["Connor", "Chris Hrista", "Deb"]);
});
