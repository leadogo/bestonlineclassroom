import { redirect } from "next/navigation";
import { after } from "next/server";
import { db } from "@/lib/db";
import { Room } from "@/components/room/Room";
import { registrantByToken } from "@/lib/attendees";
import { getTeamMember } from "@/lib/auth";
import { TOKEN_RE } from "@/lib/registrants";
import { buildRoom } from "@/lib/room-props";
import { getSimulatedRows } from "@/lib/simulated";

export const dynamic = "force-dynamic";

const SITE = "https://thefuturerealestateagent.com/ai-training";

/** The registrant's own link: their session, at the right minute, for as long as it runs. */
export default async function JoinPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { token } = await params;
  const sp = await searchParams;
  const r = TOKEN_RE.test(token) ? await registrantByToken(token).catch(() => null) : null;
  if (!r) {
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
  const team = sp.at ? Boolean(await getTeamMember().catch(() => null)) : false;
  const outcome = buildRoom(r.event, r, sp, new Date(), { team });
  if (outcome.kind === "ended") redirect(outcome.to);
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
