// The nightly sales-call feed: live offer clickers who have not booked. Pure so the route only reads rows.

export type ClickedAttendance = {
  registrant_id: string;
  kind: string;
  cta_clicked_at: string | null;
  registrant: { first_name: string; last_name?: string | null; email: string | null; phone: string | null; source: string | null };
};

export type Booking = { registrant_id: string | null; email: string | null; phone: string | null; status: string | null };

export type Clicker = { registrant_id: string; name: string; email: string | null; phone: string | null; clicked_at: string };

function email(value: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

function phone(value: string | null): string {
  return value ? value.replace(/\D/g, "").slice(-10) : "";
}

function isBooked(row: ClickedAttendance, bookings: readonly Booking[]): boolean {
  const rowEmail = email(row.registrant.email);
  const rowPhone = phone(row.registrant.phone);
  return bookings.some((booking) => {
    if (booking.status === "cancelled" || booking.status === "canceled") return false;
    return booking.registrant_id === row.registrant_id || Boolean(rowEmail && rowEmail === email(booking.email)) || Boolean(rowPhone && rowPhone === phone(booking.phone));
  });
}

export function unbookedClickers(rows: readonly ClickedAttendance[], bookings: readonly Booking[]): Clicker[] {
  return rows
    .filter((row) => row.kind === "live" && row.cta_clicked_at && row.registrant.source !== "test" && !isBooked(row, bookings))
    .map((row) => ({
      registrant_id: row.registrant_id,
      name: [row.registrant.first_name, row.registrant.last_name].filter(Boolean).join(" "),
      email: row.registrant.email,
      phone: row.registrant.phone,
      clicked_at: row.cta_clicked_at as string,
    }));
}
