import { test } from "node:test";
import assert from "node:assert/strict";
import { buildInvite } from "./ics.ts";

test("invite: request method, UTC times, escaped description, folded lines", () => {
  const ics = buildInvite({
    uid: "sb7wkcxs8gmt@bestonlineclassroom.com",
    start: new Date("2026-09-21T23:00:00Z"),
    end: new Date("2026-09-22T01:19:45Z"),
    title: "AI For Agents Masterclass",
    description: "Your private link: https://bestonlineclassroom.com/j/sb7wkcxs8gmt\nJoin 5 minutes early; sound on.",
    url: "https://bestonlineclassroom.com/j/sb7wkcxs8gmt",
    organizerName: "William Kabrall",
    organizerEmail: "admin@bookmoreshowings.com",
    attendeeName: "Ana",
    attendeeEmail: "ana@x.com",
  });
  const flat = ics.replace(/\r\n /g, "");
  assert.match(flat, /METHOD:REQUEST/);
  assert.match(flat, /DTSTART:20260921T230000Z/);
  assert.match(flat, /DTEND:20260922T011945Z/);
  assert.match(flat, /DESCRIPTION:Your private link: https:\/\/bestonlineclassroom.com\/j\/sb7wkcxs8gmt\\nJoin 5 minutes early\\; sound on\./);
  assert.match(flat, /ORGANIZER;CN=William Kabrall:mailto:admin@bookmoreshowings.com/);
  for (const line of ics.split("\r\n")) assert.ok(Buffer.byteLength(line) <= 75, `line too long: ${line}`);
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
});
