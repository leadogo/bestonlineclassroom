"use client";
// The room: one clock, derived from the server's instants plus the skew measured on mount, drives everything.
// Countdown until startsAt, live until endsAt, then the end URL. The video, chat and people panel hang off it.
import { useEffect, useRef, useState } from "react";
import type { RoomProps } from "@/lib/room-props";
import { CtaBar } from "./CtaBar";
import { Panel } from "./Panel";
import { TopBar } from "./TopBar";
import { VideoStage } from "./VideoStage";

export function Room(p: RoomProps) {
  const skew = useRef(0);
  const [now, setNow] = useState(p.serverNow);
  const root = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);

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
    const beat = () => fetch("/api/heartbeat", { method: "POST", headers: { "content-type": "application/json" }, body: body(), keepalive: true }).catch(() => {});
    fetch("/api/heartbeat", { method: "POST", headers: { "content-type": "application/json" }, body: body({ params: p.params }), keepalive: true }).catch(() => {});
    const id = setInterval(beat, 30_000);
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
    const el = root.current;
    if (el?.requestFullscreen) el.requestFullscreen().catch(() => video.current?.requestFullscreen?.());
    else (video.current as unknown as { webkitEnterFullscreen?: () => void } | null)?.webkitEnterFullscreen?.();
  }

  const showCta = Boolean(p.cta) && live && offset >= p.cta!.at && offset < p.cta!.hide;

  return (
    <div ref={root} className="flex h-dvh flex-col bg-[#0b0f14] text-slate-100">
      <TopBar title={p.title} live={live} offset={offset} onFullscreen={fullscreen} preview={p.preview} />
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="relative aspect-video w-full shrink-0 bg-black lg:aspect-auto lg:min-h-0 lg:flex-1">
          {live ? <VideoStage src={p.video.url} expected={expected} videoRef={video} /> : <Countdown startsAt={p.startsAt} now={now} startLabel={p.startLabel} zones={p.zones} />}
          {showCta && p.cta && <CtaBar label={p.cta.label} href={p.cta.href} token={p.token} />}
        </div>
        <Panel token={p.token} firstName={p.firstName} hostName={p.hostName} simulatedNames={p.simulatedNames} live={live} offset={offset} sessionDate={p.sessionDate} />
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
  if (h >= 24) return `Starts in ${Math.floor(h / 24)}d ${h % 24}h`;
  return h > 0 ? `Starts in ${h}h ${pad(m)}m ${pad(sec)}s` : `Starts in ${m}m ${pad(sec)}s`;
}

function Countdown({ startsAt, now, startLabel, zones }: { startsAt: number; now: number; startLabel: string; zones: Array<[string, string]> }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-xs uppercase tracking-widest text-slate-400">The session starts soon</p>
      <p className="text-3xl font-semibold tabular-nums sm:text-4xl">{countdownText(startsAt - now)}</p>
      <p className="text-sm text-slate-300">{startLabel}</p>
      <p className="text-xs text-slate-500">{zones.map(([z, t]) => `${t} ${z}`).join(" · ")}</p>
      <p className="mt-4 max-w-sm text-xs text-slate-500">Keep this page open. The video starts by itself.</p>
    </div>
  );
}
