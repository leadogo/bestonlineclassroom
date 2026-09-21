import Link from "next/link";
import { DeleteWebinar, NewWebinar } from "./dash-forms";
import { assignedEventIds, getTeamMember } from "@/lib/auth";
import { currentOrNextSession, scheduleOf } from "@/lib/daily-schedule";
import { db } from "@/lib/db";
import type { EventRow } from "@/lib/events";

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
type Last = { session_date: string; registered: number; joined: number; live_at_pitch: number; clicked_offer: number };

const when = (d: Date, tz: string) => new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(d);
const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "—");

/** The operating screen: every webinar, what is happening now, the next session and how the last one went. */
export default async function AdminHome() {
  const me = (await getTeamMember())!;
  const ids = await assignedEventIds(me);
  let q = db().from("events").select("*").order("created_at");
  if (ids) q = q.in("id", ids);
  const [{ data }, team, assigns] = await Promise.all([q, db().from("team_members").select("id, display_name, role"), db().from("team_assignments").select("member_id, event_id")]);
  const events = (data ?? []) as EventRow[];
  const now = new Date();
  const cards = await Promise.all(
    events.map(async (e) => {
      const schedule = scheduleOf(e);
      const session = currentOrNextSession(schedule, now);
      const live = session.start.getTime() <= now.getTime() && now.getTime() < session.end.getTime();
      const [regs, inRoom, last] = await Promise.all([
        db().from("registrants").select("id", { count: "exact", head: true }).eq("event_id", e.id).eq("session_date", session.date).neq("source", "test"),
        live ? db().from("attendance").select("registrant_id, registrant:registrants!inner(event_id)", { count: "exact", head: true }).eq("session_date", session.date).eq("kind", "live").eq("registrant.event_id", e.id).gte("last_seen_at", new Date(now.getTime() - 120_000).toISOString()) : Promise.resolve({ count: 0 }),
        db().from("session_metrics").select("session_date, registered, joined, live_at_pitch, clicked_offer").eq("event_id", e.id).lt("session_date", session.date).order("session_date", { ascending: false }).limit(1).maybeSingle(),
      ]);
      const mods = (team.data ?? []).filter((m) => m.role === "admin" || (assigns.data ?? []).some((a) => a.member_id === m.id && a.event_id === e.id)).map((m) => m.display_name);
      return { e, session, live, registrants: regs.count ?? 0, inRoom: inRoom.count ?? 0, last: (last.data as Last | null) ?? null, mods };
    }),
  );
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Webinars</h1>
      <ul className="grid gap-4 lg:grid-cols-2">
        {cards.map(({ e, session, live, registrants, inRoom, last, mods }) => (
          <li key={e.id} className={`flex flex-col gap-3 rounded-xl border bg-panel p-4 ${live ? "border-live" : "border-line"}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              {me.role === "admin" ? (
                <Link href={`/admin/events/${e.slug}`} className="text-lg font-bold hover:underline">
                  {e.title}
                </Link>
              ) : (
                <span className="text-lg font-bold">{e.title}</span>
              )}
              {live ? (
                <span className="rounded-full bg-live px-2.5 py-0.5 text-xs font-bold text-white">
                  LIVE now · {inRoom} in the room
                </span>
              ) : (
                <span className="text-xs text-muted">/w/{e.slug}</span>
              )}
            </div>
            <p className="text-sm text-muted">
              {e.days.length === 7 ? "Daily" : e.days.map((d) => DAY[d]).join(", ")} at {e.start_time.slice(0, 5)} {e.timezone}. {e.video_seconds ? `${Math.round(e.video_seconds / 60)} min video.` : "No video yet."}
            </p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">{live ? "Tonight" : "Next session"}</dt>
                <dd className="font-bold">{when(session.start, e.timezone)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Registered for it</dt>
                <dd className="font-bold tabular-nums">{registrants}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Moderating</dt>
                <dd>{mods.join(", ") || "nobody assigned"}</dd>
              </div>
              <div className="col-span-2 sm:col-span-3">
                <dt className="text-xs uppercase tracking-wide text-muted">Last session {last ? `(${last.session_date})` : ""}</dt>
                <dd className="tabular-nums">
                  {last ? (
                    <>
                      {last.registered} registered · {last.joined} joined ({pct(last.joined, last.registered)} show-up) · {last.live_at_pitch} live at the pitch · {last.clicked_offer} clicks
                    </>
                  ) : (
                    "no session yet"
                  )}
                </dd>
              </div>
            </dl>
            <div className="flex flex-wrap gap-3 text-sm">
              {me.role === "admin" && (
                <Link href={`/admin/events/${e.slug}`} className="text-brand underline">
                  Settings
                </Link>
              )}
              <Link href={`/admin/events/${e.slug}/sessions/${session.date}`} className="text-brand underline">
                Registrants
              </Link>
              {last && (
                <Link href={`/admin/events/${e.slug}/sessions/${last.session_date}`} className="text-brand underline">
                  Last session
                </Link>
              )}
              <Link href={`/mod/${e.slug}`} className="text-brand underline">
                Moderate
              </Link>
              <Link href={`/admin/events/${e.slug}/analytics`} className="text-brand underline">
                Analytics
              </Link>
              <a href={`/w/${e.slug}?at=0`} className="text-brand underline" target="_blank" rel="noopener">
                Preview room
              </a>
              <a href={`/w/${e.slug}?at=${e.cta_at_seconds ?? 0}`} className="text-brand underline" target="_blank" rel="noopener">
                Preview at the CTA
              </a>
            </div>
            {me.role === "admin" && e.slug !== "ailg-r" && <DeleteWebinar slug={e.slug} />}
          </li>
        ))}
      </ul>
      {me.role === "admin" && <NewWebinar events={events.map((e) => ({ slug: e.slug, title: e.title, start_time: e.start_time }))} />}
      <p className="text-xs text-muted">Live counts are people seen in the last two minutes.</p>
    </div>
  );
}
