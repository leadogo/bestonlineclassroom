import { redirect } from "next/navigation";
import { AdminNav, type NavWebinar } from "./admin-nav";
import { setAutopilot } from "./actions";
import { signOut } from "../login/actions";
import { assignedEventIds, getTeamMember } from "@/lib/auth";
import { currentOrNextSession, scheduleOf } from "@/lib/daily-schedule";
import { db } from "@/lib/db";
import type { EventRow } from "@/lib/events";
import { engaged, lastDeskSeen } from "@/lib/kaitlyn";

export const dynamic = "force-dynamic";

/** The sidebar's Autopilot line (SPEC-kaitlyn-autopilot.md): what she is doing right now, from the switch, the desk's presence and tonight's decisions. */
async function autopilotStatus(e: EventRow, date: string, startMs: number, live: boolean, nowMs: number): Promise<string> {
  const ap = e.autopilot ?? "auto";
  if ((e.kaitlyn_mode ?? "off") === "off") return "Kaitlyn is off for this webinar";
  if (!live) return ap === "off" ? "off · drafts only" : ap === "on" ? "on · answers on her own from the first message" : "armed · takes over 3 min after the last moderator leaves, or at minute 5 if nobody opens the desk";
  const [seen, done, waiting] = await Promise.all([
    lastDeskSeen(e.id, date),
    db().from("kaitlyn_decisions").select("id", { count: "exact", head: true }).eq("event_id", e.id).eq("session_date", date).eq("status", "auto").eq("autopilot", true),
    db().from("kaitlyn_decisions").select("id", { count: "exact", head: true }).eq("event_id", e.id).eq("session_date", date).eq("status", "pending"),
  ]);
  const tail = `${done.count ?? 0} answered, ${waiting.count ?? 0} waiting for you`;
  if (ap === "off") return `off · drafts only · ${waiting.count ?? 0} waiting for you`;
  const ago = seen === null ? null : Math.round((nowMs - seen) / 60_000);
  const desk = seen === null ? "nobody has opened the desk" : ago === 0 ? "someone is on the desk" : `desk empty ${ago} min`;
  return engaged(ap, seen, Math.floor((nowMs - startMs) / 60_000), nowMs) ? `engaged · ${ap === "on" ? "switch is On" : desk} · ${tail}` : `armed · ${desk} · ${tail}`;
}

/** Everything under /admin is for the team: a sidebar with the webinars, the pages on the right. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const member = await getTeamMember().catch(() => null);
  if (!member) redirect("/login");
  const ids = await assignedEventIds(member);
  let q = db().from("events").select("id, slug, title, timezone, start_time, video_seconds, days, logo_url, autopilot, kaitlyn_mode").order("created_at");
  if (ids) q = q.in("id", ids);
  const { data } = await q;
  const now = new Date();
  const webinars: NavWebinar[] = await Promise.all(
    ((data ?? []) as EventRow[]).map(async (e) => {
      const s = currentOrNextSession(scheduleOf(e), now);
      const live = s.start.getTime() <= now.getTime() && now.getTime() < s.end.getTime();
      return { slug: e.slug, title: e.title, live, nextDate: s.date, autopilot: e.autopilot ?? "auto", kaitlyn: (e.kaitlyn_mode ?? "off") !== "off", status: await autopilotStatus(e, s.date, s.start.getTime(), live, now.getTime()) };
    }),
  );
  const logoUrl = ((data ?? []) as EventRow[]).find((e) => e.logo_url)?.logo_url ?? null;
  // Open knowledge questions across the real webinars, for the sidebar badge (SPEC-kaitlyn-knowledge.md).
  const realIds = ((data ?? []) as EventRow[]).filter((e) => !e.slug.startsWith("test")).map((e) => e.id);
  const knowledgeOpen = member.role === "admin" && realIds.length ? ((await db().from("kaitlyn_kb").select("key", { count: "exact", head: true }).in("event_id", realIds).eq("handling", "open")).count ?? 0) : 0;
  return (
    <div className="min-h-screen bg-room text-ink lg:grid lg:grid-cols-[232px_minmax(0,1fr)]">
      <aside className="flex flex-col border-b border-line bg-panel lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <AdminNav webinars={webinars} isAdmin={member.role === "admin"} user={{ name: member.display_name, role: member.role }} logoUrl={logoUrl} signOut={signOut} setAutopilot={setAutopilot} knowledgeOpen={knowledgeOpen} />
      </aside>
      <main className="min-w-0 px-4 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
