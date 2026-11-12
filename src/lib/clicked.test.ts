import assert from "node:assert/strict";
import { test } from "node:test";
import { unbookedClickers, type Booking, type ClickedAttendance } from "./clicked.ts";

const clicker = (id: string, fields: Partial<ClickedAttendance["registrant"]> & Partial<ClickedAttendance> = {}): ClickedAttendance => ({
  registrant_id: id,
  kind: "live",
  cta_clicked_at: "2026-11-12T02:00:00Z",
  registrant: { first_name: "Ana", email: "ana@example.com", phone: "+1 (403) 555-0100", source: "site", ...fields.registrant },
  ...fields,
});

const booking = (fields: Partial<Booking>): Booking => ({ registrant_id: null, email: null, phone: null, status: "scheduled", ...fields });

test("clicked: excludes bookings by registrant, email, or normalized phone", () => {
  const rows = [
    clicker("by-id"),
    clicker("by-email", { registrant: { first_name: "Bea", email: "Bea@Example.com", phone: null, source: "site" } }),
    clicker("by-phone", { registrant: { first_name: "Cam", email: null, phone: "+1 403 555 0100", source: "site" } }),
  ];
  const bookings = [
    booking({ registrant_id: "by-id" }),
    booking({ email: "bea@example.com" }),
    booking({ phone: "403-555-0100" }),
  ];
  assert.deepEqual(unbookedClickers(rows, bookings), []);
});

test("clicked: excludes tests and replay-only or non-clicking attendance, keeping an unbooked live clicker", () => {
  const rows = [
    clicker("test", { registrant: { first_name: "Test", email: null, phone: null, source: "test" } }),
    clicker("replay", { kind: "replay" }),
    clicker("no-click", { cta_clicked_at: null }),
    clicker("kept", { registrant: { first_name: "Kai", email: "kai@example.com", phone: null, source: "site" } }),
  ];
  assert.deepEqual(unbookedClickers(rows, []), [{ registrant_id: "kept", name: "Kai", email: "kai@example.com", phone: null, clicked_at: "2026-11-12T02:00:00Z" }]);
});
