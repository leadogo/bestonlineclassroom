"use client";
import { useState } from "react";

/**
 * The scripted call to action as a banner: the event icon, a title, a subtitle, the button, and a way to close
 * it for the rest of the session. On a phone held upright it sits between the video and the chat; on a wide
 * screen it lies over the bottom of the video. One warm colour on the whole screen, so it cannot be missed.
 */
export function CtaBar({ label, href, title, subtitle, iconUrl, token, overlay = false, onDismiss }: { label: string; href: string; title: string; subtitle: string; iconUrl: string | null; token: string; overlay?: boolean; onDismiss: () => void }) {
  const [gone, setGone] = useState(false);
  function clicked() {
    try {
      navigator.sendBeacon("/api/cta", new Blob([JSON.stringify({ token })], { type: "application/json" }));
    } catch {
      /* best-effort */
    }
  }
  if (gone) return null;
  return (
    <div className={`rise ${overlay ? "bg-gradient-to-t from-black/90 via-black/70 to-transparent px-3 pb-3 pt-8 sm:px-4 sm:pb-4" : "border-b border-line bg-panel px-3 py-2.5"}`} role="region" aria-label="Offer">
      <div className="mx-auto flex max-w-xl items-center gap-3 rounded-xl bg-cta px-3 py-2.5 text-cta-ink shadow-[0_6px_24px_rgba(245,179,36,0.35)]">
        {iconUrl && <img src={iconUrl} alt="" className="hidden h-9 w-9 shrink-0 rounded-md sm:block" />}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold leading-tight">{title}</p>
          <p className="truncate text-[13px] leading-tight opacity-85">{subtitle}</p>
        </div>
        <a href={href} target="_blank" rel="noopener" onClick={clicked} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-cta-ink px-3.5 text-[15px] font-bold text-cta focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70">
          {label}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </a>
        <button type="button" onClick={() => { setGone(true); onDismiss(); }} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-cta-ink/70 hover:bg-cta-ink/10 hover:text-cta-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-cta-ink/50" aria-label="Close this offer">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
