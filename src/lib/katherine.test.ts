import { test } from "node:test";
import assert from "node:assert/strict";
import { asksForReplay } from "./katherine.ts";

test("asksForReplay: replay, recording, rewatch and watch later, not the rest", () => {
  for (const s of ["will there be a replay?", "Is this recorded", "can I get the recording", "have to leave, can I rewatch", "can i watch it later", "Will you record this"]) assert.equal(asksForReplay(s), true, s);
  for (const s of ["does it work with Follow Up Boss", "how much is it", "replaying my old leads is hard"]) assert.equal(asksForReplay(s), false, s);
});
