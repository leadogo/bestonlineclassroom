"use client";

/** The scripted call to action, over the bottom of the stage while it is active. Opens in a new tab; the beacon records the click. */
export function CtaBar({ label, href, token }: { label: string; href: string; token: string }) {
  function clicked() {
    try {
      navigator.sendBeacon("/api/cta", new Blob([JSON.stringify({ token })], { type: "application/json" }));
    } catch {
      /* best-effort */
    }
  }
  return (
    <div className="absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-black/80 to-transparent p-3 sm:p-4">
      <a href={href} target="_blank" rel="noopener" onClick={clicked} className="rounded-md bg-amber-400 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-lg hover:bg-amber-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-white">
        {label}
      </a>
    </div>
  );
}
