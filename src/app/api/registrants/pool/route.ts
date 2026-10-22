import { db } from "@/lib/db";
import { getEvent } from "@/lib/events";
import { joinUrl } from "@/lib/registrants";

export const dynamic = "force-dynamic";
const SECRET = process.env.REGISTER_SECRET ?? "";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 31;
const PAGE = 1000;

/**
 * GET /api/registrants/pool?event=ailg-r&from=YYYY-MM-DD&to=YYYY-MM-DD (Bearer REGISTER_SECRET): everyone who
 * registered for a session in the range, with what they did since (live seconds, replay seconds, whether they
 * booked a call) and where the row came from (`source`: site, legacy, sms, skool…), for Katherine's re-invite calls.
 * Test identities never appear; blocked people are marked.
 */
export async function GET(request: Request) {
  if (!SECRET || request.headers.get("authorization") !== `Bearer ${SECRET}`) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const q = new URL(request.url).searchParams;
  const event = await getEvent(q.get("event") ?? "ailg-r").catch(() => null);
  if (!event) return Response.json({ error: "Not found" }, { status: 404 });
  const from = q.get("from") ?? "";
  const to = q.get("to") ?? "";
  if (!DATE_RE.test(from) || !DATE_RE.test(to) || from > to) return Response.json({ error: "Bad range" }, { status: 400 });
  if ((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000 > MAX_DAYS) return Response.json({ error: "Range too long" }, { status: 400 });

  // Paged: PostgREST answers at most 1,000 rows a call whatever the limit says, and a 30-day window holds ~3,500
  // (22 Oct 2026: Katherine's planner saw the oldest thousand and nothing newer).
  const outcomes: Array<{ registrant_id: string; session_date: string; first_name: string; email: string | null; source: string | null; live_seconds: number | null; replay_seconds: number | null }> = [];
  for (let start = 0; ; start += PAGE) {
    const { data, error } = await db()
      .from("registrant_outcomes")
      .select("registrant_id, session_date, first_name, email, source, live_seconds, replay_seconds")
      .eq("event_id", event.id)
      .gte("session_date", from)
      .lte("session_date", to)
      .neq("source", "test")
      .order("session_date")
      .order("registrant_id")
      .range(start, start + PAGE - 1);
    if (error) return Response.json({ error: "Read failed" }, { status: 500 });
    outcomes.push(...((data ?? []) as typeof outcomes));
    if (!data || data.length < PAGE) break;
  }

  const ids = outcomes.map((o) => String(o.registrant_id));
  const regs = new Map<string, { token: string; phone: string | null; blocked: boolean; created_at: string; flags: Record<string, unknown> }>();
  const booked = new Set<string>();
  const emails = new Set<string>();
  for (let i = 0; i < ids.length; i += 200) {
    const slice = ids.slice(i, i + 200);
    const { data: rs } = await db().from("registrants").select("id, token, phone, blocked_at, created_at, flags, email").in("id", slice);
    for (const r of rs ?? []) {
      regs.set(String(r.id), { token: String(r.token), phone: (r.phone as string | null) ?? null, blocked: Boolean(r.blocked_at), created_at: String(r.created_at), flags: (r.flags as Record<string, unknown>) ?? {} });
      if (r.email) emails.add(String(r.email).toLowerCase());
    }
    const { data: bs } = await db().from("bookings").select("registrant_id, email").eq("event_id", event.id).in("registrant_id", slice);
    for (const b of bs ?? []) if (b.registrant_id) booked.add(String(b.registrant_id));
  }
  // A booking made under the same email from a later registration still counts: they booked.
  const emailList = [...emails];
  const bookedEmails = new Set<string>();
  for (let i = 0; i < emailList.length; i += 200) {
    const { data: bs } = await db().from("bookings").select("email").eq("event_id", event.id).in("email", emailList.slice(i, i + 200));
    for (const b of bs ?? []) if (b.email) bookedEmails.add(String(b.email).toLowerCase());
  }

  return Response.json(
    {
      event: { slug: event.slug, title: event.title, timezone: event.timezone },
      from,
      to,
      registrants: outcomes.flatMap((o) => {
        const r = regs.get(String(o.registrant_id));
        if (!r) return [];
        const email = o.email ? String(o.email).toLowerCase() : null;
        return [{
          id: o.registrant_id,
          token: r.token,
          session_date: o.session_date,
          first_name: o.first_name,
          email: o.email,
          source: o.source,
          phone: r.phone,
          registered_at: r.created_at,
          blocked: r.blocked,
          join_url: joinUrl(r.token),
          live_seconds: Number(o.live_seconds ?? 0),
          replay_seconds: Number(o.replay_seconds ?? 0),
          booked: booked.has(String(o.registrant_id)) || (email !== null && bookedEmails.has(email)),
          flags: r.flags,
        }];
      }),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
