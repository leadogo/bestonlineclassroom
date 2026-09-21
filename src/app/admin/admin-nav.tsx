"use client";
// The sidebar: the webinars (with a red dot while one is live), the team, and who is signed in. On a phone it is a
// top bar with the same links in a row.
import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavWebinar = { slug: string; title: string; live: boolean; nextDate: string };

const item = (active: boolean) => `flex min-h-10 items-center gap-2 rounded-lg px-3 text-[15px] ${active ? "bg-line/60 font-bold text-ink" : "text-muted hover:bg-line/40 hover:text-ink"}`;
const sub = (active: boolean) => `flex min-h-9 items-center rounded-md px-3 text-sm ${active ? "font-bold text-ink" : "text-muted hover:text-ink"}`;

export function AdminNav({ webinars, isAdmin, user, logoUrl, signOut }: { webinars: NavWebinar[]; isAdmin: boolean; user: { name: string; role: string }; logoUrl: string | null; signOut: () => Promise<void> }) {
  const path = usePathname();
  const onWebinar = (slug: string) => path.startsWith(`/admin/events/${slug}`);
  return (
    <>
      <div className="flex items-center gap-3 px-3 py-2 lg:px-2 lg:py-3">
        <Link href="/admin" className="flex items-center gap-2 font-bold" aria-label="BestOnlineClassroom admin">
          {logoUrl ? <img src={logoUrl} alt="" className="h-9 w-auto" /> : "BestOnlineClassroom"}
        </Link>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-2 pb-2 lg:flex-1 lg:flex-col lg:overflow-visible lg:px-2 lg:pb-0" aria-label="Admin">
        <Link href="/admin" className={item(path === "/admin")}>
          Webinars
        </Link>
        {webinars.map((w) => (
          <div key={w.slug} className="lg:pl-2">
            <Link href={isAdmin ? `/admin/events/${w.slug}` : `/admin/events/${w.slug}/sessions/${w.nextDate}`} className={item(onWebinar(w.slug))} title={w.title}>
              <span className={`h-2 w-2 shrink-0 rounded-full ${w.live ? "bg-live live-dot" : "bg-line"}`} aria-hidden />
              <span className="truncate">{w.title}</span>
            </Link>
            {onWebinar(w.slug) && (
              <div className="hidden flex-col pl-6 lg:flex">
                {isAdmin && (
                  <Link href={`/admin/events/${w.slug}`} className={sub(path === `/admin/events/${w.slug}`)}>
                    Settings
                  </Link>
                )}
                <Link href={`/admin/events/${w.slug}/sessions/${w.nextDate}`} className={sub(path.includes("/sessions/"))}>
                  Registrants
                </Link>
                <Link href={`/admin/events/${w.slug}/analytics`} className={sub(path.endsWith("/analytics"))}>
                  Analytics
                </Link>
                <Link href={`/mod/${w.slug}`} className={sub(false)}>
                  Moderate
                </Link>
              </div>
            )}
          </div>
        ))}
        <Link href="/admin/blocked" className={item(path.startsWith("/admin/blocked"))}>
          Blocked
        </Link>
        {isAdmin && (
          <Link href="/admin/team" className={item(path.startsWith("/admin/team"))}>
            Team
          </Link>
        )}
      </nav>
      <div className="hidden items-center justify-between gap-2 border-t border-line px-3 py-3 text-sm lg:flex">
        <div className="min-w-0">
          <p className="truncate font-bold">{user.name}</p>
          <p className="text-xs text-muted">{user.role === "admin" ? "Admin" : "Moderator"}</p>
        </div>
        <form action={signOut}>
          <button type="submit" className="rounded-md border border-line px-2.5 py-1 text-xs text-muted hover:text-ink">
            Sign out
          </button>
        </form>
      </div>
    </>
  );
}
