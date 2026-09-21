import { test } from "node:test";
import assert from "node:assert/strict";
import { liveCaptions, parseVtt, pieces, reflow } from "./captions.ts";

const SAMPLE = `WEBVTT

00:00:40.000 --> 00:00:44.000
But let me know in the Zoom chat what market are you all in just so I can see

00:00:44.000 --> 00:00:47.000
where everyone is from tonight
`;

test("captions: long cues become short pieces that never overlap and follow the words in time", () => {
  assert.deepEqual(pieces("But let me know in the Zoom chat what market are you all in just so I can see"), ["But let me know in the Zoom chat what", "market are you all in just so I can see"]);
  const cues = reflow(parseVtt(SAMPLE));
  assert.equal(cues.length, 3);
  assert.equal(cues[0].start, 40);
  assert.ok(cues[0].end <= cues[1].start + 1e-9 && cues[1].end <= 44 + 1e-9, "pieces share the cue's 4 seconds");
  assert.ok(cues.every((c) => c.text.length <= 42), "one line each");
  assert.ok(liveCaptions(SAMPLE, 2).includes("00:00:42.000 -->"), "offset shifts the start");
  assert.equal(reflow(parseVtt(SAMPLE), -50)[0].start, 0, "a negative offset never goes below zero");
});
