import { ReplayExpired, ReplayView } from "@/components/replay/ReplayView";
import { registrantByToken } from "@/lib/attendees";
import { ctaHref } from "@/lib/cta";
import { db } from "@/lib/db";
import { cleanParams } from "@/lib/params";
import { TOKEN_RE } from "@/lib/registrants";

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
  if (!r || !r.event.video_url) {
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
  const videoUrl = e.video_url as string;
  const p = cleanParams(sp);
  const now = new Date();
  const cta = e.cta_href ? { label: e.cta_label ?? "Book your call", href: ctaHref(e.cta_href, { first_name: r.first_name, email: r.email, phone: r.phone, rid: r.id }, p), at: e.cta_at_seconds ?? 0 } : null;

  // The clock starts now if it has not started; a race between two first opens keeps the earliest.
  let openedAt = r.replay_opened_at ? new Date(r.replay_opened_at) : null;
  if (!openedAt && e.replay_hours > 0) {
    await db().from("registrants").update({ replay_opened_at: now.toISOString() }).eq("id", r.id).is("replay_opened_at", null);
    const again = await db().from("registrants").select("replay_opened_at").eq("id", r.id).maybeSingle();
    openedAt = again.data?.replay_opened_at ? new Date(again.data.replay_opened_at) : now;
  }
  const expiresAt = openedAt && e.replay_hours > 0 ? openedAt.getTime() + e.replay_hours * 3_600_000 : null;
  if (expiresAt !== null && now.getTime() >= expiresAt) {
    return <ReplayExpired logoUrl={e.logo_url} cta={cta} onClickHref={SITE} />;
  }

  const chapters = (Array.isArray(e.chapters) ? e.chapters : []).filter((c) => typeof c?.at === "number" && typeof c?.label === "string").sort((a, b) => a.at - b.at);
  return <ReplayView token={r.token} firstName={r.first_name} title={e.title} logoUrl={e.logo_url} videoUrl={videoUrl} seconds={e.video_seconds ?? 0} cta={cta} chapters={chapters} params={p} expiresAt={expiresAt} serverNow={now.getTime()} />;
}
