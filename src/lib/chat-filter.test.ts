import { test } from "node:test";
import assert from "node:assert/strict";
import { checkMessage, cleanName, exposesRecording } from "./chat-filter.ts";

test("chat filter: links, swearing, scam lines and shouting are refused; ordinary questions pass", () => {
  assert.equal(checkMessage("Great session, thanks William!").ok, true);
  assert.equal(checkMessage("How do I get the AI to book showings for me?").ok, true);
  assert.equal(checkMessage("Where do I sign up?").ok, true);
  assert.deepEqual(checkMessage("check https://example.com now"), { ok: false, kind: "link", reason: "Links can't be shared in the chat." });
  assert.equal(checkMessage("go to bestdeals.co for leads").ok, false);
  assert.equal(checkMessage("www.something.net").ok, false);
  assert.equal(checkMessage("this is fucking great").ok, false);
  assert.equal(checkMessage("DM me for guaranteed returns on crypto").ok, false);
  assert.equal(checkMessage("text me on WhatsApp").ok, false);
  assert.equal(checkMessage("YESSSSSSSSSSSSSSSSSSS").ok, false);
  assert.equal(checkMessage("Is it 5 pm ET or MT?").ok, true, "no false positive on plain text");
  assert.equal(checkMessage("kick ass session").ok, false, "milder swearing too");
  assert.equal(checkMessage("email me at jane@example.com").ok, true, "contact details are allowed (support)");
  assert.equal(checkMessage("call 403-555-1234").ok, true, "phone numbers are allowed");
  assert.equal(cleanName("  Sarah  Lee "), "Sarah Lee");
  assert.equal(cleanName("Dumbass"), null);
  assert.equal(cleanName("www.spam.com"), null);
  assert.equal(checkMessage("I closed 12 deals in 2025").ok, true, "numbers in sentences are fine");
  assert.equal(checkMessage("I use Google Sheets and a CRM").ok, true, "product names are fine");
});

test("exposesRecording: claims and agreements that the room is a recording; questions, hopes and replay requests pass", () => {
  for (const s of ["this is a recording", "This is recorded", "this is already a replay...", "This is a pre recorded video", "@Haroon Afzal because it's recorded", "this has to be a recording because the air quality thing was in June", "yes this is a recording", "yeah its a replay lol", "lol this is obviously prerecorded", "it's not live", "this isn't even live", "I think this is a recording", "the comments are prerecorded", "its fake", "pre-recorded"])
    assert.equal(exposesRecording(s), true, s);
  for (const s of ["Is this a recording?", "is this live", "Is this live or a pre-recorded video?", "Are these sessions recorded?", "Do you have recording of this", "can i get the recording please", "Will there be a replay as I need to step out", "Can replay be available?", "I hope this is recorded", "if this is recorded can you send it", "yes please send the recording", "yes I'd love the replay", "replay", "recording", "Will there be a recording sent later?", "I use AI for making video and creating content", "this is a reply lol", "I'll watch the replay later", "it will be recorded right", "the call is automated"])
    assert.equal(exposesRecording(s), false, s);
});
