"use client";
// The recording, played as if live: opened at the expected offset, kept within 5 s of it, muted until the
// viewer taps for sound (mobile autoplay rules), no controls, no scrubbing. Everything else is best-effort.
import { useEffect, useState, type RefObject } from "react";

const DRIFT_SECONDS = 5;
const STALL_MS = 5000;

export function VideoStage({ src, expected, videoRef }: { src: string | null; expected: () => number; videoRef: RefObject<HTMLVideoElement | null> }) {
  const [sound, setSound] = useState(false);
  const [stalled, setStalled] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !src) return;
    v.muted = true;
    let stallTimer: ReturnType<typeof setTimeout> | null = null;
    const seek = () => {
      const t = expected();
      if (Number.isFinite(v.duration) && t > v.duration) return;
      v.currentTime = Math.max(0, t);
    };
    const onMeta = () => {
      seek();
      v.play().catch(() => {});
    };
    const onWaiting = () => {
      if (stallTimer) clearTimeout(stallTimer);
      stallTimer = setTimeout(() => setStalled(true), STALL_MS);
    };
    const onPlaying = () => {
      if (stallTimer) clearTimeout(stallTimer);
      stallTimer = null;
      setStalled(false);
    };
    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("waiting", onWaiting);
    v.addEventListener("stalled", onWaiting);
    v.addEventListener("playing", onPlaying);
    if (v.readyState >= 1) onMeta();
    const drift = setInterval(() => {
      if (v.paused && !v.ended) v.play().catch(() => {});
      if (Math.abs(v.currentTime - expected()) > DRIFT_SECONDS) seek();
    }, 30_000);
    return () => {
      clearInterval(drift);
      if (stallTimer) clearTimeout(stallTimer);
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("waiting", onWaiting);
      v.removeEventListener("stalled", onWaiting);
      v.removeEventListener("playing", onPlaying);
    };
    // expected is stable for the life of the room
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  function unmute() {
    const v = videoRef.current;
    if (!v) return;
    v.muted = false;
    v.volume = 1;
    v.play().catch(() => {});
    setSound(true);
  }

  if (!src) {
    return <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">The video is not available yet.</div>;
  }

  return (
    <>
      <video
        ref={videoRef}
        src={src}
        className="absolute inset-0 h-full w-full object-contain"
        playsInline
        autoPlay
        muted
        preload="auto"
        disablePictureInPicture
        controlsList="nodownload noplaybackrate noremoteplayback"
        onContextMenu={(e) => e.preventDefault()}
      />
      {!sound && (
        <button type="button" onClick={unmute} className="absolute inset-0 flex items-center justify-center bg-black/30 focus:outline-none" aria-label="Click for sound">
          <span className="inline-flex items-center gap-2 rounded-md bg-slate-950/90 px-4 py-2.5 text-sm font-medium text-white shadow-lg ring-1 ring-white/10">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M11 5 6 9H2v6h4l5 4V5z" />
              <path d="M15.5 8.5a5 5 0 0 1 0 7" />
            </svg>
            Click for sound
          </span>
        </button>
      )}
      {stalled && <p className="absolute bottom-3 left-3 rounded bg-slate-950/80 px-2 py-1 text-xs text-slate-300">Reconnecting…</p>}
    </>
  );
}
