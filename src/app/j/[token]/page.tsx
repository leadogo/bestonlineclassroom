import { notFound, redirect } from "next/navigation";
import { tellWallHit, walledDevice } from "@/lib/client-wall";
import { after } from "next/server";
import { db } from "@/lib/db";
import { Room } from "@/components/room/Room";
import { Removed } from "@/components/room/Removed";
import { everGhosted, registrantByToken } from "@/lib/attendees";
import { getTeamMember } from "@/lib/auth";
import { TOKEN_RE } from "@/lib/registrants";
import { buildRoom } from "@/lib/room-props";
import { getSimulatedRows } from "@/lib/simulated";
import { logClick } from "@/lib/clicks";
import { headers } from "next/headers";
import { pickRunningOrNext } from "@/lib/daily-schedule";
import { clientIp, ipBlocked } from "@/lib/ip";
import { isCrawlerAgent, isScannerAddress, isScannerAgent } from "@/lib/scanner";
import { renderMove } from "@/lib/outcomes";
import { reportRoomJoin, type Movable } from "@/lib/move-in";

export const dynamic = "force-dynamic";

const SITE = "https://thefuturerealestateagent.com/ai-training";

/** The registrant's own link: their session, at the right minute, for as long as it runs. */
export default async function JoinPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { token } = await params;
  const sp = await searchParams;
  const h = await headers();
  const ua = h.get("user-agent");
  const ip = clientIp(h);
  // An email security scanner opening the link (SPEC-link-opens.md, A; the address tell of SPEC-friday-unattended.md, D): it sees the page, nothing else happens.
  const scanner = isScannerAgent(ua) || (ip && TOKEN_RE.test(token) ? await isScannerAddress(ip, token, ua) : false);
  if (await ipBlocked(ip)) return <main className="flex min-h-screen items-center justify-center p-6 text-center text-base text-muted">This room isn&apos;t available.</main>;
  const r = TOKEN_RE.test(token) ? await registrantByToken(token).catch(() => null) : null;
  if (!r) {
    after(() => logClick({ path: "j", outcome: "invalid", token, userAgent: ua, bot: scanner, ip }));
    // A real-looking token nobody holds any more (an old email after a cleanup): into the webinar as a guest
    // rather than a wall. Garbage in the address still gets the page below.
    if (TOKEN_RE.test(token)) {
      const { data } = await db().from("events").select("slug, timezone, start_time, video_seconds, days");
      const target = pickRunningOrNext((data ?? []) as Array<{ slug: string; timezone: string; start_time: string; video_seconds: number | null; days: number[] }>);
      if (target) redirect(`/w/${target.slug}?src=oldlink`);
    }
    return (
      <main className="flex min-h-screen items-center justify-center p-6 text-center">
        <div className="max-w-sm">
          <h1 className="text-2xl font-bold">This link isn&apos;t valid</h1>
          <p className="mt-3 text-base text-muted">
            Use the link in your email or calendar invite, or{" "}
            <a className="text-brand underline" href={SITE}>
              register again
            </a>
            .
          </p>
        </div>
      </main>
    );
  }
  if (r.blocked_at) {
    // A client on the wall (SPEC-phase7.md): a bland 404, logged, one Slack line; a moderator's block keeps the courteous page.
    if (r.block_reason === "client") {
      after(async () => {
        await logClick({ path: "j", outcome: "walled", token, registrantId: r.id, eventId: r.event_id, sessionDate: r.session_date, src: typeof sp.src === "string" ? sp.src : null, userAgent: ua, bot: scanner, ip });
        if (!scanner) await tellWallHit(r, r.event.title, "join").catch(() => {});
      });
      notFound();
    }
    return <Removed logoUrl={r.event.logo_url} />;
  }
  const team = sp.at ? Boolean(await getTeamMember().catch(() => null)) : false;
  // A client's own device under a new email (Brishen, Oct 28: walled on gmail, back through Skool on icloud from the same Mac and address): the same bland 404, this request only.
  if (!team && !scanner && (await walledDevice(ip, ua).catch(() => false))) {
    after(async () => {
      // Its own outcome: a "walled" row under this new seat would make the device look shared and let them in next time.
      await logClick({ path: "j", outcome: "walled_device", token, registrantId: r.id, eventId: r.event_id, sessionDate: r.session_date, src: typeof sp.src === "string" ? sp.src : null, userAgent: ua, bot: scanner, ip });
      await tellWallHit(r, r.event.title, "join").catch(() => {});
    });
    notFound();
  }
  // Ghosted in chat, tonight or any night before under this email: the live room is a bland 404, like the client wall (William, Oct 28 2026).
  if (!team && (await everGhosted(r).catch(() => false))) {
    after(() => logClick({ path: "j", outcome: "ghosted", token, registrantId: r.id, eventId: r.event_id, sessionDate: r.session_date, src: typeof sp.src === "string" ? sp.src : null, userAgent: ua, bot: scanner, ip }));
    notFound();
  }
  const outcome = buildRoom(r.event, r, sp, new Date(), { team });
  const src = typeof sp.src === "string" ? sp.src : null;
  if (outcome.kind === "ended") {
    after(() => logClick({ path: "j", outcome: "ended", token, registrantId: r.id, eventId: r.event_id, sessionDate: r.session_date, src, userAgent: ua, bot: scanner, ip }));
    redirect(outcome.to);
  }
  // An old link used for a later session: the person now belongs to that session (chat, presence, numbers). A scanner's open moves the row too (William, Oct 21: that move is the reminder touch that fed 30 people and 4 bookings on Oct 20); its beats are dropped at the heartbeat and it reports no room_join (SPEC-link-opens.md, A).
  const to = outcome.rejoinDate;
  if (to && renderMove(to, Boolean(outcome.props.preview)) && !isCrawlerAgent(ua)) {
    const mv = await db().from("registrants").update({ session_date: to, moved_in_at: new Date().toISOString() }).eq("id", r.id);
    if (mv.error) console.error("[join] move failed", { code: mv.error.code });
    r.session_date = to;
  }
  if (!outcome.props.preview) after(() => logClick({ path: "j", outcome: outcome.props.state, token, registrantId: r.id, eventId: r.event_id, sessionDate: outcome.rejoinDate ?? r.session_date, src, userAgent: ua, bot: scanner, ip }));
  const simulated = await getSimulatedRows(r.event.id).catch(() => []);
  // ponytail: the site's /join records room_join for leadogo, the ritual sheet and Slack; calling it once here keeps
  // all three without a new contract. Replace with a direct leadogo event when analytics N2 lands.
  if (outcome.props.state === "live" && !outcome.props.preview && !scanner) after(() => reportRoomJoin(r as unknown as Movable, r.session_date));
  return <Room {...outcome.props} simulated={simulated} />;
}
