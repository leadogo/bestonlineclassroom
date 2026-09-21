"use client";
// The recording, played as if live: opened at the expected offset, kept within 5 s of it, muted until the
// viewer taps for sound (mobile autoplay rules), no controls, no scrubbing, no clicks reaching the element.
import { useEffect, useState, type MutableRefObject } from "react";
import { useClientValue } from "@/lib/use-client-value";

const DRIFT_SECONDS = 5;
const STALL_MS = 5000;

export function VideoStage({ src, expected, videoRef }: { src: string | null; expected: () => number; videoRef: MutableRefObject<HTMLVideoElement | null> }) {
  const [sound, setSound] = useState(false);
  const [stalled, setStalled] = useState(false);
  const touch = useClientValue(() => window.matchMedia("(pointer: coarse)").matches, false);

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
    const tryPlay = () => v.play().catch(() => {});
    const onMeta = () => {
      seek();
      tryPlay();
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
    const onTime = () => {
      if (!v.paused) onPlaying();
    };
    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("canplay", tryPlay);
    v.addEventListener("waiting", onWaiting);
    v.addEventListener("stalled", onWaiting);
    v.addEventListener("playing", onPlaying);
    v.addEventListener("timeupdate", onTime);
    if (v.readyState >= 1) onMeta();
    const drift = setInterval(() => {
      if (v.paused && !v.ended) tryPlay();
      if (Math.abs(v.currentTime - expected()) > DRIFT_SECONDS) seek();
    }, 30_000);
    return () => {
      clearInterval(drift);
      if (stallTimer) clearTimeout(stallTimer);
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("canplay", tryPlay);
      v.removeEventListener("waiting", onWaiting);
      v.removeEventListener("stalled", onWaiting);
      v.removeEventListener("playing", onPlaying);
      v.removeEventListener("timeupdate", onTime);
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
    return <div className="absolute inset-0 flex items-center justify-center text-base text-muted">The video is not available yet.</div>;
  }

  return (
    <>
      <video
        ref={(el) => {
          // React does not write the muted attribute; the browser must see muted before it decides on autoplay.
          if (el) el.muted = true;
          videoRef.current = el;
        }}
        src={src}
        className="pointer-events-none absolute inset-0 h-full w-full object-contain"
        playsInline
        autoPlay
        muted
        preload="auto"
        tabIndex={-1}
        disablePictureInPicture
        disableRemotePlayback
      />
      {!sound && (
        <button type="button" onClick={unmute} className="absolute inset-0 flex items-center justify-center bg-black/35 focus:outline-none" aria-label={touch ? "Tap for sound" : "Click for sound"}>
          <span className="inline-flex items-center gap-3 rounded-full bg-brand px-6 py-3.5 text-lg font-bold text-white shadow-[0_8px_30px_rgba(47,124,246,0.45)] ring-2 ring-white/20">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M11 5 6 9H2v6h4l5 4V5z" />
              <path d="M15.5 8.5a5 5 0 0 1 0 7" />
              <path d="M19 5.5a10 10 0 0 1 0 13" />
            </svg>
            {touch ? "Tap for sound" : "Click for sound"}
          </span>
        </button>
      )}
      {stalled && <p className="absolute bottom-3 left-3 rounded-md bg-room/85 px-2.5 py-1 text-sm text-muted">Reconnecting…</p>}
    </>
  );
}
