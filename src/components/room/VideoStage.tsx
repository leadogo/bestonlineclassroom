"use client";
// The recording, played as if live: opened at the expected offset, kept within 5 s of it, muted until the
// viewer taps for sound (mobile autoplay rules), no controls, no scrubbing, no clicks reaching the element.
// Leaving the page (another app, the lock screen) pauses it and clears the media session, so nothing on a lock
// screen can scrub; coming back seeks to the live minute and plays at once. The sound choice is remembered and
// tried silently first; the tap only shows when the browser blocks it.
import { useCallback, useEffect, useState, type MutableRefObject } from "react";
import { useClientValue } from "@/lib/use-client-value";

const DRIFT_SECONDS = 5;
const STALL_MS = 5000;
const SOUND_KEY = "bc_sound";

export function VideoStage({ token, available, expected, videoRef, title, artwork, captions, cc, poster }: { token: string; available: boolean; expected: () => number; videoRef: MutableRefObject<HTMLVideoElement | null>; title: string; artwork: string | null; captions: boolean; cc: boolean; poster: string | null }) {
  const [ready, setReady] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [sound, setSound] = useState(false);
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [stalled, setStalled] = useState(false);
  const touch = useClientValue(() => window.matchMedia("(pointer: coarse)").matches, false);

  // The address comes from a token-checked call after mount, never from the page source.
  useEffect(() => {
    if (!available) return;
    let stop = false;
    fetch(`/api/video?token=${encodeURIComponent(token)}`, { cache: "no-store" })
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
  }, [token, available]);

  // Attached once: React does not write the muted attribute, and the browser must see muted before it decides on
  // autoplay. A stable callback, so re-renders (the clock ticks every second) never touch the element again.
  const attach = useCallback(
    (el: HTMLVideoElement | null) => {
      if (el && videoRef.current !== el) {
        el.defaultMuted = true;
        el.muted = true;
        el.setAttribute("muted", "");
      }
      videoRef.current = el;
    },
    [videoRef],
  );

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !src) return;
    v.muted = true;
    v.src = src;
    let stallTimer: ReturnType<typeof setTimeout> | null = null;
    let wantSound = false;
    try {
      wantSound = localStorage.getItem(SOUND_KEY) === "1";
    } catch {
      /* private mode */
    }
    const seek = () => {
      const t = expected();
      if (Number.isFinite(v.duration) && t > v.duration) return;
      v.currentTime = Math.max(0, t);
    };
    // Sound first if they chose it before; if the browser refuses, muted, and the tap shows.
    // The phone may refuse to start any video without a tap (Low Power Mode, some Safari settings): then say so.
    const mutedPlay = () =>
      v.play()
        .then(() => setBlocked(false))
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "NotAllowedError") setBlocked(true);
        });
    const tryPlay = () => {
      if (wantSound && v.muted) {
        v.muted = false;
        v.play()
          .then(() => setSound(true))
          .catch(() => {
            v.muted = true;
            mutedPlay();
          });
        return;
      }
      mutedPlay();
    };
    const sync = () => {
      seek();
      tryPlay();
    };
    const onWaiting = () => {
      if (stallTimer) clearTimeout(stallTimer);
      stallTimer = setTimeout(() => {
        if (!v.paused && !document.hidden) setStalled(true);
      }, STALL_MS);
    };
    const onPlaying = () => {
      if (stallTimer) clearTimeout(stallTimer);
      stallTimer = null;
      setStalled(false);
      if (v.currentTime > 0) setReady(true);
    };
    // The lock screen and control centre show our name and picture, never the file host's.
    try {
      const art = artwork ? [{ src: new URL(artwork, location.href).toString(), sizes: "512x512", type: "image/png" }] : [];
      navigator.mediaSession.metadata = new MediaMetadata({ title, artist: "Live session", artwork: art });
    } catch {
      /* unsupported */
    }
    const onTime = () => {
      if (!v.paused) onPlaying();
    };
    // Away: pause and drop the media session so the lock screen shows no player. Back: the live minute, now.
    const onVisibility = () => {
      if (document.hidden) {
        v.pause();
        setStalled(false);
      } else sync();
    };
    // Nothing on a lock screen or in a headset can scrub: every request lands back on the live minute.
    try {
      const ms = navigator.mediaSession;
      for (const a of ["play", "pause", "seekbackward", "seekforward", "seekto", "previoustrack", "nexttrack", "stop"] as MediaSessionAction[]) {
        try {
          ms.setActionHandler(a, () => sync());
        } catch {
          /* unsupported action */
        }
      }
    } catch {
      /* unsupported */
    }
    v.addEventListener("loadedmetadata", sync);
    v.addEventListener("canplay", tryPlay);
    v.addEventListener("waiting", onWaiting);
    v.addEventListener("stalled", onWaiting);
    v.addEventListener("playing", onPlaying);
    v.addEventListener("timeupdate", onTime);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", sync);
    window.addEventListener("focus", sync);
    if (v.readyState >= 1) sync();
    const drift = setInterval(() => {
      if (document.hidden) return;
      if (v.paused && !v.ended) tryPlay();
      if (Math.abs(v.currentTime - expected()) > DRIFT_SECONDS) seek();
    }, 10_000);
    return () => {
      clearInterval(drift);
      if (stallTimer) clearTimeout(stallTimer);
      v.removeEventListener("loadedmetadata", sync);
      v.removeEventListener("canplay", tryPlay);
      v.removeEventListener("waiting", onWaiting);
      v.removeEventListener("stalled", onWaiting);
      v.removeEventListener("playing", onPlaying);
      v.removeEventListener("timeupdate", onTime);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", sync);
      window.removeEventListener("focus", sync);
    };
    // expected is stable for the life of the room
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, title, artwork]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    for (const t of Array.from(v.textTracks)) t.mode = cc ? "showing" : "hidden";
  }, [cc, videoRef, src]);

  function unmute() {
    const v = videoRef.current;
    if (!v) return;
    v.muted = false;
    v.volume = 1;
    v.currentTime = Math.max(0, expected());
    v.play().catch(() => {});
    setSound(true);
    setBlocked(false);
    try {
      localStorage.setItem(SOUND_KEY, "1");
    } catch {
      /* private mode */
    }
  }

  if (!available || failed) {
    return <div className="absolute inset-0 flex items-center justify-center text-base text-muted">{failed ? "The video could not load. Refresh the page." : "The video is not available yet."}</div>;
  }
  if (!src) return null;

  return (
    <>
      <video ref={attach} className="pointer-events-none absolute inset-0 h-full w-full object-contain" playsInline autoPlay muted preload="auto" poster={poster ?? undefined} tabIndex={-1} disablePictureInPicture disableRemotePlayback>
        {captions && <track kind="subtitles" srcLang="en" label="English" src={`/api/captions?token=${encodeURIComponent(token)}`} default={cc} />}
      </video>
      {!ready && !blocked && (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 flex items-center justify-center gap-2 text-sm text-white/80" aria-live="polite">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden />
          Connecting to the session…
        </div>
      )}
      {!sound && (
        <button type="button" onClick={unmute} className="absolute inset-0 flex items-center justify-center bg-black/35 focus:outline-none" aria-label={touch ? "Tap for sound" : "Click for sound"}>
          <span className="inline-flex items-center gap-3 rounded-full bg-brand px-6 py-3.5 text-lg font-bold text-white shadow-[0_8px_30px_rgba(47,124,246,0.45)] ring-2 ring-white/20">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M11 5 6 9H2v6h4l5 4V5z" />
              <path d="M15.5 8.5a5 5 0 0 1 0 7" />
              <path d="M19 5.5a10 10 0 0 1 0 13" />
            </svg>
            {blocked ? "Tap to start" : touch ? "Tap for sound" : "Click for sound"}
          </span>
        </button>
      )}
      {stalled && <p className="absolute bottom-3 left-3 rounded-md bg-room/85 px-2.5 py-1 text-sm text-muted">Reconnecting…</p>}
    </>
  );
}
