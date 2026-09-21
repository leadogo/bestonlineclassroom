import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "../login/actions";
import { getTeamMember } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Everything under /admin is for the team. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const member = await getTeamMember().catch(() => null);
  if (!member) redirect("/login");
  return (
    <div className="min-h-screen bg-room text-ink">
      <header className="border-b border-line" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 text-sm sm:px-6">
          <Link href="/admin" className="font-bold">
            BestOnlineClassroom
          </Link>
          <Link href="/admin" className="text-muted hover:text-ink">
            Events
          </Link>
          <Link href="/admin/team" className="text-muted hover:text-ink">
            Team
          </Link>
          <Link href="/mod" className="text-muted hover:text-ink">
            Moderate
          </Link>
          <span className="flex-1" />
          <span className="text-muted">{member.display_name}</span>
          <form action={signOut}>
            <button type="submit" className="rounded-md border border-line px-2.5 py-1 text-muted hover:text-ink">
              Sign out
            </button>
          </form>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
