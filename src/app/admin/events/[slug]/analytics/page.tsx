import Link from "next/link";
import { btnQuiet, PageHeader, th } from "../../../ui";
import { notFound } from "next/navigation";
import type { Metrics } from "../sessions/[date]/metrics";
import { canModerate, getTeamMember } from "@/lib/auth";
import { currentOrNextSession, scheduleOf } from "@/lib/daily-schedule";
import { db } from "@/lib/db";
import { getEvent } from "@/lib/events";
import { retentionCurve } from "@/lib/outcomes";

type Row = Metrics & { session_date: string };
const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "—");
const isoWeek = (date: string) => {
  const d = new Date(`${date}T12:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const y = d.getUTCFullYear();
  const jan4 = new Date(Date.UTC(y, 0, 4));
  return `${y}-W${String(1 + Math.round(((d.getTime() - jan4.getTime()) / 86_400_000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7)).padStart(2, "0")}`;
};

/** Across sessions: the numbers as a table and trend, retention per session, two sessions side by side, exports. */
export default async function Analytics({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ days?: string; a?: string; b?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const event = await getEvent(slug);
  if (!event) notFound();
  const me = (await getTeamMember())!;
  if (!(await canModerate(me, event.id))) notFound();
  const days = sp.days === "90" ? 90 : 30;
  const now = new Date();
  const since = new Date(now.getTime() - days * 86_400_000).toISOString().slice(0, 10);
  const { data } = await db().from("session_metrics").select("*").eq("event_id", event.id).gte("session_date", since).order("session_date");
  const rows = (data ?? []) as Row[];
  const next = currentOrNextSession(scheduleOf(event), now);
  const recent = rows.slice(-8).map((r) => r.session_date);
  const att = recent.length ? await db().from("attendance").select("max_offset, session_date, registrant:registrants!inner(source, event_id)").eq("kind", "live").eq("registrant.event_id", event.id).in("session_date", recent) : { data: [] };
  const offsetsBy = new Map<string, number[]>();
  for (const a of att.data ?? []) {
    if ((a.registrant as unknown as { source: string }).source === "test") continue;
    offsetsBy.set(a.session_date as string, [...(offsetsBy.get(a.session_date as string) ?? []), a.max_offset as number]);
  }
  const video = event.video_seconds ?? 0;
  const ctaAt = event.cta_at_seconds;
  const weeks = new Map<string, { registered: number; joined: number; live_at_pitch: number; clicked_offer: number; sessions: number }>();
  for (const r of rows) {
    const w = weeks.get(isoWeek(r.session_date)) ?? { registered: 0, joined: 0, live_at_pitch: 0, clicked_offer: 0, sessions: 0 };
    w.registered += r.registered; w.joined += r.joined; w.live_at_pitch += r.live_at_pitch; w.clicked_offer += r.clicked_offer; w.sessions += 1;
    weeks.set(isoWeek(r.session_date), w);
  }
  const a = rows.find((r) => r.session_date === sp.a) ?? rows[rows.length - 2] ?? null;
  const b = rows.find((r) => r.session_date === sp.b) ?? rows[rows.length - 1] ?? null;
  const W = 600, H = 100;
  const line = (key: keyof Metrics, color: string) => {
    const max = Math.max(1, ...rows.map((r) => r[key]));
    return <polyline key={key} points={rows.map((r, i) => `${(i / Math.max(1, rows.length - 1)) * W},${H - (r[key] / max) * H}`).join(" ")} fill="none" stroke={color} strokeWidth="2" />;
  };
  const exportUrl = (kind: string, date?: string) => `/admin/events/${slug}/analytics/export?kind=${kind}${date ? `&date=${date}` : ""}&days=${days}`;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        crumbs={[["Webinars", "/admin"], [event.title, me.role === "admin" ? `/admin/events/${slug}` : `/admin/events/${slug}/analytics`]]}
        title="Analytics"
        subtitle={`${event.title}, every session in the last ${days} days.`}
        action={
          <>
            <Link href={`/admin/events/${slug}/analytics?days=30`} className={`${btnQuiet} ${days === 30 ? "border-brand" : ""}`}>Last 30 days</Link>
            <Link href={`/admin/events/${slug}/analytics?days=90`} className={`${btnQuiet} ${days === 90 ? "border-brand" : ""}`}>Last 90 days</Link>
          </>
        }
      />

      {rows.length === 0 ? (
        <p className="text-sm text-muted">No sessions with numbers yet. The next one is {next.date}.</p>
      ) : (
        <>
          <section>
            <h2 className="text-lg font-bold">Trend</h2>
            <p className="text-xs text-muted">Each line on its own scale: <span className="text-brand">registered</span>, <span className="text-emerald-400">joined</span>, <span className="text-cta">clicked the offer</span>.</p>
            <div className="mt-2 overflow-x-auto rounded-lg border border-line bg-panel p-3">
              <svg viewBox={`-4 -6 ${W + 8} ${H + 24}`} className="h-32 w-full min-w-[480px]" role="img" aria-label="Trend">
                <line x1="0" y1={H} x2={W} y2={H} stroke="currentColor" strokeOpacity="0.3" />
                {line("registered", "#2f7cf6")}
                {line("joined", "#34d399")}
                {line("clicked_offer", "#f5b324")}
                <text x="0" y={H + 14} fontSize="10" fill="currentColor" fillOpacity="0.7">{rows[0].session_date}</text>
                <text x={W} y={H + 14} fontSize="10" textAnchor="end" fill="currentColor" fillOpacity="0.7">{rows[rows.length - 1].session_date}</text>
              </svg>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold">By session</h2>
            <div className="mt-2 overflow-x-auto rounded-lg border border-line">
              <table className="w-full text-sm">
                <thead className="bg-panel">
                  <tr>{["Date", "Registered", "Joined", "Show-up", "Attended 15m+", "Live at pitch", "Clicks", "Replay", "Avg min", "Chat"].map((h) => <th key={h} className={th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {[...rows].reverse().map((r) => (
                    <tr key={r.session_date} className="border-t border-line tabular-nums">
                      <td className="px-3 py-2"><Link href={`/admin/events/${slug}/sessions/${r.session_date}`} className="text-brand underline">{r.session_date}</Link></td>
                      <td className="px-3 py-2">{r.registered}</td>
                      <td className="px-3 py-2">{r.joined}</td>
                      <td className="px-3 py-2">{pct(r.joined, r.registered)}</td>
                      <td className="px-3 py-2">{r.attended}</td>
                      <td className="px-3 py-2">{r.live_at_pitch}</td>
                      <td className="px-3 py-2">{r.clicked_offer}</td>
                      <td className="px-3 py-2">{r.watched_replay}</td>
                      <td className="px-3 py-2">{Math.round(r.avg_live_seconds / 60)}</td>
                      <td className="px-3 py-2"><a href={exportUrl("chat", r.session_date)} className="text-brand underline">CSV</a></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold">By week</h2>
            <div className="mt-2 overflow-x-auto rounded-lg border border-line">
              <table className="w-full text-sm">
                <thead className="bg-panel">
                  <tr>{["Week", "Sessions", "Registered", "Joined", "Show-up", "Live at pitch", "Clicks"].map((h) => <th key={h} className={th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {[...weeks.entries()].reverse().map(([w, v]) => (
                    <tr key={w} className="border-t border-line tabular-nums">
                      <td className="px-3 py-2">{w}</td><td className="px-3 py-2">{v.sessions}</td><td className="px-3 py-2">{v.registered}</td><td className="px-3 py-2">{v.joined}</td><td className="px-3 py-2">{pct(v.joined, v.registered)}</td><td className="px-3 py-2">{v.live_at_pitch}</td><td className="px-3 py-2">{v.clicked_offer}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {recent.length > 0 && video > 0 && (
            <section>
              <h2 className="text-lg font-bold">Retention, last {recent.length} sessions</h2>
              <p className="text-xs text-muted">Share of joiners still in the room at each 10-minute mark; the dashed line is the pitch.</p>
              <ul className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {recent.map((d) => {
                  const curve = retentionCurve(offsetsBy.get(d) ?? [], video);
                  const w = 200, h = 60;
                  return (
                    <li key={d} className="rounded-lg border border-line bg-panel p-2">
                      <p className="text-xs text-muted">{d} · {offsetsBy.get(d)?.length ?? 0} joined</p>
                      <svg viewBox={`0 0 ${w} ${h}`} className="mt-1 h-16 w-full" role="img" aria-label={`Retention ${d}`}>
                        <line x1="0" y1={h} x2={w} y2={h} stroke="currentColor" strokeOpacity="0.3" />
                        {ctaAt !== null && <line x1={(ctaAt / video) * w} y1="0" x2={(ctaAt / video) * w} y2={h} stroke="#f5b324" strokeDasharray="3 3" />}
                        <polyline points={curve.map((c, i) => `${(i / Math.max(1, curve.length - 1)) * w},${h - c.share * h}`).join(" ")} fill="none" stroke="#2f7cf6" strokeWidth="2" />
                      </svg>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {a && b && (
            <section>
              <h2 className="text-lg font-bold">Compare two sessions</h2>
              <form className="mt-2 flex flex-wrap gap-2 text-sm">
                <input type="hidden" name="days" value={days} />
                <select name="a" defaultValue={a.session_date} className="rounded-md border border-line bg-room px-2 py-1">{rows.map((r) => <option key={r.session_date}>{r.session_date}</option>)}</select>
                <span className="self-center text-muted">vs</span>
                <select name="b" defaultValue={b.session_date} className="rounded-md border border-line bg-room px-2 py-1">{rows.map((r) => <option key={r.session_date}>{r.session_date}</option>)}</select>
                <button type="submit" className="rounded-md border border-line px-3 py-1 font-bold">Compare</button>
              </form>
              <div className="mt-2 overflow-x-auto rounded-lg border border-line">
                <table className="w-full text-sm">
                  <thead className="bg-panel"><tr><th className="px-3 py-2"></th><th className="px-3 py-2">{a.session_date}</th><th className="px-3 py-2">{b.session_date}</th></tr></thead>
                  <tbody className="tabular-nums">
                    {([["Registered", "registered"], ["Joined", "joined"], ["Attended 15 min+", "attended"], ["Live at the pitch", "live_at_pitch"], ["Clicked the offer", "clicked_offer"], ["Saw it, no click", "saw_offer_no_click"], ["Stayed 40 min+", "stayed_40min"], ["Asked a question", "asked_question"], ["Watched the replay", "watched_replay"], ["Missed", "missed"]] as Array<[string, keyof Metrics]>).map(([label, k]) => (
                      <tr key={k} className="border-t border-line"><td className="px-3 py-2 text-muted">{label}</td><td className="px-3 py-2">{a[k]}</td><td className="px-3 py-2">{b[k]}</td></tr>
                    ))}
                    <tr className="border-t border-line"><td className="px-3 py-2 text-muted">Show-up</td><td className="px-3 py-2">{pct(a.joined, a.registered)}</td><td className="px-3 py-2">{pct(b.joined, b.registered)}</td></tr>
                    <tr className="border-t border-line"><td className="px-3 py-2 text-muted">Avg. minutes</td><td className="px-3 py-2">{Math.round(a.avg_live_seconds / 60)}</td><td className="px-3 py-2">{Math.round(b.avg_live_seconds / 60)}</td></tr>
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}

      <section>
        <h2 className="text-lg font-bold">Exports</h2>
        <ul className="mt-2 flex flex-wrap gap-3 text-sm">
          <li><a href={exportUrl("sessions")} className="text-brand underline">Sessions CSV (last {days} days)</a></li>
          <li><a href={exportUrl("registrants")} className="text-brand underline">Registrants CSV (last {days} days)</a></li>
          <li><a href={exportUrl("chat", next.date)} className="text-brand underline">Chat CSV for {next.date}</a></li>
        </ul>
        <p className="mt-1 text-xs text-muted">Chat exports mark each line real or simulated; past sessions carry a “recorded” header.</p>
      </section>
    </div>
  );
}
