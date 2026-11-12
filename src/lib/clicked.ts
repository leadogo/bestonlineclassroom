// The nightly sales-call feed: live offer clickers who have not booked. Pure so the route only reads rows.
import { phoneKey } from "./client-wall.ts";
import { normalizeEmail } from "./registrants.ts";

export type ClickedAttendance = {
  registrant_id: string;
  kind: string;
  cta_clicked_at: string | null;
  registrant: { first_name: string; email: string | null; phone: string | null; source: string | null };
};

export type Booking = { registrant_id: string | null; email: string | null; phone: string | null; status: string | null };

export type Clicker = { registrant_id: string; name: string; email: string | null; phone: string | null; clicked_at: string };

export function unbookedClickers(rows: readonly ClickedAttendance[], bookings: readonly Booking[]): Clicker[] {
  const live = bookings.filter((b) => b.status !== "cancelled" && b.status !== "canceled");
  const ids = new Set(live.map((b) => b.registrant_id));
  const emails = new Set(live.map((b) => normalizeEmail(b.email)));
  const phones = new Set(live.map((b) => phoneKey(b.phone)));
  return rows
    .filter((row) => {
      const { email, phone, source } = row.registrant;
      const rowEmail = normalizeEmail(email);
      const rowPhone = phoneKey(phone);
      return row.kind === "live" && row.cta_clicked_at && source !== "test" && !ids.has(row.registrant_id) && !(rowEmail && emails.has(rowEmail)) && !(rowPhone && phones.has(rowPhone));
    })
    .map((row) => ({
      registrant_id: row.registrant_id,
      name: row.registrant.first_name,
      email: row.registrant.email,
      phone: row.registrant.phone,
      clicked_at: row.cta_clicked_at as string,
    }));
}
