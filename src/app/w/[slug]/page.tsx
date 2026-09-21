import { notFound, redirect } from "next/navigation";
import { GuestForm } from "./guest-form";
import { resolveForSession } from "@/lib/attendees";
import { currentOrNextSession, scheduleOf, sessionFor } from "@/lib/daily-schedule";
import { getEvent } from "@/lib/events";
import { cleanParams, toQuery } from "@/lib/params";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The open link (Skool, legacy calendar links, anyone): finds the person from `eh` (email hash) or `rid` (the
 * site's registration id) and sends them to their own link for tonight; otherwise asks for a first name.
 */
export default async function OpenPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const event = await getEvent(slug).catch(() => null);
  if (!event) notFound();

  const one = (k: string) => (Array.isArray(sp[k]) ? (sp[k] as string[])[0] : (sp[k] as string | undefined)) ?? "";
  const schedule = scheduleOf(event);
  const sessionDate = sessionFor(schedule, one("sd"))?.date ?? currentOrNextSession(schedule).date;
  const src = one("src") === "legacy" ? "legacy" : one("src") === "skool" || !one("src") ? "skool" : "guest";
  const rid = UUID_RE.test(one("rid")) ? one("rid").toLowerCase() : undefined;
  const passthrough = { ...cleanParams(sp), ...(one("at") ? { at: one("at") } : {}), ...(one("key") ? { key: one("key") } : {}) };

  const known = await resolveForSession(event.id, sessionDate, { eh: one("eh").toLowerCase(), rid, lk: one("lk").toLowerCase() }, src).catch(() => null);
  if (known) redirect(`/j/${known.token}${toQuery(passthrough)}`);

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <GuestForm slug={slug} title={event.title} logoUrl={event.logo_url} sessionDate={sessionDate} src={src} rid={rid ?? null} passthrough={passthrough} />
    </main>
  );
}
