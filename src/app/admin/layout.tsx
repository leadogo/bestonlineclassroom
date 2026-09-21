import { redirect } from "next/navigation";
import { AdminNav, type NavWebinar } from "./admin-nav";
import { signOut } from "../login/actions";
import { assignedEventIds, getTeamMember } from "@/lib/auth";
import { currentOrNextSession, scheduleOf } from "@/lib/daily-schedule";
import { db } from "@/lib/db";
import type { EventRow } from "@/lib/events";

export const dynamic = "force-dynamic";

/** Everything under /admin is for the team: a sidebar with the webinars, the pages on the right. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const member = await getTeamMember().catch(() => null);
  if (!member) redirect("/login");
  const ids = await assignedEventIds(member);
  let q = db().from("events").select("id, slug, title, timezone, start_time, video_seconds, days, logo_url").order("created_at");
  if (ids) q = q.in("id", ids);
  const { data } = await q;
  const now = new Date();
  const webinars: NavWebinar[] = ((data ?? []) as EventRow[]).map((e) => {
    const s = currentOrNextSession(scheduleOf(e), now);
    return { slug: e.slug, title: e.title, live: s.start.getTime() <= now.getTime() && now.getTime() < s.end.getTime(), nextDate: s.date };
  });
  const logoUrl = ((data ?? []) as EventRow[]).find((e) => e.logo_url)?.logo_url ?? null;
  return (
    <div className="min-h-screen bg-room text-ink lg:grid lg:grid-cols-[232px_minmax(0,1fr)]">
      <aside className="flex flex-col border-b border-line bg-panel lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <AdminNav webinars={webinars} isAdmin={member.role === "admin"} user={{ name: member.display_name, role: member.role }} logoUrl={logoUrl} signOut={signOut} />
      </aside>
      <main className="min-w-0 px-4 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
