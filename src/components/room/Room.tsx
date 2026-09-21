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
  const [chatHidden, setChatHidden] = useState(false);
  const [cc, setCc] = useState(false);
  const [card, setCard] = useState(false);
  const cardTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  function revealCard() {
    setCard(true);
    if (cardTimer.current) clearTimeout(cardTimer.current);
    cardTimer.current = setTimeout(() => setCard(false), 4000);
  }

  if (removed) return <Removed logoUrl={p.logoUrl} />;

  const showCta = Boolean(p.cta) && live && offset >= p.cta!.at && offset < p.cta!.hide;
  const ownFull = full && !nativeFull;
  void ownFull;
  const banner = (overlay: boolean) => p.cta && <CtaBar label={p.cta.label} href={p.cta.href} title={p.cta.title} subtitle={p.cta.subtitle} iconUrl={ctaClosed ? p.cta.stripIconUrl : p.cta.iconUrl} token={p.token} overlay={overlay} slim={ctaClosed} onDismiss={() => setCtaClosed(true)} />;

  return (
    <div ref={root} className={`flex h-dvh flex-col bg-room text-ink ${full && !nativeFull ? "fixed inset-0 z-50" : ""}`}>
      {!(full && !nativeFull) && <TopBar title={p.title} iconUrl={p.iconUrl} live={live} offset={offset} watching={watching} preview={p.preview} />}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row landscape-phone:flex-row">
        <div className={`relative flex w-full shrink-0 flex-col bg-black lg:min-h-0 lg:flex-1 landscape-phone:h-full landscape-phone:flex-1 ${!live || chatHidden ? "min-h-0 flex-1" : ""}`}>
          <div className={`relative w-full lg:aspect-auto lg:min-h-0 lg:flex-1 landscape-phone:aspect-auto landscape-phone:flex-1 ${!live || chatHidden ? "min-h-0 flex-1" : "aspect-video"}`} onClick={live ? revealCard : undefined}>
            {live ? <VideoStage token={p.token} available={p.video.available} expected={expected} videoRef={video} title={p.title} artwork={p.artworkUrl} captions={p.captions} cc={cc} poster={p.posterUrl} /> : <Countdown startsAt={p.startsAt} now={now} logoUrl={p.logoUrl} zones={p.zones} hostName={p.hostName} host={p.host} />}
            {live && card && (
              <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 bg-gradient-to-b from-black/80 to-transparent p-3 pb-10 text-white">
                <div className="flex min-w-0 items-center gap-2.5">
                  {p.host.avatarUrl ? <img src={p.host.avatarUrl} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-white/40" /> : null}
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-bold leading-tight">{p.title}</p>
                    <p className="truncate text-xs text-white/80">{p.hostName}{p.host.tagline ? `, ${p.host.tagline}` : ""}</p>
                    <p className="mt-0.5 text-xs text-white/80 tabular-nums">{watching} watching</p>
                  </div>
                </div>
                <div className="pointer-events-auto flex shrink-0 gap-2">
                {p.captions && (
                  <button type="button" onClick={(e) => { e.stopPropagation(); setCc((c) => !c); }} className={`inline-flex min-h-9 items-center rounded-lg px-3 text-sm font-bold ${cc ? "bg-white text-black" : "bg-black/55 text-white hover:bg-black/75"}`} aria-pressed={cc} aria-label={cc ? "Turn captions off" : "Turn captions on"}>
                    CC
                  </button>
                )}
                <button type="button" onClick={(e) => { e.stopPropagation(); setChatHidden((h) => !h); }} className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg bg-black/55 px-3 text-sm font-bold text-white hover:bg-black/75" aria-label={chatHidden ? "Show the chat" : "Hide the chat"}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                  {chatHidden ? "Show chat" : "Hide chat"}
                </button>
                </div>
              </div>
            )}
            {live && (
              <button type="button" onClick={(e) => { e.stopPropagation(); toggleFull(); }} className="absolute bottom-2 right-2 z-10 grid h-10 w-10 place-items-center rounded-lg bg-black/55 text-white/90 hover:bg-black/75 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70" aria-label={full ? "Leave full screen" : "Full screen"}>
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
              <div className={`absolute inset-x-0 bottom-0 ${chatHidden ? "block" : "hidden lg:block landscape-phone:block"}`}>{banner(true)}</div>
            )}
          </div>
          {showCta && !chatHidden && <div className="lg:hidden landscape-phone:hidden">{banner(false)}</div>}
        </div>
        {live && !chatHidden && <Panel token={p.token} registrantId={p.registrantId} firstName={p.firstName} hostName={p.hostName} simulatedNames={p.simulatedNames} simulated={p.simulated} live={live} expected={expected} onCount={setWatching} onRemoved={() => setRemoved(true)} />}
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

function Countdown({ startsAt, now, logoUrl, zones, hostName, host }: { startsAt: number; now: number; logoUrl: string | null; zones: Array<[string, string]>; hostName: string; host: { avatarUrl: string | null; tagline: string | null } }) {
  const local = useClientValue(() => localStart(startsAt, now), "");
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 overflow-y-auto px-6 py-8 text-center">
      {logoUrl && <img src={logoUrl} alt="" className="mb-1 h-8 w-auto opacity-90 sm:h-10" />}
      <p className="text-4xl font-bold tabular-nums sm:text-5xl">{countdownText(startsAt - now)}</p>
      <p className="text-base text-muted">{local || " "}</p>
      <div className="mt-2 flex items-center gap-3 rounded-2xl border border-line bg-panel/80 px-4 py-3 text-left">
        {host.avatarUrl ? <img src={host.avatarUrl} alt="" className="h-14 w-14 shrink-0 rounded-full object-cover" /> : <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-brand text-lg font-bold text-white">{hostName.split(" ").map((w) => w[0]).join("").slice(0, 2)}</span>}
        <div className="min-w-0">
          <p className="text-xs text-muted">Your host</p>
          <p className="text-base font-bold leading-tight">{hostName}</p>
          {host.tagline && <p className="text-sm text-muted">{host.tagline}</p>}
        </div>
      </div>
      <p className="max-w-xs text-sm text-muted">Keep this page open. The video and the chat start on their own.</p>
      <p className="text-xs text-muted/70">{zones.map(([z, t]) => `${t} ${z}`).join("  ·  ")}</p>
    </div>
  );
}
