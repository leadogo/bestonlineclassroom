import { redirect } from "next/navigation";
import { Room } from "@/components/room/Room";
import { registrantByToken } from "@/lib/attendees";
import { getTeamMember } from "@/lib/auth";
import { TOKEN_RE } from "@/lib/registrants";
import { buildRoom } from "@/lib/room-props";

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
  return <Room {...outcome.props} />;
}
