"use client";
// The room: one clock, derived from the server's instants plus the skew measured on mount, drives everything.
// Countdown until startsAt (only the countdown: no chat, no people), live until endsAt, then the end URL. Three
// shapes: phone upright (video on top, chat below), phone sideways and desktop (video left, chat right). Full
// screen: the real thing where the browser allows it, otherwise our own (the room fills the screen, chat hidden).
import { useEffect, useRef, useState } from "react";
import type { SimulatedRow } from "@/lib/chat";
import type { RoomProps } from "@/lib/room-props";
import { useClientValue } from "@/lib/use-client-value";
import { CtaBar } from "./CtaBar";
import { Panel } from "./Panel";
import { Removed } from "./Removed";
import { TopBar } from "./TopBar";
import { VideoStage } from "./VideoStage";

export function Room(p: RoomProps & { simulated: SimulatedRow[] }) {
  const skew = useRef(0);
  const [now, setNow] = useState(p.serverNow);
  const root = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement | null>(null);
  const [watching, setWatching] = useState(1 + p.simulatedNames.length);
  const [removed, setRemoved] = useState(false);
  const [ctaClosed, setCtaClosed] = useState(false);
  const [full, setFull] = useState(false);
  const nativeFull = useClientValue(() => Boolean(document.fullscreenEnabled), false);

  useEffect(() => {
    skew.current = p.serverNow - Date.now();
    const tick = () => setNow(Date.now() + skew.current);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [p.serverNow]);

  const live = now >= p.startsAt;
  const offset = live ? Math.floor((now - p.startsAt) / 1000) : 0;
  const ended = p.video.seconds > 0 && now >= p.endsAt;

  useEffect(() => {
    if (ended) window.location.assign(p.endUrl);
  }, [ended, p.endUrl]);

  const expected = () => (Date.now() + skew.current - p.startsAt) / 1000;

  // Presence: a beat on open, every 30 s while live, and on the way out. A 403 means they were removed.
  useEffect(() => {
    if (!live || p.preview) return;
    const body = (extra: object = {}) => JSON.stringify({ token: p.token, offset: Math.max(0, Math.floor(expected())), ...extra });
    const send = (b: string) =>
      fetch("/api/heartbeat", { method: "POST", headers: { "content-type": "application/json" }, body: b, keepalive: true })
        .then((r) => {
          if (r.status === 403) setRemoved(true);
        })
        .catch(() => {});
    send(body({ params: p.params }));
    const id = setInterval(() => send(body()), 30_000);
    const leave = () => {
      try {
        navigator.sendBeacon("/api/heartbeat", new Blob([body()], { type: "application/json" }));
      } catch {
        /* best-effort */
      }
    };
    window.addEventListener("pagehide", leave);
    return () => {
      clearInterval(id);
      window.removeEventListener("pagehide", leave);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, p.token, p.preview]);

  // Real full screen follows the browser's own exit (Escape); ours is a plain flag.
  useEffect(() => {
    if (!nativeFull) return;
    const onChange = () => setFull(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [nativeFull]);

  function toggleFull() {
    if (nativeFull) {
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
      else root.current?.requestFullscreen?.().catch(() => {});
      return;
    }
    setFull((f) => !f);
  }

  if (removed) return <Removed logoUrl={p.logoUrl} />;

  const showCta = Boolean(p.cta) && live && !ctaClosed && offset >= p.cta!.at && offset < p.cta!.hide;
  const ownFull = full && !nativeFull;
  const banner = (overlay: boolean) => p.cta && <CtaBar label={p.cta.label} href={p.cta.href} title={p.cta.title} subtitle={p.cta.subtitle} iconUrl={p.iconUrl} token={p.token} overlay={overlay} onDismiss={() => setCtaClosed(true)} />;

  return (
    <div ref={root} className={`flex h-dvh flex-col bg-room text-ink ${ownFull ? "fixed inset-0 z-50" : ""}`}>
      {!ownFull && <TopBar title={p.title} iconUrl={p.iconUrl} live={live} offset={offset} watching={watching} preview={p.preview} />}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row landscape-phone:flex-row">
        <div className={`relative flex w-full shrink-0 flex-col bg-black lg:min-h-0 lg:flex-1 landscape-phone:h-full landscape-phone:flex-1 ${ownFull ? "h-full flex-1" : ""}`}>
          <div className={`relative w-full lg:aspect-auto lg:min-h-0 lg:flex-1 landscape-phone:aspect-auto landscape-phone:flex-1 ${ownFull || !live ? "min-h-0 flex-1" : "aspect-video"}`}>
            {live ? <VideoStage token={p.token} available={p.video.available} expected={expected} videoRef={video} /> : <Countdown startsAt={p.startsAt} now={now} logoUrl={p.logoUrl} zones={p.zones} />}
            {live && (
              <button type="button" onClick={toggleFull} className="absolute bottom-2 right-2 z-10 grid h-10 w-10 place-items-center rounded-lg bg-black/55 text-white/90 hover:bg-black/75 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70" aria-label={full ? "Leave full screen" : "Full screen"}>
                {full ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M8 3v5H3M16 3v5h5M8 21v-5H3M16 21v-5h5" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M3 8V3h5M21 8V3h-5M3 16v5h5M21 16v5h-5" />
                  </svg>
                )}
              </button>
            )}
            {showCta && (
              <div className={`absolute inset-x-0 bottom-0 ${ownFull ? "block" : "hidden lg:block landscape-phone:block"}`}>{banner(true)}</div>
            )}
          </div>
          {showCta && !ownFull && <div className="lg:hidden landscape-phone:hidden">{banner(false)}</div>}
        </div>
        {live && !ownFull && <Panel token={p.token} registrantId={p.registrantId} firstName={p.firstName} hostName={p.hostName} simulatedNames={p.simulatedNames} simulated={p.simulated} live={live} expected={expected} onCount={setWatching} onRemoved={() => setRemoved(true)} />}
      </div>
    </div>
  );
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function countdownText(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s === 0) return "Starting now";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h >= 24) return `Starts in ${Math.floor(h / 24)} day${h >= 48 ? "s" : ""}`;
  return h > 0 ? `Starts in ${h}h ${pad(m)}m ${pad(sec)}s` : `Starts in ${m}m ${pad(sec)}s`;
}

function localStart(startsAt: number, now: number): string {
  const d = new Date(startsAt);
  const sameDay = d.toDateString() === new Date(now).toDateString();
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return sameDay ? `Today at ${time}, your local time` : `${d.toLocaleDateString([], { weekday: "long" })} at ${time}, your local time`;
}

function Countdown({ startsAt, now, logoUrl, zones }: { startsAt: number; now: number; logoUrl: string | null; zones: Array<[string, string]> }) {
  const local = useClientValue(() => localStart(startsAt, now), "");
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
      {logoUrl && <img src={logoUrl} alt="" className="mb-2 h-8 w-auto opacity-90 sm:h-10" />}
      <p className="text-4xl font-bold tabular-nums sm:text-5xl">{countdownText(startsAt - now)}</p>
      <p className="text-base text-muted">{local || " "}</p>
      <p className="max-w-xs text-sm text-muted">Keep this page open. The video and the chat start on their own.</p>
      <p className="text-xs text-muted/70">{zones.map(([z, t]) => `${t} ${z}`).join("  ·  ")}</p>
    </div>
  );
}
