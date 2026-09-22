import { ReplayExpired, ReplayView } from "@/components/replay/ReplayView";
import { registrantByToken } from "@/lib/attendees";
import { ctaHref } from "@/lib/cta";
import { db } from "@/lib/db";
import { cleanParams } from "@/lib/params";
import { TOKEN_RE } from "@/lib/registrants";
import { after } from "next/server";
import { replayCopy } from "@/lib/replay-content";
import { tagNow } from "@/lib/tagging";
import { logClick } from "@/lib/clicks";
import { headers } from "next/headers";
import { getTeamMember } from "@/lib/auth";
import { fourZones, replayOpensAt, scheduleOf, sessionFor } from "@/lib/daily-schedule";

export const dynamic = "force-dynamic";

const SITE = "https://thefuturerealestateagent.com/ai-training";

/**
 * The replay (SPEC-replay.md): the same recording, any time within the window, with a real player and the call to
 * action throughout. The window (events.replay_hours, 72 tonight) starts at the first open of this link and is
 * stored on the registrant, so it is the same on every device and cannot be reset by clearing a browser.
 */
export default async function ReplayPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { token } = await params;
  const sp = await searchParams;
  const r = TOKEN_RE.test(token) ? await registrantByToken(token).catch(() => null) : null;
  const ua = (await headers()).get("user-agent");
  if (!r || !r.event.video_url) {
    after(() => logClick({ path: "replay", outcome: "invalid", token, userAgent: ua }));
    return (
      <main className="flex min-h-screen items-center justify-center p-6 text-center">
        <div className="max-w-sm">
          <h1 className="text-2xl font-bold">This replay link isn&apos;t valid</h1>
          <p className="mt-3 text-base text-muted">
            Use the link from your email, or{" "}
            <a className="text-brand underline" href={SITE}>
              register for the next session
            </a>
            .
          </p>
        </div>
      </main>
    );
  }
  const e = r.event;
  const p = cleanParams(sp);
  const now = new Date();

  const cta = e.cta_href ? { label: e.cta_label ?? "Book your call", href: ctaHref(e.cta_href, { first_name: r.first_name, email: r.email, phone: r.phone, rid: r.id }, p), at: e.cta_at_seconds ?? 0 } : null;

  // The replay opens at the later of the session's end and the event's opening time (8 PM for ailg-r). Before that the
  // link explains, without the word "live" (Jeremy, 2026-09-21). Team members bypass the gate to check the page.
  const session = sessionFor(scheduleOf(e), r.session_date);
  const opens = session ? replayOpensAt(session, e.replay_opens_at, e.timezone) : null;
  if (session && opens && now.getTime() < opens.getTime() && !(await getTeamMember().catch(() => null))) {
    after(() => logClick({ path: "replay", outcome: "countdown", token, registrantId: r.id, eventId: r.event_id, sessionDate: r.session_date, userAgent: ua }));
    const running = now.getTime() >= session.start.getTime() && now.getTime() < session.end.getTime();
    const ended = now.getTime() >= session.end.getTime();
    const zones = fourZones(ended ? { ...session, start: opens } : session);
    const zoneLine = zones.map(([z, t]) => `${t} ${z}`).join(" · ");
    const day = new Intl.DateTimeFormat("en-US", { timeZone: e.timezone, weekday: "long", month: "long", day: "numeric" }).format(session.start);
    const button = "mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-brand px-6 text-lg font-bold text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-white/50";
    return (
      <main className="flex min-h-screen items-center justify-center p-6 text-center">
        <div className="max-w-md">
          {e.logo_url && <img src={e.logo_url} alt={e.title} className="mx-auto mb-8 h-10 w-auto" />}
          <h1 className="text-2xl font-bold text-balance">{running ? "Session is in progress now" : ended ? `Your replay opens tonight at ${zones[1][1]} Mountain` : `Your session is ${day}`}</h1>
          <p className="mt-3 text-base text-muted">{ended ? `${zoneLine}. Come back to this same link then.` : `${zoneLine}. The full replay is available here afterwards.`}</p>
          {ended ? (
            cta && <a href={cta.href} target="_blank" rel="noopener" className={button}>{cta.label}</a>
          ) : (
            <a href={`/j/${r.token}`} className={button}>{running ? "Enter the session" : "Open the room"}</a>
          )}
        </div>
      </main>
    );
  }

  // The clock starts now if it has not started; a race between two first opens keeps the earliest.
  let openedAt = r.replay_opened_at ? new Date(r.replay_opened_at) : null;
  if (!openedAt && e.replay_hours > 0) {
    await db().from("registrants").update({ replay_opened_at: now.toISOString() }).eq("id", r.id).is("replay_opened_at", null);
    const again = await db().from("registrants").select("replay_opened_at").eq("id", r.id).maybeSingle();
    openedAt = again.data?.replay_opened_at ? new Date(again.data.replay_opened_at) : now;
    after(() => tagNow(r.id, "watched_replay"));
  }
  const expiresAt = openedAt && e.replay_hours > 0 ? openedAt.getTime() + e.replay_hours * 3_600_000 : null;
  if (expiresAt !== null && now.getTime() >= expiresAt) {
    after(() => logClick({ path: "replay", outcome: "replay_expired", token, registrantId: r.id, eventId: r.event_id, sessionDate: r.session_date, userAgent: ua }));
    return <ReplayExpired logoUrl={e.logo_url} cta={cta} onClickHref={SITE} copy={replayCopy(e.replay_copy)} />;
  }

  after(() => logClick({ path: "replay", outcome: "replay", token, registrantId: r.id, eventId: r.event_id, sessionDate: r.session_date, userAgent: ua }));
  const chapters = (Array.isArray(e.chapters) ? e.chapters : []).filter((c) => typeof c?.at === "number" && typeof c?.label === "string").sort((a, b) => a.at - b.at);
  return <ReplayView token={r.token} firstName={r.first_name} title={e.title} logoUrl={e.logo_url} seconds={e.video_seconds ?? 0} cta={cta} chapters={chapters} params={p} expiresAt={expiresAt} serverNow={now.getTime()} copy={replayCopy(e.replay_copy)} />;
}
