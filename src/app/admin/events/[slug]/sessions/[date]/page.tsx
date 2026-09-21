import Link from "next/link";
import { btnQuiet, input, PageHeader, Stat, td, th } from "../../../../ui";
import { notFound } from "next/navigation";
import { canModerate, getTeamMember } from "@/lib/auth";
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
  const me = (await getTeamMember())!;
  if (!(await canModerate(me, event.id))) notFound();
  const readOnly = me.role !== "admin";
  const schedule = scheduleOf(event);
  const session = sessionFor(schedule, date) ?? currentOrNextSession(schedule);
  let query = db().from("registrants").select("id, first_name, email, source, token, created_at, blocked_at, attendance(kind, joined_at, seconds_watched, max_offset, cta_clicked_at)").eq("event_id", event.id).eq("session_date", session.date).order("created_at", { ascending: false }).limit(500);
  if (q.trim()) query = query.or(`first_name.ilike.%${q.trim()}%,email.ilike.%${q.trim()}%`);
  const { data } = await query;
  const rows = (data ?? []) as unknown as Row[];
  const metrics = (await db().from("session_metrics").select("*").eq("event_id", event.id).eq("session_date", session.date).maybeSingle()).data as Metrics | null;
  const offsetsRes = await db().from("attendance").select("max_offset, registrant:registrants!inner(source)").eq("session_date", session.date).eq("kind", "live").eq("registrant.event_id", event.id);
  const offsets = (offsetsRes.data ?? []).filter((a) => (a.registrant as unknown as { source: string }).source !== "test").map((a) => a.max_offset as number);
  const clicksRes = await db().from("link_clicks").select("outcome, path, src, at, registrant:registrants(first_name, email, source)").eq("event_id", event.id).eq("session_date", session.date).order("id", { ascending: false }).limit(2000);
  const clicks = (clicksRes.data ?? []).filter((c) => (c.registrant as unknown as { source?: string } | null)?.source !== "test");
  const count = (o: string) => clicks.filter((c) => c.outcome === o).length;
  const problems = clicks.filter((c) => ["ended", "replay_expired", "invalid"].includes(c.outcome)).slice(0, 50);
  const real = rows.filter((r) => r.source !== "test");
  const joined = real.filter((r) => r.attendance.some((a) => a.kind === "live")).length;
  const replayed = real.filter((r) => r.attendance.some((a) => a.kind === "replay")).length;
  const clicked = real.filter((r) => r.attendance.some((a) => a.cta_clicked_at)).length;
  const prev = new Date(session.start.getTime() - 86_400_000).toISOString().slice(0, 10);
  const next = new Date(session.start.getTime() + 86_400_000).toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        crumbs={[["Webinars", "/admin"], [event.title, readOnly ? `/admin/events/${slug}/analytics` : `/admin/events/${slug}`], [session.date, `/admin/events/${slug}/sessions/${session.date}`]]}
        title={`Session of ${new Intl.DateTimeFormat("en-US", { timeZone: event.timezone, weekday: "long", month: "long", day: "numeric" }).format(session.start)}`}
        subtitle={`${event.title}, ${new Intl.DateTimeFormat("en-US", { timeZone: event.timezone, hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(session.start)}${rows.length !== real.length ? `. ${rows.length - real.length} test registrant${rows.length - real.length === 1 ? "" : "s"} hidden from the numbers.` : "."}`}
        action={
          <>
            <Link href={`/admin/events/${slug}/sessions/${prev}`} className={btnQuiet}>
              Previous day
            </Link>
            <Link href={`/admin/events/${slug}/sessions/${next}`} className={btnQuiet}>
              Next day
            </Link>
            <a href={`/admin/events/${slug}/analytics/export?kind=chat&date=${session.date}`} className={btnQuiet}>
              Chat CSV
            </a>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        <Stat label="registered" value={real.length} />
        <Stat label="joined live" value={joined} sub={real.length ? `${Math.round((joined / real.length) * 100)}% show-up` : undefined} />
        <Stat label="watched the replay" value={replayed} />
        <Stat label="clicked the offer" value={clicked} tone={clicked ? "cta" : undefined} />
      </div>

      <SessionMetrics m={metrics} offsets={offsets} videoSeconds={event.video_seconds ?? 0} ctaAt={event.cta_at_seconds} />

      <section className="flex flex-col gap-2 border-t border-line pt-6">
        <h2 className="text-lg font-bold">Link clicks</h2>
        <p className="text-base">
          <span className="font-bold tabular-nums">{clicks.length}</span> opens · <span className="tabular-nums">{count("live")}</span> into the live room · <span className="tabular-nums">{count("countdown")}</span> to the countdown · <span className="tabular-nums">{count("replay")}</span> to the replay · <span className="tabular-nums">{count("prompt")}</span> asked for a name ·{" "}
          <span className={`font-bold tabular-nums ${problems.length ? "text-live" : ""}`}>{count("ended") + count("replay_expired") + count("invalid")}</span> could not watch
        </p>
        {problems.length > 0 && (
          <ul className="rounded-lg border border-live/40 bg-live/5 p-3 text-sm">
            {problems.map((c, i) => {
              const r = c.registrant as unknown as { first_name?: string; email?: string | null } | null;
              return (
                <li key={i} className="flex flex-wrap gap-x-3">
                  <span className="tabular-nums text-muted">{new Date(c.at).toLocaleString("en-US", { timeZone: event.timezone, hour: "numeric", minute: "2-digit", month: "short", day: "numeric" })}</span>
                  <span className="font-bold">{c.outcome === "ended" ? "clicked after the session ended" : c.outcome === "replay_expired" ? "replay window over" : "invalid link"}</span>
                  <span>{r?.first_name ?? "unknown"}{r?.email ? ` · ${r.email}` : ""}</span>
                  <span className="text-muted">{c.path}{c.src ? ` · ${c.src}` : ""}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3 border-t border-line pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">Registrants</h2>
          <form className="flex gap-2">
            <input name="q" defaultValue={q} placeholder="Search name or email" className={`${input} w-64`} />
            <button type="submit" className={btnQuiet}>
              Search
            </button>
          </form>
        </div>

      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-panel">
            <tr>
              <th className={th}>Name</th>
              <th className={th}>Email</th>
              <th className={th}>Source</th>
              <th className={th}>Live</th>
              <th className={th}>Replay</th>
              <th className={th}>Offer</th>
              <th className={th}>Links</th>
              <th className={th}></th>
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
                  <td className={`${td} tabular-nums`}>{live ? `${Math.round(live.seconds_watched / 60)} min, to ${Math.round(live.max_offset / 60)}m` : "—"}</td>
                  <td className={`${td} tabular-nums`}>{rep ? `${Math.round(rep.seconds_watched / 60)} min` : "—"}</td>
                  <td className={td}>{cta ? "clicked" : "—"}</td>
                  <td className={td}>
                    <a href={joinUrl(r.token)} className="text-brand underline" target="_blank" rel="noopener">
                      join
                    </a>{" "}
                    <a href={replayUrl(r.token)} className="text-brand underline" target="_blank" rel="noopener">
                      replay
                    </a>
                  </td>
                  <td className={td}>
                    {readOnly ? (
                      <span className="text-xs text-muted">{r.blocked_at ? "blocked" : ""}</span>
                    ) : (
                    <form action={setBlocked}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="date" value={session.date} />
                      <input type="hidden" name="block" value={r.blocked_at ? "0" : "1"} />
                      <button type="submit" className="text-xs text-muted hover:text-ink">
                        {r.blocked_at ? "Unblock" : "Block"}
                      </button>
                    </form>
                    )}
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
      </section>
    </div>
  );
}
