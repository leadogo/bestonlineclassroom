import { unbookedClickers, type Booking, type ClickedAttendance } from "@/lib/clicked";
import { db, pageAll } from "@/lib/db";
import { getEvent } from "@/lib/events";

export const dynamic = "force-dynamic";

const SECRET = process.env.REGISTER_SECRET ?? "";

function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);
}

/** GET /api/metrics/clicked?event=ailg-r&date=YYYY-MM-DD (Bearer REGISTER_SECRET): live Book clickers who have not booked, for leadogo's nightly call list. */
export async function GET(request: Request) {
  if (!SECRET || request.headers.get("authorization") !== `Bearer ${SECRET}`) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const q = new URL(request.url).searchParams;
  const event = await getEvent(q.get("event") ?? "ailg-r").catch(() => null);
  if (!event) return Response.json({ error: "Unknown event" }, { status: 404 });
  const date = q.get("date");
  if (!date || !validDate(date)) return Response.json({ error: "date=YYYY-MM-DD required" }, { status: 400 });
  const through = new Date(`${date}T00:00:00Z`);
  through.setUTCDate(through.getUTCDate() + 3);
  const throughDate = through.toISOString().slice(0, 10);
  const throughAt = new Date(through.getTime() + 86_400_000).toISOString();
  const fromAt = `${date}T00:00:00.000Z`;
  const [attendance, bookings, scans] = await Promise.all([
    pageAll<ClickedAttendance>((from, to) =>
      db().from("attendance").select("registrant_id, kind, cta_clicked_at, registrant:registrants!inner(first_name, email, phone, source, event_id)").eq("session_date", date).eq("kind", "live").eq("registrant.event_id", event.id).order("registrant_id").range(from, to) as unknown as PromiseLike<{ data: ClickedAttendance[] | null; error: { message: string } | null }>,
    ),
    pageAll<Booking>((from, to) =>
      db().from("bookings").select("registrant_id, email, phone, status").eq("event_id", event.id).neq("status", "cancelled").neq("status", "canceled").or(`and(booked_at.gte.${fromAt},booked_at.lt.${throughAt}),and(session_date.gte.${date},session_date.lte.${throughDate})`).order("id").range(from, to) as unknown as PromiseLike<{ data: Booking[] | null; error: { message: string } | null }>,
    ),
    db().from("link_clicks").select("id", { count: "exact", head: true }).eq("event_id", event.id).eq("session_date", date).eq("path", "qr").eq("outcome", "scan"),
  ]);
  if (scans.error) return Response.json({ error: "Lookup failed" }, { status: 500 });
  return Response.json({ event: event.slug, session_date: date, clickers: unbookedClickers(attendance, bookings), qr_scans: scans.count ?? 0 }, { headers: { "cache-control": "no-store" } });
}
