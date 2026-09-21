"use client";
import { useClientValue } from "@/lib/use-client-value";

function elapsed(offset: number): string {
  const h = Math.floor(offset / 3600);
  const m = Math.floor((offset % 3600) / 60);
  const s = offset % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

export function TopBar({ title, iconUrl, live, offset, watching, onFullscreen, preview }: { title: string; iconUrl: string | null; live: boolean; offset: number; watching: number; onFullscreen: () => void; preview: boolean }) {
  const canFullscreen = useClientValue(() => Boolean(document.fullscreenEnabled), false);
  return (
    <header className="flex items-center gap-3 border-b border-line bg-room px-3 py-2 landscape-phone:py-1 sm:px-4" style={{ paddingTop: "calc(0.5rem + env(safe-area-inset-top, 0px))" }}>
      {iconUrl && <img src={iconUrl} alt="" className="h-7 w-7 shrink-0 landscape-phone:hidden" />}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[15px] font-bold leading-tight sm:text-base landscape-phone:hidden">{title}</h1>
        <div className="flex items-center gap-2 text-sm landscape-phone:mt-0 sm:mt-0.5">
          {live ? (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-live px-2 py-0.5 text-xs font-bold tracking-wide text-white">
              <span className="h-1.5 w-1.5 rounded-full bg-white" aria-hidden />
              LIVE
              <span className="font-normal tabular-nums text-white/85">{elapsed(offset)}</span>
            </span>
          ) : (
            <span className="rounded-md bg-panel px-2 py-0.5 text-xs font-bold text-muted">Starting soon</span>
          )}
          <span className="inline-flex items-center gap-1 text-muted">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span className="tabular-nums">{watching}</span>
            <span className="hidden sm:inline">watching</span>
          </span>
          {preview && <span className="rounded-md bg-cta/20 px-1.5 py-0.5 text-xs font-bold text-cta">Team preview</span>}
        </div>
      </div>
      {canFullscreen && (
        <button type="button" onClick={onFullscreen} className="rounded-md border border-line px-3 py-2 text-sm text-ink hover:bg-panel focus:outline-none focus-visible:ring-2 focus-visible:ring-brand">
          Full screen
        </button>
      )}
    </header>
  );
}
