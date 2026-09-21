"use client";

/**
 * The scripted call to action. Full: the event icon, a title, a line under it, a full-width button and an ×.
 * Nothing truncates: the lines wrap. After the × it becomes a slim strip (icon, title, a small button) that stays
 * until the offer window ends, so the offer is always one tap away. On a phone held upright the full banner sits
 * between the video and the chat; on a wide screen it lies over the bottom of the video.
 */
export function CtaBar({ label, href, title, subtitle, iconUrl, token, overlay = false, slim = false, onDismiss }: { label: string; href: string; title: string; subtitle: string; iconUrl: string | null; token: string; overlay?: boolean; slim?: boolean; onDismiss: () => void }) {
  function clicked() {
    try {
      navigator.sendBeacon("/api/cta", new Blob([JSON.stringify({ token })], { type: "application/json" }));
    } catch {
      /* best-effort */
    }
  }
  const button = "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-cta-ink px-4 text-[15px] font-bold text-cta focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70";
  if (slim) {
    return (
      <div className={overlay ? "bg-gradient-to-t from-black/85 to-transparent px-3 pb-2 pt-6" : "border-b border-line bg-panel px-3 py-1.5"} role="region" aria-label="Offer">
        <div className="mx-auto flex max-w-xl items-center gap-2 rounded-lg bg-cta px-2.5 py-1.5 text-cta-ink">
          {iconUrl && <img src={iconUrl} alt="" className="h-6 w-auto max-w-10 shrink-0 rounded object-contain" />}
          <p className="min-w-0 flex-1 truncate text-sm font-bold">{title}</p>
          <a href={href} target="_blank" rel="noopener" onClick={clicked} className="inline-flex min-h-8 shrink-0 items-center rounded-md bg-cta-ink px-3 text-sm font-bold text-cta">
            {label.length > 18 ? "Claim" : label}
          </a>
        </div>
      </div>
    );
  }
  return (
    <div className={`rise ${overlay ? "bg-gradient-to-t from-black/90 via-black/70 to-transparent px-3 pb-3 pt-8 sm:px-4 sm:pb-4" : "border-b border-line bg-panel px-3 py-2.5"}`} role="region" aria-label="Offer">
      <div className="mx-auto flex max-w-xl flex-col gap-2.5 rounded-xl bg-cta px-3.5 py-3 text-cta-ink shadow-[0_6px_24px_rgba(245,179,36,0.35)]">
        <div className="flex items-start gap-3">
          {iconUrl && <img src={iconUrl} alt="" className="h-10 w-auto max-w-14 shrink-0 rounded-md object-contain" />}
          <div className="min-w-0 flex-1">
            <p className="text-[16px] font-bold leading-tight text-balance">{title}</p>
            <p className="mt-0.5 text-[13px] leading-snug opacity-85">{subtitle}</p>
          </div>
          <button type="button" onClick={onDismiss} className="-mr-1 -mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-cta-ink/70 hover:bg-cta-ink/10 hover:text-cta-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-cta-ink/50" aria-label="Make this smaller">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <a href={href} target="_blank" rel="noopener" onClick={clicked} className={`${button} w-full`}>
          {label}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </a>
      </div>
    </div>
  );
}
