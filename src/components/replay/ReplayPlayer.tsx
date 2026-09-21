"use client";
// A player built for the replay: one big Play button that starts the recording with sound, a seek bar with the
// chapters marked on it and the current chapter named above it, time, sound, full screen. Nothing starts until
// the person presses Play, so the first thing they hear is the training, not silence.
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useClientValue } from "@/lib/use-client-value";

export type Chapter = { at: number; label: string };
export type ReplayPlayerHandle = { seek: (at: number, play?: boolean) => void };

function fmt(s: number): string {
  s = Math.max(0, Math.floor(s));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
}

export const ReplayPlayer = forwardRef<ReplayPlayerHandle, { token: string; seconds: number; chapters: Chapter[]; logoUrl: string | null; onTime?: (t: number) => void; onPlay?: () => void }>(function ReplayPlayer({ token, seconds, chapters, logoUrl, onTime, onPlay }, ref) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let stop = false;
    fetch(`/api/video?token=${encodeURIComponent(token)}&kind=replay`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((j: { url: string }) => {
        if (!stop) setSrc(j.url);
      })
      .catch(() => {
        if (!stop) setFailed(true);
      });
    return () => {
      stop = true;
    };
  }, [token]);
  const box = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(seconds);
  const [scrubbing, setScrubbing] = useState<number | null>(null);
  // The file URL is attached after mount, so it never appears in the page source. Right-click is off.
  const [attached, setAttached] = useState(false);
  const canFullscreen = useClientValue(() => Boolean(document.fullscreenEnabled), false);

  useImperativeHandle(ref, () => ({
    seek(at, play = true) {
      const v = video.current;
      if (!v) return;
      v.currentTime = Math.max(0, Math.min(at, v.duration || seconds));
      setCurrent(v.currentTime);
      if (play) {
        v.muted = false;
        v.play().catch(() => {});
      }
    },
  }));

  useEffect(() => {
    const v = video.current;
    if (!v || !src) return;
    v.src = src;
    const onT = () => {
      setCurrent(v.currentTime);
      onTime?.(v.currentTime);
    };
    const onD = () => setDuration(v.duration || seconds);
    const onP = () => {
      setStarted(true);
      setPlaying(true);
      onPlay?.();
    };
    const onPa = () => setPlaying(false);
    const onVol = () => setMuted(v.muted);
    v.addEventListener("timeupdate", onT);
    v.addEventListener("durationchange", onD);
    v.addEventListener("play", onP);
    v.addEventListener("pause", onPa);
    v.addEventListener("ended", onPa);
    v.addEventListener("volumechange", onVol);
    const t = setTimeout(() => setAttached(true), 0);
    return () => {
      clearTimeout(t);
      v.removeEventListener("timeupdate", onT);
      v.removeEventListener("durationchange", onD);
      v.removeEventListener("play", onP);
      v.removeEventListener("pause", onPa);
      v.removeEventListener("ended", onPa);
      v.removeEventListener("volumechange", onVol);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  function toggle() {
    const v = video.current;
    if (!v) return;
    if (v.paused) {
      v.muted = false;
      v.volume = 1;
      v.play().catch(() => {});
    } else v.pause();
  }

  function toggleSound() {
    const v = video.current;
    if (v) v.muted = !v.muted;
  }

  function fullscreen() {
    box.current?.requestFullscreen?.().catch(() => {});
  }

  function onKey(e: React.KeyboardEvent) {
    const v = video.current;
    if (!v) return;
    if (e.key === " " || e.key === "k") {
      e.preventDefault();
      toggle();
    } else if (e.key === "ArrowRight") v.currentTime = Math.min(v.currentTime + 10, duration);
    else if (e.key === "ArrowLeft") v.currentTime = Math.max(v.currentTime - 10, 0);
  }

  function commitScrub() {
    const v = video.current;
    if (v && scrubbing !== null) {
      v.currentTime = scrubbing;
      setCurrent(scrubbing);
    }
    setScrubbing(null);
  }

  const shown = scrubbing ?? current;
  const pct = duration ? (shown / duration) * 100 : 0;
  const chapterNow = [...chapters].reverse().find((c) => c.at <= shown);

  return (
    <div ref={box} tabIndex={0} onKeyDown={onKey} onContextMenu={(e) => e.preventDefault()} className="relative aspect-video w-full bg-black outline-none select-none focus-visible:ring-2 focus-visible:ring-brand">
      <video ref={video} className="pointer-events-none absolute inset-0 h-full w-full object-contain" playsInline preload="metadata" tabIndex={-1} disablePictureInPicture disableRemotePlayback controlsList="nodownload noremoteplayback" />
      {(!started || !attached) && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-panel to-room">
          {logoUrl && <img src={logoUrl} alt="" className="absolute top-5 h-7 w-auto opacity-80 sm:h-8" />}
          {failed && <p className="text-base text-muted">The video could not load. Refresh the page.</p>}
        </div>
      )}
      <button type="button" onClick={toggle} aria-label={playing ? "Pause" : "Play"} className="absolute inset-0 flex items-center justify-center focus:outline-none">
        {!playing && (
          <span className="inline-flex items-center gap-3 rounded-full bg-brand px-7 py-4 text-xl font-bold text-white shadow-[0_8px_30px_rgba(47,124,246,0.45)] ring-2 ring-white/20">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M8 5v14l11-7z" />
            </svg>
            {started ? "Play" : "Play the training"}
          </span>
        )}
      </button>

      <div className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-3 pb-2 pt-8 text-white ${started ? "" : "opacity-80"}`}>
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="truncate font-bold">{chapterNow?.label ?? ""}</span>
          <span className="tabular-nums text-white/85">
            {fmt(shown)} / {fmt(duration)}
          </span>
        </div>
        <div className="relative h-8">
          <div className="absolute inset-x-0 top-3 h-1.5 rounded-full bg-white/25" />
          <div className="absolute left-0 top-3 h-1.5 rounded-full bg-cta" style={{ width: `${pct}%` }} />
          {chapters.map((c) => (
            <span key={c.at} className="absolute top-2.5 h-2.5 w-0.5 bg-white/90" style={{ left: `${duration ? (c.at / duration) * 100 : 0}%` }} title={c.label} />
          ))}
          <input
            type="range"
            min={0}
            max={Math.max(1, Math.floor(duration))}
            step={1}
            value={Math.floor(shown)}
            aria-label="Position"
            onChange={(e) => setScrubbing(Number(e.target.value))}
            onPointerUp={commitScrub}
            onKeyUp={commitScrub}
            className="absolute inset-x-0 top-0 h-8 w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cta [&::-webkit-slider-thumb]:shadow [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-cta"
          />
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={toggle} aria-label={playing ? "Pause" : "Play"} className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-white">
            {playing ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
          <button type="button" onClick={toggleSound} aria-label={muted ? "Sound on" : "Mute"} className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-white">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M11 5 6 9H2v6h4l5 4V5z" />
              {muted ? <path d="M22 9l-6 6M16 9l6 6" /> : <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5.5a10 10 0 0 1 0 13" />}
            </svg>
          </button>
          <span className="flex-1" />
          {canFullscreen && (
            <button type="button" onClick={fullscreen} aria-label="Full screen" className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-white">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
});
