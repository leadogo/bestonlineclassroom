"use client";
// The room: one clock, derived from the server's instants plus the skew measured on mount, drives everything.
// Countdown until startsAt, live until endsAt, then the end URL. Three shapes: phone upright (video on top,
// chat below), phone sideways and desktop (video left, chat right).
import { useEffect, useRef, useState } from "react";
import type { SimulatedRow } from "@/lib/chat";
import type { RoomProps } from "@/lib/room-props";
import { useClientValue } from "@/lib/use-client-value";
import { CtaBar } from "./CtaBar";
import { Panel } from "./Panel";
import { TopBar } from "./TopBar";
import { VideoStage } from "./VideoStage";

export function Room(p: RoomProps & { simulated: SimulatedRow[] }) {
  const skew = useRef(0);
  const [now, setNow] = useState(p.serverNow);
  const root = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement | null>(null);
  const [watching, setWatching] = useState(1 + p.simulatedNames.length);

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

  // Presence: a beat on open, every 30 s while live, and on the way out. Never blocks anything.
  useEffect(() => {
    if (!live || p.preview) return;
    const body = (extra: object = {}) => JSON.stringify({ token: p.token, offset: Math.max(0, Math.floor(expected())), ...extra });
    const send = (b: string) => fetch("/api/heartbeat", { method: "POST", headers: { "content-type": "application/json" }, body: b, keepalive: true }).catch(() => {});
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

  function fullscreen() {
    root.current?.requestFullscreen?.().catch(() => {});
  }

  const showCta = Boolean(p.cta) && live && offset >= p.cta!.at && offset < p.cta!.hide;

  return (
    <div ref={root} className="flex h-dvh flex-col bg-room text-ink">
      <TopBar title={p.title} iconUrl={p.iconUrl} live={live} offset={offset} watching={watching} onFullscreen={fullscreen} preview={p.preview} />
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row landscape-phone:flex-row">
        <div className="relative flex w-full shrink-0 flex-col bg-black lg:min-h-0 lg:flex-1 landscape-phone:h-full landscape-phone:flex-1">
          <div className="relative aspect-video w-full lg:aspect-auto lg:min-h-0 lg:flex-1 landscape-phone:aspect-auto landscape-phone:flex-1">
            {live ? <VideoStage src={p.video.url} expected={expected} videoRef={video} /> : <Countdown startsAt={p.startsAt} now={now} logoUrl={p.logoUrl} zones={p.zones} />}
            {showCta && p.cta && (
              <div className="absolute inset-x-0 bottom-0 hidden lg:block landscape-phone:block">
                <CtaBar label={p.cta.label} href={p.cta.href} token={p.token} overlay />
              </div>
            )}
          </div>
          {showCta && p.cta && (
            <div className="lg:hidden landscape-phone:hidden">
              <CtaBar label={p.cta.label} href={p.cta.href} token={p.token} />
            </div>
          )}
        </div>
        <Panel token={p.token} firstName={p.firstName} hostName={p.hostName} simulatedNames={p.simulatedNames} simulated={p.simulated} live={live} expected={expected} onCount={setWatching} />
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
      <p className="text-base text-muted">{local || " "}</p>
      <p className="max-w-xs text-sm text-muted">Keep this page open. The video starts on its own.</p>
      <p className="text-xs text-muted/70">{zones.map(([z, t]) => `${t} ${z}`).join("  ·  ")}</p>
    </div>
  );
}
