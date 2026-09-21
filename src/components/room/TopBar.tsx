"use client";

function elapsed(offset: number): string {
  const h = Math.floor(offset / 3600);
  const m = Math.floor((offset % 3600) / 60);
  const s = offset % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s` : `${m}m ${String(s).padStart(2, "0")}s`;
}

export function TopBar({ title, live, offset, onFullscreen, preview }: { title: string; live: boolean; offset: number; onFullscreen: () => void; preview: boolean }) {
  return (
    <header className="flex items-center gap-3 border-b border-slate-800 px-3 py-2 sm:px-4" style={{ paddingTop: "calc(0.5rem + env(safe-area-inset-top, 0px))" }}>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-sm font-medium sm:text-base">{title}</h1>
        <div className="mt-0.5 flex items-center gap-2 text-xs">
          {live ? (
            <span className="inline-flex items-center gap-1.5 rounded bg-rose-600/20 px-1.5 py-0.5 font-medium text-rose-300">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-400" aria-hidden />
              LIVE <span className="tabular-nums text-rose-200/80">{elapsed(offset)}</span>
            </span>
          ) : (
            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-300">Starting soon</span>
          )}
          {preview && <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-amber-300">Team preview</span>}
        </div>
      </div>
      <button type="button" onClick={onFullscreen} className="rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">
        Full screen
      </button>
    </header>
  );
}
