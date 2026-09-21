import Link from "next/link";
import { DeleteWebinar, NewWebinar } from "./dash-forms";
import { LiveStrip } from "./live-strip";
import { btn, btnQuiet, Empty, PageHeader, Stat } from "./ui";
import { assignedEventIds, getTeamMember } from "@/lib/auth";
import { currentOrNextSession, scheduleOf } from "@/lib/daily-schedule";
import { db } from "@/lib/db";
import type { EventRow } from "@/lib/events";

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
type Last = { session_date: string; registered: number; joined: number; live_at_pitch: number; clicked_offer: number };

const when = (d: Date, tz: string) => new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(d);
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
    <div className="flex flex-col gap-8">
      <PageHeader title="Webinars" subtitle={me.role === "admin" ? "Everything that runs on BestOnlineClassroom, what is happening now, and how the last session went." : "The webinars you moderate."} />
      {cards.length === 0 && <Empty>No webinars yet.</Empty>}
      <ul className="flex flex-col gap-5">
        {cards.map(({ e, session, live, registrants, inRoom, last, mods }) => (
          <li key={e.id} className={`overflow-hidden rounded-xl border bg-panel ${live ? "border-live" : "border-line"}`}>
            <LiveStrip startsAt={session.start.getTime()} endsAt={session.end.getTime()} serverNow={now.getTime()} inRoom={inRoom} nextText={when(session.start, e.timezone)} scheduleText={`${e.days.length === 7 ? "Daily" : e.days.map((d) => DAY[d]).join(", ")} at ${e.start_time.slice(0, 5)} ${e.timezone.split("/")[1]?.replace("_", " ") ?? ""}`} />
            <div className="flex flex-col gap-5 px-5 py-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                {me.role === "admin" ? (
                  <Link href={`/admin/events/${e.slug}`} className="text-xl font-bold hover:underline">
                    {e.title}
                  </Link>
                ) : (
                  <span className="text-xl font-bold">{e.title}</span>
                )}
                <span className="text-sm text-muted">
                  {e.video_seconds ? `${Math.round(e.video_seconds / 60)} min video` : "No video yet"} · link /w/{e.slug}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
                <Stat label={live ? "registered tonight" : "registered for it"} value={registrants} />
                <Stat label={last ? `joined last time (${last.session_date.slice(5)})` : "joined last time"} value={last ? last.joined : "—"} sub={last ? `${pct(last.joined, last.registered)} of ${last.registered} registered` : "no session yet"} />
                <Stat label="live at the pitch" value={last ? last.live_at_pitch : "—"} sub={last ? pct(last.live_at_pitch, last.joined) + " of joiners" : undefined} />
                <Stat label="clicked the offer" value={last ? last.clicked_offer : "—"} tone={last && last.clicked_offer ? "cta" : undefined} />
              </div>
              <p className="text-sm text-muted">Moderating: {mods.join(", ") || "nobody assigned"}</p>
              <div className="flex flex-wrap gap-2">
                <Link href={`/mod/${e.slug}`} className={btn}>
                  Moderate
                </Link>
                <Link href={`/admin/events/${e.slug}/sessions/${session.date}`} className={btnQuiet}>
                  Registrants
                </Link>
                <Link href={`/admin/events/${e.slug}/analytics`} className={btnQuiet}>
                  Analytics
                </Link>
                {me.role === "admin" && (
                  <Link href={`/admin/events/${e.slug}`} className={btnQuiet}>
                    Settings
                  </Link>
                )}
                <a href={`/w/${e.slug}?at=0`} className={btnQuiet} target="_blank" rel="noopener">
                  Preview room
                </a>
                <a href={`/w/${e.slug}?at=${e.cta_at_seconds ?? 0}`} className={btnQuiet} target="_blank" rel="noopener">
                  Preview at the pitch
                </a>
                {last && (
                  <Link href={`/admin/events/${e.slug}/sessions/${last.session_date}`} className={btnQuiet}>
                    Last session
                  </Link>
                )}
              </div>
              {me.role === "admin" && e.slug !== "ailg-r" && <DeleteWebinar slug={e.slug} />}
            </div>
          </li>
        ))}
      </ul>
      {me.role === "admin" && <NewWebinar events={events.map((e) => ({ slug: e.slug, title: e.title, start_time: e.start_time }))} />}
      <p className="text-xs text-muted">Live counts are people seen in the last two minutes. Previews open the room as it looks at that minute; only the team can use them.</p>
    </div>
  );
}
