import Link from "next/link";
import { notFound } from "next/navigation";
import { btnQuiet, PageHeader } from "../../../ui";
import { canModerate, getTeamMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEvent } from "@/lib/events";

export const dynamic = "force-dynamic";

const mmss = (s: number) => `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}`;

/** Every question asked in the room, with who answered it: the record a future AI moderator learns from (phase 6.3, note 27). */
export default async function Questions({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ days?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const event = await getEvent(slug);
  if (!event) notFound();
  const me = (await getTeamMember())!;
  if (!(await canModerate(me, event.id))) notFound();
  const days = sp.days === "90" ? 90 : 30;
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const { data: rows } = await db().from("chat_messages").select("id, session_date, offset_seconds, author_name, body, answered_by, created_at").eq("event_id", event.id).eq("role", "attendee").eq("is_question", true).is("deleted_at", null).gte("session_date", since).order("created_at", { ascending: false }).limit(800);
  const team = new Map(((await db().from("team_members").select("id, display_name")).data ?? []).map((m) => [m.id as string, m.display_name as string]));
  const list = rows ?? [];
  const answered = list.filter((r) => r.answered_by).length;
  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <PageHeader title={`Questions · ${event.title}`} subtitle={`${list.length} questions in the last ${days} days, ${answered} answered by a moderator. Stored with the minute of the recording so the same question can be answered before it is asked.`}>
        <Link href={`/admin/events/${slug}/questions?days=${days === 30 ? 90 : 30}`} className={btnQuiet}>Last {days === 30 ? 90 : 30} days</Link>
        <a href={`/admin/events/${slug}/analytics/export?kind=questions&days=${days}`} className={btnQuiet}>Download CSV</a>
        <Link href={`/admin/events/${slug}`} className={btnQuiet}>Back</Link>
      </PageHeader>
      <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-panel">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs uppercase tracking-wide text-muted"><th className="px-3 py-2">Session</th><th className="px-3 py-2">Minute</th><th className="px-3 py-2">Who</th><th className="px-3 py-2">Question</th><th className="px-3 py-2">Answered by</th></tr></thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-muted">No questions yet.</td></tr>}
            {list.map((r) => (
              <tr key={r.id} className="border-t border-line/60 align-top">
                <td className="px-3 py-2 whitespace-nowrap tabular-nums">{r.session_date}</td>
                <td className="px-3 py-2 whitespace-nowrap tabular-nums">{mmss(r.offset_seconds ?? 0)}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.author_name}</td>
                <td className="px-3 py-2">{r.body}</td>
                <td className="px-3 py-2 whitespace-nowrap text-muted">{r.answered_by ? (team.get(r.answered_by as string) ?? "a moderator") : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
