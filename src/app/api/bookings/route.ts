import { db } from "@/lib/db";
import { getEvent } from "@/lib/events";
import { localDate, scheduleOf, sessionFor } from "@/lib/daily-schedule";
import { phoneDigits } from "@/lib/cta";

export const dynamic = "force-dynamic";

const SECRET = process.env.REGISTER_SECRET ?? "";
const UUID = /^[0-9a-f-]{36}$/i;

type In = { external_id: string; email?: string | null; phone?: string | null; name?: string | null; booked_at: string; rid?: string | null; status?: string | null };

/**
 * POST { event, bookings: [{ external_id, email, phone, name, booked_at, rid?, status? }] } (Bearer REGISTER_SECRET):
 * iClosed bookings pushed by leadogo, matched to the session they came from: the room link's rid first, else the
 * email or phone of someone holding a link, else the day's session (a booking before that day's pitch counts for
 * the previous session). Idempotent on (source, external_id).
 */
export async function POST(request: Request) {
  if (!SECRET || request.headers.get("authorization") !== `Bearer ${SECRET}`) return Response.json({ error: "Unauthorized" }, { status: 401 });
  let b: { event?: string; bookings?: In[] };
  try {
    b = (await request.json()) as typeof b;
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const event = await getEvent(b.event ?? "ailg-r").catch(() => null);
  if (!event) return Response.json({ error: "Unknown event" }, { status: 404 });
  const schedule = scheduleOf(event);
  const pitchMs = (event.cta_at_seconds ?? 0) * 1000;
  let stored = 0;
  let matched = 0;
  const results: Array<Record<string, unknown>> = [];
  for (const x of (b.bookings ?? []).slice(0, 500)) {
    const at = new Date(x.booked_at);
    if (!x.external_id || Number.isNaN(at.getTime())) continue;
    const email = (x.email ?? "").trim().toLowerCase() || null;
    const digits = phoneDigits(x.phone);
    let reg: { id: string; session_date: string } | null = null;
    if (x.rid && UUID.test(x.rid)) reg = (await db().from("registrants").select("id, session_date").eq("id", x.rid).eq("event_id", event.id).maybeSingle()).data ?? null;
    if (!reg && email) reg = (await db().from("registrants").select("id, session_date").eq("event_id", event.id).eq("email", email).lte("session_date", localDate(schedule, at)).order("session_date", { ascending: false }).limit(1).maybeSingle()).data ?? null;
    if (!reg && digits.length >= 10) reg = (await db().from("registrants").select("id, session_date").eq("event_id", event.id).like("phone", `%${digits.slice(-10)}`).lte("session_date", localDate(schedule, at)).order("session_date", { ascending: false }).limit(1).maybeSingle()).data ?? null;
    let session_date = reg?.session_date ?? null;
    if (!session_date) {
      // No link: the day's session if the booking came at or after its pitch, else the previous session day.
      for (let back = 0; back < 7 && !session_date; back++) {
        const s = sessionFor(schedule, localDate(schedule, new Date(at.getTime() - back * 86_400_000)));
        if (s && at.getTime() >= s.start.getTime() + pitchMs) session_date = s.date;
      }
      if (!session_date) session_date = localDate(schedule, at);
    }
    const { error } = await db().from("bookings").upsert({ source: "iclosed", external_id: String(x.external_id), event_id: event.id, session_date, registrant_id: reg?.id ?? null, name: x.name ?? null, email, phone: x.phone ?? null, booked_at: at.toISOString(), status: x.status ?? "scheduled" }, { onConflict: "source,external_id" });
    if (error) {
      console.error("[bookings] upsert failed", { code: error.code });
      continue;
    }
    stored += 1;
    if (reg) matched += 1;
    // What the appointments post says about them: where they came from and what they did tonight.
    let detail: Record<string, unknown> = {};
    if (reg) {
      const full = (await db().from("registrants").select("first_name, source, attribution, created_at, session_date").eq("id", reg.id).maybeSingle()).data;
      const a = (full?.attribution ?? {}) as Record<string, string>;
      const att = (await db().from("attendance").select("joined_at, seconds_watched, cta_clicked_at, last_seen_at").eq("registrant_id", reg.id).eq("session_date", session_date).eq("kind", "live").maybeSingle()).data;
      const sess = sessionFor(schedule, session_date);
      const pitchMs2 = sess ? sess.start.getTime() + pitchMs : null;
      detail = {
        source: full?.source ?? null, ad: a.utm_content ?? null, campaign: a.utm_campaign ?? null, medium: a.utm_medium ?? null,
        optin_days_ago: full?.created_at ? Math.floor((at.getTime() - new Date(full.created_at).getTime()) / 86_400_000) : null,
        minutes: att ? Math.round(((att.seconds_watched as number) ?? 0) / 60) : 0,
        at_pitch: Boolean(att && pitchMs2 !== null && new Date(att.joined_at as string).getTime() <= pitchMs2 && new Date(att.last_seen_at as string).getTime() + 120_000 >= pitchMs2),
        clicked_at: att?.cta_clicked_at ?? null,
        minutes_after_pitch: pitchMs2 !== null ? Math.round((at.getTime() - pitchMs2) / 60_000) : null,
      };
    }
    results.push({ external_id: String(x.external_id), session_date, matched: Boolean(reg), status: x.status ?? "scheduled", ...detail });
  }
  return Response.json({ stored, matched, results });
}
