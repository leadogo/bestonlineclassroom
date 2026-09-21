import { ReplayView } from "@/components/replay/ReplayView";
import { registrantByToken } from "@/lib/attendees";
import { ctaHref } from "@/lib/cta";
import { cleanParams } from "@/lib/params";
import { TOKEN_RE } from "@/lib/registrants";

export const dynamic = "force-dynamic";

const SITE = "https://thefuturerealestateagent.com/ai-training";

/** The replay (SPEC-replay.md): the same recording, any time, with controls, and the call to action throughout. */
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
  const cta = e.cta_href ? { label: e.cta_label ?? "Book your call", href: ctaHref(e.cta_href, { first_name: r.first_name, email: r.email, phone: r.phone, rid: r.id }, p), at: e.cta_at_seconds ?? 0 } : null;
  const chapters = (Array.isArray(e.chapters) ? e.chapters : []).filter((c) => typeof c?.at === "number" && typeof c?.label === "string").sort((a, b) => a.at - b.at);
  return <ReplayView token={r.token} firstName={r.first_name} title={e.title} logoUrl={e.logo_url} videoUrl={videoUrl} seconds={e.video_seconds ?? 0} cta={cta} chapters={chapters} params={p} />;
}
