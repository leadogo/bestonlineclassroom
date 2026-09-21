import Link from "next/link";
import { notFound } from "next/navigation";
import { setBlocked } from "./actions";
import { SessionMetrics, type Metrics } from "./metrics";
import { currentOrNextSession, scheduleOf, sessionFor } from "@/lib/daily-schedule";
import { db } from "@/lib/db";
import { getEvent } from "@/lib/events";
import { joinUrl, replayUrl } from "@/lib/registrants";

type Row = { id: string; first_name: string; email: string | null; source: string; token: string; created_at: string; blocked_at: string | null; attendance: Array<{ kind: string; joined_at: string; seconds_watched: number; max_offset: number; cta_clicked_at: string | null }> };

/** Who registered for a session, who came, how long they stayed, who clicked. Search by name or email. */
export default async function SessionAdmin({ params, searchParams }: { params: Promise<{ slug: string; date: string }>; searchParams: Promise<{ q?: string }> }) {
  const { slug, date } = await params;
  const { q = "" } = await searchParams;
  const event = await getEvent(slug);
  if (!event) notFound();
  const schedule = scheduleOf(event);
  const session = sessionFor(schedule, date) ?? currentOrNextSession(schedule);
  let query = db().from("registrants").select("id, first_name, email, source, token, created_at, blocked_at, attendance(kind, joined_at, seconds_watched, max_offset, cta_clicked_at)").eq("event_id", event.id).eq("session_date", session.date).order("created_at", { ascending: false }).limit(500);
  if (q.trim()) query = query.or(`first_name.ilike.%${q.trim()}%,email.ilike.%${q.trim()}%`);
  const { data } = await query;
  const rows = (data ?? []) as unknown as Row[];
  const metrics = (await db().from("session_metrics").select("*").eq("event_id", event.id).eq("session_date", session.date).maybeSingle()).data as Metrics | null;
  const offsetsRes = await db().from("attendance").select("max_offset, registrant:registrants!inner(source)").eq("session_date", session.date).eq("kind", "live").eq("registrant.event_id", event.id);
  const offsets = (offsetsRes.data ?? []).filter((a) => (a.registrant as unknown as { source: string }).source !== "test").map((a) => a.max_offset as number);
  const real = rows.filter((r) => r.source !== "test");
  const joined = real.filter((r) => r.attendance.some((a) => a.kind === "live")).length;
  const replayed = real.filter((r) => r.attendance.some((a) => a.kind === "replay")).length;
  const clicked = real.filter((r) => r.attendance.some((a) => a.cta_clicked_at)).length;
  const prev = new Date(session.start.getTime() - 86_400_000).toISOString().slice(0, 10);
  const next = new Date(session.start.getTime() + 86_400_000).toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-muted">
          <Link href="/admin" className="underline">
            Events
          </Link>{" "}
          /{" "}
          <Link href={`/admin/events/${slug}`} className="underline">
            {event.slug}
          </Link>{" "}
          / {session.date}
        </p>
        <div className="mt-1 flex flex-wrap items-baseline gap-4">
          <h1 className="text-2xl font-bold">Session {session.date}</h1>
          <Link href={`/admin/events/${slug}/sessions/${prev}`} className="text-sm text-brand underline">
            ← {prev}
          </Link>
          <Link href={`/admin/events/${slug}/sessions/${next}`} className="text-sm text-brand underline">
            {next} →
          </Link>
        </div>
        <p className="mt-2 text-base">
          <span className="font-bold tabular-nums">{real.length}</span> registered · <span className="font-bold tabular-nums">{joined}</span> joined live · <span className="font-bold tabular-nums">{replayed}</span> watched the replay · <span className="font-bold tabular-nums">{clicked}</span> clicked the CTA
          {rows.length !== real.length && <span className="text-muted"> · {rows.length - real.length} test</span>}
        </p>
      </div>

      <SessionMetrics m={metrics} offsets={offsets} videoSeconds={event.video_seconds ?? 0} ctaAt={event.cta_at_seconds} />

      <form className="flex gap-2">
        <input name="q" defaultValue={q} placeholder="Search name or email" className="w-full max-w-sm rounded-md border border-line bg-panel px-3 py-2 text-base focus:border-brand focus:outline-none" />
        <button type="submit" className="rounded-md border border-line px-4 py-2 text-sm font-bold">
          Search
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-panel text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Source</th>
              <th className="px-3 py-2">Live</th>
              <th className="px-3 py-2">Replay</th>
              <th className="px-3 py-2">CTA</th>
              <th className="px-3 py-2">Links</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const live = r.attendance.find((a) => a.kind === "live");
              const rep = r.attendance.find((a) => a.kind === "replay");
              const cta = r.attendance.find((a) => a.cta_clicked_at);
              return (
                <tr key={r.id} className={`border-t border-line ${r.blocked_at ? "opacity-50" : ""}`}>
                  <td className="px-3 py-2 font-bold">
                    {r.first_name}
                    {r.blocked_at && <span className="ml-2 rounded bg-live/20 px-1.5 text-xs text-live">blocked</span>}
                  </td>
                  <td className="px-3 py-2 text-muted">{r.email ?? "—"}</td>
                  <td className="px-3 py-2 text-muted">{r.source}</td>
                  <td className="px-3 py-2 tabular-nums">{live ? `${Math.round(live.seconds_watched / 60)} min, to ${Math.round(live.max_offset / 60)}m` : "—"}</td>
                  <td className="px-3 py-2 tabular-nums">{rep ? `${Math.round(rep.seconds_watched / 60)} min` : "—"}</td>
                  <td className="px-3 py-2">{cta ? "clicked" : "—"}</td>
                  <td className="px-3 py-2">
                    <a href={joinUrl(r.token)} className="text-brand underline" target="_blank" rel="noopener">
                      join
                    </a>{" "}
                    <a href={replayUrl(r.token)} className="text-brand underline" target="_blank" rel="noopener">
                      replay
                    </a>
                  </td>
                  <td className="px-3 py-2">
                    <form action={setBlocked}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="date" value={session.date} />
                      <input type="hidden" name="block" value={r.blocked_at ? "0" : "1"} />
                      <button type="submit" className="text-xs text-muted hover:text-ink">
                        {r.blocked_at ? "Unblock" : "Block"}
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-muted">
                  Nobody registered for this date{q ? " matching your search" : ""}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
