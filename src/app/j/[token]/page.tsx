import { redirect } from "next/navigation";
import { after } from "next/server";
import { db } from "@/lib/db";
import { Room } from "@/components/room/Room";
import { Removed } from "@/components/room/Removed";
import { registrantByToken } from "@/lib/attendees";
import { getTeamMember } from "@/lib/auth";
import { TOKEN_RE } from "@/lib/registrants";
import { buildRoom } from "@/lib/room-props";
import { getSimulatedRows } from "@/lib/simulated";
import { logClick } from "@/lib/clicks";
import { headers } from "next/headers";
import { clientIp, ipBlocked } from "@/lib/ip";

export const dynamic = "force-dynamic";

const SITE = "https://thefuturerealestateagent.com/ai-training";

/** The registrant's own link: their session, at the right minute, for as long as it runs. */
export default async function JoinPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { token } = await params;
  const sp = await searchParams;
  const h = await headers();
  const ua = h.get("user-agent");
  if (await ipBlocked(clientIp(h))) return <main className="flex min-h-screen items-center justify-center p-6 text-center text-base text-muted">This room isn&apos;t available.</main>;
  const r = TOKEN_RE.test(token) ? await registrantByToken(token).catch(() => null) : null;
  if (!r) {
    after(() => logClick({ path: "j", outcome: "invalid", token, userAgent: ua }));
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
  if (r.blocked_at) return <Removed logoUrl={r.event.logo_url} />;
  const team = sp.at ? Boolean(await getTeamMember().catch(() => null)) : false;
  const outcome = buildRoom(r.event, r, sp, new Date(), { team });
  const src = typeof sp.src === "string" ? sp.src : null;
  if (outcome.kind === "ended") {
    after(() => logClick({ path: "j", outcome: "ended", token, registrantId: r.id, eventId: r.event_id, sessionDate: r.session_date, src, userAgent: ua }));
    redirect(outcome.to);
  }
  // An old link used for a later session: the person now belongs to that session (chat, presence, numbers).
  if (outcome.rejoinDate && !outcome.props.preview) {
    await db().from("registrants").update({ session_date: outcome.rejoinDate }).eq("id", r.id);
    r.session_date = outcome.rejoinDate;
  }
  if (!outcome.props.preview) after(() => logClick({ path: "j", outcome: outcome.props.state, token, registrantId: r.id, eventId: r.event_id, sessionDate: r.session_date, src, userAgent: ua }));
  const simulated = await getSimulatedRows(r.event.id).catch(() => []);
  // ponytail: the site's /join records room_join for leadogo, the ritual sheet and Slack; calling it once here keeps
  // all three without a new contract. Replace with a direct leadogo event when analytics N2 lands.
  if (outcome.props.state === "live" && !outcome.props.preview && r.site_registration_id && !r.room_join_reported_at) {
    after(async () => {
      const q = new URLSearchParams({ k: r.token, rid: r.site_registration_id as string, sd: r.session_date, ...(r.source === "test" ? { t: "1" } : {}) });
      await fetch(`https://thefuturerealestateagent.com/join?${q}`, { redirect: "manual", signal: AbortSignal.timeout(5000) }).catch(() => {});
      await db().from("registrants").update({ room_join_reported_at: new Date().toISOString() }).eq("id", r.id);
    });
  }
  return <Room {...outcome.props} simulated={simulated} />;
}
