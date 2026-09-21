import { notFound, redirect } from "next/navigation";
import { GuestForm } from "./guest-form";
import { resolveForSession } from "@/lib/attendees";
import { currentOrNextSession, scheduleOf, sessionFor } from "@/lib/daily-schedule";
import { getEvent } from "@/lib/events";
import { cleanParams, toQuery } from "@/lib/params";
import { createGuest } from "@/lib/attendees";
import { emailHash, isTestIdentity, normalizeEmail } from "@/lib/registrants";
import { logClick } from "@/lib/clicks";
import { cleanName } from "@/lib/chat-filter";
import { after } from "next/server";
import { headers } from "next/headers";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The open link (Skool, SMS and email sends, legacy calendar links, anyone): finds the person from `e` (email,
 * hashed here) or `eh` (email hash) or `rid` (the site's registration id) and sends them to their own link for
 * tonight. An unknown person with `e` and `fn` (first name) on the link is registered on the spot and walks
 * straight in; otherwise a one-field name prompt. `ph` (phone) is kept for the iClosed prefill on the CTA.
 */
export default async function OpenPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const event = await getEvent(slug).catch(() => null);
  if (!event) notFound();

  const one = (k: string) => (Array.isArray(sp[k]) ? (sp[k] as string[])[0] : (sp[k] as string | undefined)) ?? "";
  const schedule = scheduleOf(event);
  const sessionDate = sessionFor(schedule, one("sd"))?.date ?? currentOrNextSession(schedule).date;
  const srcRaw = one("src");
  const src = (["legacy", "skool", "sms", "email"].includes(srcRaw) ? srcRaw : !srcRaw ? "skool" : "guest") as "legacy" | "skool" | "sms" | "email" | "guest";
  const email = normalizeEmail(one("e"));
  const eh = (email ? emailHash(email) : one("eh")).toLowerCase();
  const fn = cleanName(one("fn")) ?? "";
  const rid = UUID_RE.test(one("rid")) ? one("rid").toLowerCase() : undefined;
  const ph = one("ph").replace(/[^\d+() .-]/g, "").trim().slice(0, 32);
  const passthrough = { ...cleanParams(sp), ...(one("at") ? { at: one("at") } : {}), ...(one("key") ? { key: one("key") } : {}) };

  const known = await resolveForSession(event.id, sessionDate, { eh, rid, lk: one("lk").toLowerCase() }, src).catch(() => null);
  if (known) {
    if (ph && !known.phone) await db().from("registrants").update({ phone: ph }).eq("id", known.id).is("phone", null);
    redirect(`/j/${known.token}${toQuery(passthrough)}`);
  }
  if (email && fn) {
    const made = await createGuest({ eventId: event.id, sessionDate, firstName: fn, source: isTestIdentity(email) ? ("test" as never) : src, email, emailHash: eh, phone: ph || null, siteRegistrationId: rid }).catch(() => null);
    if (made) redirect(`/j/${made.token}${toQuery(passthrough)}`);
  }
  const ua = (await headers()).get("user-agent");
  after(() => logClick({ path: "w", outcome: "prompt", eventId: event.id, sessionDate, src, userAgent: ua }));

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <GuestForm slug={slug} title={event.title} logoUrl={event.logo_url} sessionDate={sessionDate} src={src} rid={rid ?? null} passthrough={passthrough} />
    </main>
  );
}
