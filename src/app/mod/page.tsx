import { redirect } from "next/navigation";
import { ModView } from "./mod-view";
import { getTeamMember } from "@/lib/auth";
import { currentOrNextSession, scheduleOf, sessionFor } from "@/lib/daily-schedule";
import { getEvent } from "@/lib/events";

export const dynamic = "force-dynamic";

/** The moderator's seat: tonight's session (or ?date=) for the event (?event=, default ailg-r). */
export default async function ModPage({ searchParams }: { searchParams: Promise<{ event?: string; date?: string }> }) {
  const member = await getTeamMember().catch(() => null);
  if (!member) redirect("/login");
  const sp = await searchParams;
  const event = await getEvent(sp.event ?? "ailg-r").catch(() => null);
  if (!event) return <main className="p-6">No event named {sp.event}.</main>;
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
