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
      const first = await db().from("events").select("slug").in("id", ids).order("created_at").limit(1).maybeSingle();
      slug = (first.data?.slug as string | undefined) ?? "ailg-r";
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
      member={member}
      event={{ slug: event.slug, title: event.title, iconUrl: event.icon_url, hostName: event.host_name }}
      session={{ date: session.date, startsAt: session.start.getTime(), endsAt: session.end.getTime() }}
      serverNow={new Date().getTime()}
    />
  );
}
