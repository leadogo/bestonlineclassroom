import { notFound, redirect } from "next/navigation";
import { GuestForm } from "./guest-form";
import { resolveForSession } from "@/lib/attendees";
import { currentOrNextSession, fourZones, roomState, scheduleOf, sessionFor } from "@/lib/daily-schedule";
import { PRESENCE_GRACE_MS } from "@/lib/outcomes";
import { crowdShare } from "@/lib/crowd";
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

  // The join card (William, Sep 23: it has to look like something you trust): what they are joining, who is on
  // stage, when, who is in the room now, and one field.
  const now = new Date();
  const state = roomState(schedule, now, sessionDate);
  const live = state.state === "live";
  const session = state.session;
  const zones = fourZones(session);
  const mountain = zones.find(([z]) => z === "Mountain")?.[1] ?? "";
  const dayLabel = new Intl.DateTimeFormat("en-US", { timeZone: event.timezone, weekday: "long", month: "long", day: "numeric" }).format(session.start);
  const isToday = session.date === currentOrNextSession(schedule, now).date && new Intl.DateTimeFormat("en-CA", { timeZone: event.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now) === session.date;
  const minutesToStart = Math.max(0, Math.round((session.start.getTime() - now.getTime()) / 60_000));
  const elapsed = Math.max(0, Math.floor((now.getTime() - session.start.getTime()) / 1000));
  const clock = `${Math.floor(elapsed / 3600)}:${String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0")}`;
  let watching: number | null = null;
  if (live) {
    const { count } = await db().from("attendance").select("registrant_id, registrant:registrants!inner(event_id)", { count: "exact", head: true }).eq("session_date", session.date).eq("kind", "live").eq("registrant.event_id", event.id).gte("last_seen_at", new Date(now.getTime() - PRESENCE_GRACE_MS).toISOString());
    const crowd = (event.simulated_names ?? []).length;
    watching = 1 + (count ?? 0) + Math.round(crowd * (event.people_curve_enabled ? crowdShare(elapsed, event.cta_at_seconds ?? null, event.video_seconds ?? 0) : 1));
  }
  const when = live ? `Started ${mountain} Mountain · ${clock} in` : isToday ? `Today at ${mountain} Mountain${minutesToStart > 0 && minutesToStart <= 180 ? ` · in ${minutesToStart} min` : ""}` : `${dayLabel} at ${mountain} Mountain`;

  return (
    <main className="min-h-screen bg-room px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-md">
        {event.logo_url && <img src={event.logo_url} alt="BestOnlineClassroom" className="mx-auto h-8 w-auto sm:h-9" />}
        <section className="mt-6 overflow-hidden rounded-2xl border border-line bg-panel shadow-[0_20px_60px_rgba(0,0,0,0.45)]" aria-labelledby="join-title">
          <div className="relative aspect-video bg-black">
            {event.poster_url ? <img src={event.poster_url} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full bg-gradient-to-br from-[#1b2a44] to-room" />}
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-gradient-to-t from-black/85 to-transparent px-4 pb-3 pt-8 text-white">
              {live ? (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-live px-2 py-0.5 text-xs font-bold tracking-wide"><span className="h-1.5 w-1.5 rounded-full bg-white" aria-hidden />Now playing <span className="font-normal text-white/85 tabular-nums">{clock}</span></span>
              ) : (
                <span className="rounded-md bg-white/15 px-2 py-0.5 text-xs font-bold backdrop-blur">Starts {isToday ? "today" : dayLabel.split(",")[0]} at {mountain} MT</span>
              )}
              {watching !== null && <span className="text-xs text-white/85 tabular-nums">{watching} watching now</span>}
            </div>
          </div>
          <div className="px-5 py-5 sm:px-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">You&rsquo;re joining</p>
            <h1 id="join-title" className="mt-1 text-xl font-bold leading-snug text-balance sm:text-2xl">{event.title}</h1>
            <div className="mt-3 flex items-center gap-3">
              {event.host_avatar_url ? <img src={event.host_avatar_url} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-line" /> : null}
              <div className="min-w-0">
                <p className="truncate font-bold leading-tight">{event.host_name}</p>
                {event.host_tagline && <p className="truncate text-sm text-muted">{event.host_tagline}</p>}
              </div>
            </div>
            <p className="mt-4 text-sm text-muted">{when}</p>
            <GuestForm slug={slug} sessionDate={sessionDate} src={src} rid={rid ?? null} passthrough={passthrough} live={live} />
            <ul className="mt-5 grid gap-1.5 text-xs text-muted">
              <li className="flex items-start gap-2"><span aria-hidden className="text-emerald-400">✓</span>Plays in your browser. Nothing to download, no account needed.</li>
              <li className="flex items-start gap-2"><span aria-hidden className="text-emerald-400">✓</span>Your name shows only in the chat. Your link is yours; keep it to come back in.</li>
              <li className="flex items-start gap-2"><span aria-hidden className="text-emerald-400">✓</span>{zones.map(([z, t]) => `${t} ${z}`).join(" · ")}</li>
            </ul>
          </div>
        </section>
        <p className="mt-5 text-center text-xs text-muted">Private session link · Hosted by {event.host_name} on BestOnlineClassroom</p>
      </div>
    </main>
  );
}
