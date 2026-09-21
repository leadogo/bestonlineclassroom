"use client";

/**
 * The scripted call to action. On a phone held upright it is a bar between the video and the chat; on a wide
 * screen it sits over the bottom of the video. One warm colour on the whole screen, so it cannot be missed.
 */
export function CtaBar({ label, href, token, overlay = false }: { label: string; href: string; token: string; overlay?: boolean }) {
  function clicked() {
    try {
      navigator.sendBeacon("/api/cta", new Blob([JSON.stringify({ token })], { type: "application/json" }));
    } catch {
      /* best-effort */
    }
  }
  return (
    <div className={`rise ${overlay ? "bg-gradient-to-t from-black/90 via-black/60 to-transparent px-4 pb-4 pt-10" : "border-b border-line bg-panel px-4 py-3"}`}>
      <div className="mx-auto flex max-w-md flex-col items-center gap-2 text-center">
        <p className={`text-sm ${overlay ? "text-white/85" : "text-muted"}`}>Ready to take the next step?</p>
        <a
          href={href}
          target="_blank"
          rel="noopener"
          onClick={clicked}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-cta px-6 py-4 text-lg font-bold text-cta-ink shadow-[0_6px_24px_rgba(245,179,36,0.35)] hover:brightness-105 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/60"
        >
          {label}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </a>
      </div>
    </div>
  );
}
