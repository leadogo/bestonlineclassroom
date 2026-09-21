"use client";
// The replay page, shaped by Jeremy's brief (KB topic frea-replay-page-sep2026): one line saying what this is, the
// call to action above and below the video and pinned to the bottom on phones, an in-player nudge when the pitch
// starts, a few big chapters, a short recap and FAQ, nothing that leads off the page. Watching is recorded as
// `replay` attendance. Copy lives in REPLAY_COPY so it can be tuned without touching the layout.
import { useEffect, useRef, useState } from "react";
import { useClientValue } from "@/lib/use-client-value";

export const REPLAY_COPY = {
  kicker: "Your replay of the AI For Agents Masterclass",
  headline: "How agents book appointments with an AI setter instead of cold calling",
  sub: "Watch the full training now, then lock in your strategy call. Pause and come back any time.",
  ctaLead: "Ready to see it working for you?",
  ctaLeadHot: "This is the part where people book their call.",
  recapTitle: "On your strategy call",
  recap: ["See whether the AI appointment setter fits your market and your leads.", "Walk through exactly how it books appointments on your calendar.", "Get every question answered. No pressure, no jargon."],
  faqTitle: "Quick answers",
  faq: [
    ["Do I have to watch all of it before booking?", "No. Book whenever you're ready; the call covers what you missed."],
    ["Can I watch on my phone?", "Yes. Turn it sideways for a bigger picture. Your spot is saved if you leave."],
    ["Who is the call with?", "A real person from William's team, not a sales robot."],
  ],
  after: "Questions? Reply to the email your link came in and a real person answers.",
};

type Cta = { label: string; href: string; at: number };
type Chapter = { at: number; label: string };

function clock(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${String(m).padStart(2, "0")}` : `${m} min`;
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
      className={`flex w-full items-center justify-center gap-2 rounded-xl bg-cta font-bold text-cta-ink shadow-[0_6px_24px_rgba(245,179,36,0.35)] hover:brightness-105 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/60 ${size === "lg" ? "min-h-13 px-6 text-lg" : "min-h-11 px-4 text-base"}`}
    >
      {cta.label}
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    </a>
  );
}

export function ReplayView({ token, firstName, title, logoUrl, videoUrl, seconds, cta, chapters, params }: { token: string; firstName: string; title: string; logoUrl: string | null; videoUrl: string; seconds: number; cta: Cta | null; chapters: Chapter[]; params: Record<string, string> }) {
  const video = useRef<HTMLVideoElement>(null);
  const [hot, setHot] = useState(false);
  const [nudge, setNudge] = useState(false);
  const key = `bc-replay-${token}`;
  // Remember where they were (this device only) and offer to pick it up.
  const saved = useClientValue(() => savedPosition(key, seconds), null);
  const [resumeDismissed, setResumeDismissed] = useState(false);
  const resumeAt = resumeDismissed ? null : saved;

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    const beat = () => {
      if (v.paused || v.ended) return;
      fetch("/api/heartbeat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, kind: "replay", offset: Math.floor(v.currentTime), params }), keepalive: true }).catch(() => {});
      try {
        localStorage.setItem(key, String(Math.floor(v.currentTime)));
      } catch {
        /* ignore */
      }
    };
    let nudged = false;
    const onTime = () => {
      if (cta && v.currentTime >= cta.at) {
        setHot(true);
        if (!nudged) {
          nudged = true;
          setNudge(true);
        }
      }
    };
    v.addEventListener("play", beat);
    v.addEventListener("timeupdate", onTime);
    const id = setInterval(beat, 30_000);
    const leave = () => {
      try {
        navigator.sendBeacon("/api/heartbeat", new Blob([JSON.stringify({ token, kind: "replay", offset: Math.floor(v.currentTime) })], { type: "application/json" }));
      } catch {
        /* best-effort */
      }
    };
    window.addEventListener("pagehide", leave);
    return () => {
      clearInterval(id);
      v.removeEventListener("play", beat);
      v.removeEventListener("timeupdate", onTime);
      window.removeEventListener("pagehide", leave);
    };
  }, [token, key, cta, params]);

  function seek(at: number) {
    const v = video.current;
    if (!v) return;
    v.currentTime = at;
    v.play().catch(() => {});
    setResumeDismissed(true);
    v.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  function clicked() {
    try {
      navigator.sendBeacon("/api/cta", new Blob([JSON.stringify({ token, kind: "replay" })], { type: "application/json" }));
    } catch {
      /* best-effort */
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-7 px-4 pb-28 sm:px-6 sm:pb-12" style={{ paddingTop: "calc(1.25rem + env(safe-area-inset-top, 0px))" }}>
      <header className="flex items-center justify-between gap-4">
        {logoUrl ? <img src={logoUrl} alt="BestOnlineClassroom" className="h-7 w-auto sm:h-8" /> : <span className="font-bold">BestOnlineClassroom</span>}
        {firstName && <span className="text-sm text-muted">Hi {firstName}</span>}
      </header>

      <section className="flex flex-col gap-3">
        <p className="text-sm font-bold text-brand">{REPLAY_COPY.kicker}</p>
        <h1 className="text-2xl font-bold leading-tight text-balance sm:text-3xl">{REPLAY_COPY.headline}</h1>
        <p className="text-base text-muted">
          {REPLAY_COPY.sub} {seconds > 0 && <span className="tabular-nums">The training is {clock(seconds)} long.</span>}
        </p>
        {cta && (
          <div className="mt-1 hidden sm:block">
            <CtaButton cta={cta} onClick={clicked} />
          </div>
        )}
      </section>

      <div className="relative overflow-hidden rounded-xl bg-black ring-1 ring-line">
        <video ref={video} src={videoUrl} controls playsInline preload="metadata" controlsList="nodownload" className="aspect-video w-full" />
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
        {nudge && cta && (
          <div className="rise absolute inset-x-0 bottom-14 flex items-center justify-between gap-3 bg-gradient-to-t from-black/90 to-black/40 px-4 py-3 text-sm sm:bottom-16">
            <span className="font-bold text-white">{REPLAY_COPY.ctaLeadHot}</span>
            <div className="flex shrink-0 items-center gap-2">
              <a href={cta.href} target="_blank" rel="noopener" onClick={clicked} className="min-h-10 rounded-lg bg-cta px-4 py-2 font-bold text-cta-ink">
                {cta.label}
              </a>
              <button type="button" onClick={() => setNudge(false)} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full bg-black/50 text-white">
                ×
              </button>
            </div>
          </div>
        )}
      </div>

      {chapters.length > 0 && (
        <section className="flex flex-col gap-2">
          <p className="text-sm font-bold text-muted">Jump to</p>
          <div className="flex flex-wrap gap-2">
            {chapters.map((c) => (
              <button key={`${c.at}-${c.label}`} type="button" onClick={() => seek(c.at)} className="min-h-11 rounded-full border border-line bg-panel px-4 text-base hover:border-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand">
                {c.label} <span className="ml-1 text-sm text-muted tabular-nums">{clock(c.at)}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {cta && (
        <section className={`rounded-xl border p-5 transition-colors ${hot ? "border-cta/60 bg-cta/10" : "border-line bg-panel"}`}>
          <p className="text-lg font-bold">{hot ? REPLAY_COPY.ctaLeadHot : REPLAY_COPY.ctaLead}</p>
          <p className="mt-3 text-sm font-bold text-muted">{REPLAY_COPY.recapTitle}</p>
          <ul className="mt-1 flex flex-col gap-1.5 text-base">
            {REPLAY_COPY.recap.map((r) => (
              <li key={r} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
                <span>{r}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4">
            <CtaButton cta={cta} onClick={clicked} />
          </div>
        </section>
      )}

      <section>
        <p className="text-sm font-bold text-muted">{REPLAY_COPY.faqTitle}</p>
        <dl className="mt-2 flex flex-col gap-3">
          {REPLAY_COPY.faq.map(([q, a]) => (
            <div key={q}>
              <dt className="font-bold">{q}</dt>
              <dd className="text-base text-muted">{a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <p className="text-sm text-muted">{REPLAY_COPY.after}</p>
      <p className="text-xs text-muted/70">{title}</p>

      {cta && (
        <div className="fixed inset-x-0 bottom-0 border-t border-line bg-room/95 px-4 py-3 backdrop-blur sm:hidden" style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}>
          <CtaButton cta={cta} size="sm" onClick={clicked} />
        </div>
      )}
    </main>
  );
}
