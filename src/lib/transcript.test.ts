import { test } from "node:test";
import assert from "node:assert/strict";
import { parseVtt } from "./captions.ts";
import { cuesFor, forgetTranscripts, onScreen, segmentAt, windowAt } from "./transcript.ts";

const VTT = `WEBVTT

00:00:40.000 --> 00:00:44.000
Let me know in the chat what market you are in.

00:01:00.000 --> 00:01:10.000
Type YES if that makes sense.

00:02:00.000 --> 00:02:12.000
The pixel reads the listing pages, not anyone's personal posts.

00:03:30.000 --> 00:03:40.000
Now the offer.

00:05:00.000 --> 00:05:30.000
Last words.
`;
const cues = parseVtt(VTT);
const chapters = [{ at: 0, label: "Start" }, { at: 200, label: "The pixel" }, { at: 210, label: "Offer" }];

test("windowAt: what he just said and what comes next, by the attendee's second", () => {
  // At the start nothing has been said; the next two minutes include the cue starting exactly 120 s ahead.
  assert.deepEqual(windowAt(cues, 0), { said: "", next: "Let me know in the chat what market you are in. Type YES if that makes sense. The pixel reads the listing pages, not anyone's personal posts." });
  assert.equal(windowAt(cues, 0, 90, 119).next.includes("pixel"), false);
  // At 2:05 the pixel cue spans the moment (in), the YES cue ended 55 s ago (in), the market cue ended 81 s ago (in); next is the offer only.
  assert.deepEqual(windowAt(cues, 125), { said: "Let me know in the chat what market you are in. Type YES if that makes sense. The pixel reads the listing pages, not anyone's personal posts.", next: "Now the offer." });
  // A cue that ended exactly 90 s ago is out; one that ended 89 s ago is in.
  assert.equal(windowAt(cues, 134).said.startsWith("Let me know"), false);
  assert.equal(windowAt(cues, 133).said.startsWith("Let me know"), true);
  // Nothing after the last cue; nothing before the first.
  assert.deepEqual(windowAt(cues, 330), { said: "Last words.", next: "" });
  assert.deepEqual(windowAt([], 100), { said: "", next: "" });
  // A narrower window for the desk's one-liner.
  assert.deepEqual(windowAt(cues, 72, 20, 0), { said: "Type YES if that makes sense.", next: "" });
});

test("segmentAt and onScreen: the chapter they are in, the minute, and null without a transcript", () => {
  assert.equal(segmentAt(chapters, 0), "Start");
  assert.equal(segmentAt(chapters, 205), "The pixel");
  assert.equal(segmentAt(chapters, 900), "Offer");
  assert.equal(segmentAt([], 5), null);
  const o = onScreen(cues, chapters, 125, 8385)!;
  assert.equal(o.segment, "Start (minute 2 of 139)");
  assert.match(o.said, /pixel reads the listing pages/);
  assert.equal(onScreen([], chapters, 125, 8385), null);
  // The captions offset shifts the lookup: with the room showing cues 60 s late, video second 185 is cue second 125.
  assert.equal(onScreen(cues, chapters, 185, null, 60)!.said, o.said);
  assert.equal(onScreen(cues, [], 125, null)!.segment, null);
});

test("cuesFor: one fetch per URL, a failure is empty and not retried at once, no URL is empty", async () => {
  forgetTranscripts();
  let calls = 0;
  const ok = (async () => { calls++; return new Response(VTT, { status: 200 }); }) as unknown as typeof fetch;
  assert.equal((await cuesFor("https://x/a.vtt", ok)).length, 5);
  assert.equal((await cuesFor("https://x/a.vtt", ok)).length, 5);
  assert.equal(calls, 1);
  const bad = (async () => { calls++; return new Response("nope", { status: 500 }); }) as unknown as typeof fetch;
  assert.deepEqual(await cuesFor("https://x/b.vtt", bad), []);
  assert.deepEqual(await cuesFor("https://x/b.vtt", bad), []);
  assert.equal(calls, 2);
  assert.deepEqual(await cuesFor(null, ok), []);
  forgetTranscripts();
});
