import { db } from "@/lib/db";
import { getEvent } from "@/lib/events";
import { currentOrNextSession, scheduleOf, sessionFor } from "@/lib/daily-schedule";
import { joinUrl } from "@/lib/registrants";

export const dynamic = "force-dynamic";
const SECRET = process.env.REGISTER_SECRET ?? "";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/registrants/day?event=ailg-r&date=YYYY-MM-DD (Bearer REGISTER_SECRET): everyone registered for one
 * session, with what Katherine's reminder calls need (phone, join link, when it starts) and what her nightly sync
 * reads back (live attendance). Test identities never appear; blocked people are marked, not hidden. Without a
 * date, the running-or-next session.
 */
export async function GET(request: Request) {
  if (!SECRET || request.headers.get("authorization") !== `Bearer ${SECRET}`) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const q = new URL(request.url).searchParams;
  const event = await getEvent(q.get("event") ?? "ailg-r").catch(() => null);
  if (!event) return Response.json({ error: "Not found" }, { status: 404 });
  const schedule = scheduleOf(event);
  const date = q.get("date");
  const session = date ? (DATE_RE.test(date) ? sessionFor(schedule, date) : null) : currentOrNextSession(schedule);
  if (!session) return Response.json({ error: "Bad date" }, { status: 400 });

  const { data: regs, error } = await db()
    .from("registrants")
    .select("id, token, first_name, email, phone, source, blocked_at, created_at, flags")
    .eq("event_id", event.id)
    .eq("session_date", session.date)
    .neq("source", "test")
    .order("created_at");
  if (error) return Response.json({ error: "Read failed" }, { status: 500 });

  const ids = (regs ?? []).map((r) => r.id as string);
  const live = new Map<string, number>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await db().from("attendance").select("registrant_id, seconds_watched").in("registrant_id", ids.slice(i, i + 200)).eq("session_date", session.date).eq("kind", "live");
    for (const a of data ?? []) live.set(String(a.registrant_id), Number(a.seconds_watched ?? 0));
  }

  return Response.json(
    {
      event: { slug: event.slug, title: event.title, timezone: event.timezone },
      session: { date: session.date, start: session.start.toISOString(), end: session.end.toISOString() },
      registrants: (regs ?? []).map((r) => ({
        id: r.id,
        token: r.token,
        first_name: r.first_name,
        email: r.email,
        phone: r.phone,
        source: r.source,
        registered_at: r.created_at,
        blocked: Boolean(r.blocked_at),
        join_url: joinUrl(r.token),
        attended_live: live.has(r.id as string),
        live_seconds: live.get(r.id as string) ?? 0,
        flags: r.flags ?? {},
      })),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
