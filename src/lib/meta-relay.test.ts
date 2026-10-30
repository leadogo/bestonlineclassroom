import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { parseEvents, validSignature } from "./meta-relay.ts";

const PAGE = "104542139222761";
const IG = "17841405344631477";

test("validSignature: sha256 of the raw body with the app secret, anything else refused", () => {
  const raw = '{"object":"page"}';
  const sig = `sha256=${createHmac("sha256", "s3cret").update(raw).digest("hex")}`;
  assert.equal(validSignature(raw, sig, "s3cret"), true);
  assert.equal(validSignature(raw + " ", sig, "s3cret"), false, "a changed body");
  assert.equal(validSignature(raw, sig, "other"), false, "the wrong secret");
  assert.equal(validSignature(raw, null, "s3cret"), false);
  assert.equal(validSignature(raw, "sha256=abc", "s3cret"), false, "a short signature");
  assert.equal(validSignature(raw, sig, ""), false, "no secret configured");
});

test("parseEvents: Messenger messages and postbacks from people; echoes and our own sends skipped", () => {
  const body = { object: "page", entry: [{ id: PAGE, time: 1, messaging: [
    { sender: { id: "u1" }, recipient: { id: PAGE }, timestamp: 100, message: { mid: "m1", text: "How much does it cost?" } },
    { sender: { id: PAGE }, recipient: { id: "u1" }, timestamp: 101, message: { mid: "m2", text: "hi", is_echo: true } },
    { sender: { id: "u2" }, recipient: { id: PAGE }, timestamp: 102, message: { mid: "m3", attachments: [{ type: "image" }] } },
    { sender: { id: "u3" }, recipient: { id: PAGE }, timestamp: 103, postback: { mid: "p1", title: "Get Started", payload: "GET_STARTED" } },
    { sender: { id: "u4" }, recipient: { id: PAGE }, timestamp: 104, read: { watermark: 1 } },
  ] }] };
  assert.deepEqual(parseEvents(body), [
    { platform: "fb", sender_id: "u1", recipient_id: PAGE, mid: "m1", text: "How much does it cost?", timestamp: 100, kind: "message" },
    { platform: "fb", sender_id: "u2", recipient_id: PAGE, mid: "m3", text: "[image]", timestamp: 102, kind: "message" },
    { platform: "fb", sender_id: "u3", recipient_id: PAGE, mid: "p1", text: "Get Started", timestamp: 103, kind: "postback" },
  ]);
});

test("parseEvents: Instagram DMs and comments, Page feed comments; our own comments, edits and other objects skipped", () => {
  const long = "x".repeat(600);
  const ig = { object: "instagram", entry: [{ id: IG, time: 5, messaging: [{ sender: { id: "ig1" }, recipient: { id: IG }, timestamp: 200, message: { mid: "im1", text: long } }],
    changes: [{ field: "comments", value: { id: "c1", text: "is this free?", from: { id: "ig2", username: "agent" }, media: { id: "md" } } },
      { field: "comments", value: { id: "c2", text: "thanks!", from: { id: IG } } }] }] };
  const ev = parseEvents(ig);
  assert.equal(ev.length, 2);
  assert.equal(ev[0].text.length, 500, "text clipped to 500");
  assert.deepEqual(ev[1], { platform: "ig", sender_id: "ig2", recipient_id: IG, mid: "c1", text: "is this free?", timestamp: 5, kind: "comment" });
  const feed = { object: "page", entry: [{ id: PAGE, time: 9, changes: [
    { field: "feed", value: { item: "comment", verb: "add", comment_id: "fc1", message: "scam", from: { id: "u9" }, created_time: 1700000000 } },
    { field: "feed", value: { item: "comment", verb: "edited", comment_id: "fc2", message: "x", from: { id: "u9" } } },
    { field: "feed", value: { item: "reaction", verb: "add", from: { id: "u9" } } },
  ] }] };
  assert.deepEqual(parseEvents(feed), [{ platform: "fb", sender_id: "u9", recipient_id: PAGE, mid: "fc1", text: "scam", timestamp: 1700000000000, kind: "comment" }]);
  assert.deepEqual(parseEvents({ object: "whatsapp_business_account", entry: [] }), []);
  assert.deepEqual(parseEvents(null), []);
});
