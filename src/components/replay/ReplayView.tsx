"use client";
// The replay page (SPEC-replay.md, reshaped 2026-09-21 after Jeremy's review): the video first, one headline and
// one line under it, the chapters as a row of names, a short strategy-call card with the real availability, three
// one-line proofs, two answers, a note. The offer is in two places: pinned to the bottom on phones (top right on a
// wide screen) and inside the player when the pitch starts. Watching is recorded as `replay` attendance.
import { useEffect, useRef, useState } from "react";
import { ReplayPlayer, type Chapter, type ReplayPlayerHandle } from "./ReplayPlayer";
import { TESTIMONIALS, type ReplayCopy } from "@/lib/replay-content";
import { useClientValue } from "@/lib/use-client-value";

type Cta = { label: string; href: string; at: number };

function clock(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m} min`;
}

/** "2 days 3 h", "5h 12m", "40 min". */
function remaining(expiresAt: number, now: number): string {
  const s = Math.max(0, Math.floor((expiresAt - now) / 1000));
  const d = Math.floor(s / 86_400);
  const h = Math.floor((s % 86_400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d >= 1) return `${d} day${d > 1 ? "s" : ""} ${h} h`;
  return h >= 1 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m} min`;
}

/** Where this device left off, from localStorage; null when there is nothing worth resuming. */
function savedPosition(key: string, seconds: number): number | null {
  try {
    const saved = Number(localStorage.getItem(key) ?? "");
    return saved > 60 && saved < seconds - 60 ? saved : null;
  } catch {
    return null;
  }
}

function CtaButton({ cta, size = "lg", onClick }: { cta: Cta; size?: "lg" | "sm"; onClick: () => void }) {
  return (
    <a
      href={cta.href}
      target="_blank"
      rel="noopener"
      onClick={onClick}
      className={`flex items-center justify-center gap-2 rounded-xl bg-cta font-bold text-cta-ink shadow-[0_6px_24px_rgba(245,179,36,0.35)] hover:brightness-105 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/60 ${size === "lg" ? "min-h-13 w-full px-6 text-lg" : "min-h-11 px-4 text-base"}`}
    >
      {cta.label}
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    </a>
  );
}

export function ReplayView({ token, firstName, title, logoUrl, seconds, cta: ctaIn, chapters, params, expiresAt, serverNow, copy }: { token: string; firstName: string; title: string; logoUrl: string | null; seconds: number; cta: Cta | null; chapters: Chapter[]; params: Record<string, string>; expiresAt: number | null; serverNow: number; copy: ReplayCopy }) {
  const REPLAY_COPY = copy;
  const cta = ctaIn ? { ...ctaIn, label: REPLAY_COPY.ctaLabel || ctaIn.label } : null;
  const player = useRef<ReplayPlayerHandle>(null);
  const last = useRef(0);
  const skew = useRef(0);
  const [now, setNow] = useState(serverNow);
  const [hot, setHot] = useState(false);
  const [nudge, setNudge] = useState<"pending" | "shown" | "closed">("pending");
  const key = `bc-replay-${token}`;
  const saved = useClientValue(() => savedPosition(key, seconds), null);
  const [resumeDismissed, setResumeDismissed] = useState(false);
  const resumeAt = resumeDismissed ? null : saved;

  useEffect(() => {
    skew.current = serverNow - Date.now();
    const id = setInterval(() => setNow(Date.now() + skew.current), 30_000);
    return () => clearInterval(id);
  }, [serverNow]);

  // A beat every 30 s while playing, the position remembered on this device, the way out recorded.
  useEffect(() => {
    let playing = false;
    const beat = () => {
      if (!playing) return;
      fetch("/api/heartbeat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, kind: "replay", offset: Math.floor(last.current), params }), keepalive: true }).catch(() => {});
      try {
        localStorage.setItem(key, String(Math.floor(last.current)));
      } catch {
        /* ignore */
      }
    };
    const id = setInterval(beat, 30_000);
    const onVis = () => {
      playing = document.visibilityState === "visible";
    };
    playing = true;
    document.addEventListener("visibilitychange", onVis);
    const leave = () => {
      try {
        navigator.sendBeacon("/api/heartbeat", new Blob([JSON.stringify({ token, kind: "replay", offset: Math.floor(last.current) })], { type: "application/json" }));
      } catch {
        /* best-effort */
      }
    };
    window.addEventListener("pagehide", leave);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", leave);
    };
  }, [token, key, params]);

  function onTime(t: number) {
    last.current = t;
    if (cta && t >= cta.at) {
      if (!hot) setHot(true);
      if (nudge === "pending") setNudge("shown");
    }
  }

  function seek(at: number) {
    player.current?.seek(at, true);
    setResumeDismissed(true);
  }

  function clicked() {
    try {
      navigator.sendBeacon("/api/cta", new Blob([JSON.stringify({ token, kind: "replay" })], { type: "application/json" }));
    } catch {
      /* best-effort */
    }
  }

  return (
    <main onContextMenu={(e) => e.preventDefault()} className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pb-28 sm:px-6 sm:pb-12" style={{ paddingTop: "calc(1rem + env(safe-area-inset-top, 0px))" }}>
      <header className="flex items-center justify-between gap-4">
        {logoUrl ? <img src={logoUrl} alt="BestOnlineClassroom" className="h-7 w-auto sm:h-8" /> : <span className="font-bold">BestOnlineClassroom</span>}
        <div className="flex items-center gap-3">
          {firstName && <span className="text-sm text-muted">Hi {firstName}</span>}
          {cta && (
            <div className="hidden sm:block">
              <CtaButton cta={cta} size="sm" onClick={clicked} />
            </div>
          )}
        </div>
      </header>

      <div className="relative -mx-4 overflow-hidden sm:mx-0 sm:rounded-xl sm:ring-1 sm:ring-line">
        <ReplayPlayer ref={player} token={token} seconds={seconds} chapters={chapters} logoUrl={logoUrl} onTime={onTime} />
        {resumeAt !== null && (
          <div className="absolute inset-x-0 top-0 flex flex-wrap items-center justify-between gap-2 bg-room/90 px-4 py-2 text-sm">
            <span>You were at {clock(resumeAt)}.</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => seek(resumeAt)} className="min-h-9 rounded-md bg-brand px-3 font-bold text-white">
                Pick up there
              </button>
              <button type="button" onClick={() => setResumeDismissed(true)} className="min-h-9 rounded-md px-3 text-muted">
                Start over
              </button>
            </div>
          </div>
        )}
        {nudge === "shown" && cta && (
          <div className="rise absolute inset-x-0 top-0 flex items-center justify-between gap-3 bg-gradient-to-b from-black/90 to-black/40 px-4 py-3 text-sm">
            <span className="font-bold text-white">{REPLAY_COPY.ctaLeadHot}</span>
            <div className="flex shrink-0 items-center gap-2">
              <a href={cta.href} target="_blank" rel="noopener" onClick={clicked} className="min-h-10 rounded-lg bg-cta px-4 py-2 font-bold text-cta-ink">
                {cta.label}
              </a>
              <button type="button" onClick={() => setNudge("closed")} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full bg-black/50 text-white">
                ×
              </button>
            </div>
          </div>
        )}
      </div>

      <section className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-bold leading-tight text-balance sm:text-3xl">{REPLAY_COPY.headline}</h1>
        <p className="text-base text-muted">
          {firstName ? `Your replay, ${firstName}. ` : "Your replay. "}
          {REPLAY_COPY.sub}
        </p>
      </section>

      {chapters.length > 0 && (
        <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" aria-label="Chapters">
          {chapters.map((c) => (
            <button key={`${c.at}-${c.label}`} type="button" onClick={() => seek(c.at)} className="min-h-10 shrink-0 rounded-full border border-line bg-panel px-4 text-[15px] hover:border-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand">
              {c.label}
            </button>
          ))}
        </nav>
      )}

      <section className={`rounded-xl border p-5 transition-colors ${hot ? "border-cta/60 bg-cta/10" : "border-line bg-panel"}`}>
        <p className="text-lg font-bold">{REPLAY_COPY.recapTitle}</p>
        <ul className="mt-2 flex flex-col gap-1.5 text-base">
          {REPLAY_COPY.recap.map((r) => (
            <li key={r} className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
              <span>{r}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-muted">
          {expiresAt !== null && (
            <>
              {REPLAY_COPY.expiresLead} <span className="font-bold text-ink tabular-nums">{remaining(expiresAt, now)}</span>.{" "}
            </>
          )}
          {REPLAY_COPY.reserved}
        </p>
      </section>

      <section>
        <p className="text-sm font-bold text-muted">{REPLAY_COPY.proofTitle}</p>
        <ul className="mt-2 flex flex-col gap-2">
          {TESTIMONIALS.map((t) => (
            <li key={t.name} className="flex items-center gap-3 text-[15px]">
              <img src={t.photo} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" loading="lazy" />
              <span className="min-w-0">
                <span className="font-bold">{t.title}.</span> <span className="text-muted">{t.name}, {t.brokerage}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2 text-[15px]">
        {REPLAY_COPY.faq.map(([q, a]) => (
          <p key={q}>
            <span className="font-bold">{q}</span> <span className="text-muted">{a}</span>
          </p>
        ))}
      </section>

      <p className="text-sm text-muted">{REPLAY_COPY.after}</p>
      <p className="text-xs text-muted/70">{title}</p>

      {cta && (
        <div className="fixed inset-x-0 bottom-0 border-t border-line bg-room/95 px-4 py-3 backdrop-blur sm:hidden" style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}>
          <CtaButton cta={cta} onClick={clicked} />
        </div>
      )}
    </main>
  );
}

export function ReplayExpired({ logoUrl, cta: ctaIn, onClickHref, copy }: { logoUrl: string | null; cta: Cta | null; onClickHref: string; copy: ReplayCopy }) {
  const REPLAY_COPY = copy;
  const cta = ctaIn ? { ...ctaIn, label: REPLAY_COPY.ctaLabel || ctaIn.label } : null;
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-5 px-6 py-10">
      {logoUrl && <img src={logoUrl} alt="BestOnlineClassroom" className="h-8 w-auto self-start" />}
      <h1 className="text-2xl font-bold leading-tight text-balance">{REPLAY_COPY.expiredHeadline}</h1>
      <p className="text-base text-muted">{REPLAY_COPY.expiredSub}</p>
      {cta && <CtaButton cta={cta} onClick={() => {}} />}
      <a href={onClickHref} className="text-center text-base text-brand underline">
        Register for the next live session
      </a>
    </main>
  );
}
