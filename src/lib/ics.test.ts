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

test("calendar invite for a registrant: 75 minutes, their own link, no attendee line without an email", async () => {
  const { calendarInvite } = await import("./ics.ts");
  const session = { date: "2026-10-30", start: new Date("2026-10-30T23:00:00Z"), end: new Date("2026-10-31T01:19:45Z") };
  const ics = calendarInvite({ token: "sb7wkcxs8gmt", first_name: "Ana", email: null }, { title: "AI Leads Masterclass", host_name: "William Kabrall" }, session, "https://bestonlineclassroom.com/j/sb7wkcxs8gmt?src=calendar", "admin@bookmoreshowings.com").replace(/\r\n /g, "");
  assert.match(ics, /UID:sb7wkcxs8gmt-2026-10-30@bestonlineclassroom.com/);
  assert.match(ics, /DTSTART:20261030T230000Z/);
  assert.match(ics, /DTEND:20261031T001500Z/);
  assert.match(ics, /Your private link to join: https:\/\/bestonlineclassroom.com\/j\/sb7wkcxs8gmt\?src=calendar/);
  assert.doesNotMatch(ics, /ATTENDEE/);
  const withEmail = calendarInvite({ token: "t", first_name: "Ana", email: "ana@x.com" }, { title: "T", host_name: "W" }, session, "https://x/j/t", "a@b.c").replace(/\r\n /g, "");
  assert.match(withEmail, /ATTENDEE;CN=Ana.*mailto:ana@x.com/);
});

test("calendar session: the registrant's own session until it ends, then the running-or-next one", async () => {
  const { calendarSession } = await import("./ics.ts");
  const own = { date: "2026-10-29", start: new Date("2026-10-29T23:00:00Z"), end: new Date("2026-10-30T01:20:00Z") };
  const next = { date: "2026-10-30", start: new Date("2026-10-30T23:00:00Z"), end: new Date("2026-10-31T01:20:00Z") };
  assert.equal(calendarSession(own, next, new Date("2026-10-29T20:00:00Z")).date, "2026-10-29");
  assert.equal(calendarSession(own, next, new Date("2026-10-30T02:00:00Z")).date, "2026-10-30", "a past registrant's link moves into tonight");
  assert.equal(calendarSession(null, next, new Date("2026-10-29T20:00:00Z")).date, "2026-10-30");
});
