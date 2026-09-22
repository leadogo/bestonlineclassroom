import { redirect } from "next/navigation";
import { ModView } from "./mod-view";
import { assignedEventIds, canModerate, getTeamMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { currentOrNextSession, scheduleOf, sessionFor } from "@/lib/daily-schedule";
import { getEvent } from "@/lib/events";

export const dynamic = "force-dynamic";

/** The moderator's seat: tonight's session (or ?date=) for the event (?event=, default ailg-r, or /mod/<slug>). */
export default async function ModPage({ searchParams }: { searchParams: Promise<{ event?: string; date?: string }> }) {
  const sp = await searchParams;
  return <ModSeat slug={sp.event} date={sp.date} />;
}

export async function ModSeat({ slug, date }: { slug?: string; date?: string }) {
  const member = await getTeamMember().catch(() => null);
  if (!member) redirect("/login");
  if (!slug) {
    const ids = await assignedEventIds(member);
    if (ids === null) slug = "ailg-r";
    else {
      if (ids.length === 0) return <main className="p-6 text-base">You&rsquo;re on the team, but not assigned to a webinar yet. Ask an admin.</main>;
      const mine = ((await db().from("events").select("slug, title, timezone, start_time, video_seconds, days").in("id", ids).order("created_at")).data ?? []) as Array<{ slug: string; title: string; timezone: string; start_time: string; video_seconds: number | null; days: number[] }>;
      if (mine.length === 1) slug = mine[0].slug;
      else {
        const now = new Date();
        const rows = mine.map((e) => {
          const s = currentOrNextSession(scheduleOf(e), now);
          return { ...e, live: s.start.getTime() <= now.getTime() && now.getTime() < s.end.getTime(), when: new Intl.DateTimeFormat("en-US", { timeZone: e.timezone, weekday: "short", hour: "numeric", minute: "2-digit" }).format(s.start) };
        });
        return (
          <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-6">
            <h1 className="text-2xl font-bold">Which webinar?</h1>
            <ul className="flex flex-col gap-3">
              {rows.map((e) => (
                <li key={e.slug}>
                  <a href={`/mod/${e.slug}`} className={`flex min-h-14 items-center justify-between gap-3 rounded-xl border px-4 text-base font-bold ${e.live ? "border-live bg-live/10" : "border-line bg-panel"}`}>
                    <span className="truncate">{e.title}</span>
                    <span className={`shrink-0 text-sm font-normal ${e.live ? "text-live" : "text-muted"}`}>{e.live ? "Live now" : `Next ${e.when}`}</span>
                  </a>
                </li>
              ))}
            </ul>
          </main>
        );
      }
    }
  }
  const event = await getEvent(slug).catch(() => null);
  if (!event) return <main className="p-6">No event named {slug}.</main>;
  if (!(await canModerate(member, event.id))) return <main className="p-6 text-base">You&rsquo;re not assigned to {event.title}. Ask an admin.</main>;
  const sp = { date };
  const schedule = scheduleOf(event);
  const session = sessionFor(schedule, sp.date) ?? currentOrNextSession(schedule);
  return (
    <ModView
      member={{ id: member.id, display_name: member.display_name, email: member.email }}
      event={{ slug: event.slug, title: event.title, iconUrl: event.icon_url, hostName: event.host_name, videoUrl: event.video_url, ctaAt: event.cta_at_seconds }}
      session={{ date: session.date, startsAt: session.start.getTime(), endsAt: session.end.getTime() }}
      serverNow={new Date().getTime()}
      backHref={member.role === "admin" ? `/admin/events/${event.slug}` : "/admin"}
    />
  );
}
