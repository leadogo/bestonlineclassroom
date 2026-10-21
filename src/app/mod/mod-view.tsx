"use client";
// The moderator desk (SPEC-phase5.md, mod-desk): the real stream with reply, react, delete, ghost and block; the
// crowd alongside (capped separately, real rows never trimmed); a video monitor on the room's clock; who else is on
// the desk and what they are doing; and beside the chat the People, Team (private), Engagement and Stats tabs.
// On a phone the tabs run across the top with Chat first.
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { signOut } from "../login/actions";
import { KAITLYN, mergeUpdates, simulatedCursor, splitBody, trimCrowd, type ChatItem, type ChatUpdate, type KaitlynMode, type SimulatedRow } from "@/lib/chat";
import { EMOJIS, GHOST_REASONS, SKIP_REASONS } from "@/lib/moderation";
import { Avatar } from "@/components/room/PeoplePanel";
import { rankEngagement } from "@/lib/engagement";
import { asksMarket, findMarkets, findStates, marketDraft, NO_MATCH_DRAFT, onlyStates, placeOf, rollup, rollupDraft, type MarketCount } from "@/lib/market-answer";

type Wire = { id: number; registrant_id: string | null; author_name: string; role: "attendee" | "moderator"; body: string; offset_seconds: number; reactions: Record<string, number>; deleted_at: string | null; created_at: string; visibility: "all" | "author" | "team"; mentions: string[]; mention_names?: string[]; belief?: boolean; is_question?: boolean; kind?: string; visible_to?: string | null };
type Person = { first_name: string; last_seen_at: string; joined_at: string; source: string; registrant_id: string; in_room: boolean; /** two minutes, a click or a chat line (SPEC-link-opens.md); absent on an older desk payload */ person?: boolean; minutes: number; clicked_offer: boolean; at_pitch: boolean; ghosted: boolean; has_ip: boolean; ip_blocked: boolean; email_masked: string; booking_href?: string | null; prior_sessions?: number; auto_ghost_reason?: string | null; hot?: boolean; ultra_hot?: boolean; training_minutes?: number };
type Desk = { member_id: string; name: string; tab: string | null; replying_to: string | null; last_seen_at: string };
type Stats = { registered: number; moved_in?: number; joined: number; visits?: number; in_room: number; arriving?: number; peak: number; pitch_at: number | null; at_pitch: number | null; clicked: number; stayed_15: number; booked: number };
type HistoryRow = { date: string; weekday: number; at_pitch: number; booked: number; curve?: number[] };
type Mentionable = { id: string; name: string; sub?: string };
/** One of Kaitlyn's open suggestions (kaitlyn_decisions, status pending): a draft to send, a ghost or a reaction to approve, or a line she wants a human on. */
type KPending = { id: number; message_id: number; registrant_id: string; action: "reply" | "skip" | "ghost" | "ask_william"; category: string; text: string; react: string; why: string; /** What William was saying on screen when they typed (the last 20 s), when the event has a transcript. */ screen?: string | null };
type KDecision = "send" | "skip" | "ghost" | "react";
/** A run of three or more of Kaitlyn's posted lines in a row, folded on the desk (SPEC-kaitlyn-solo.md, H). */
type Run = { key: string; n: number; names: string[]; first: number; last: number };
type Item = ChatItem & { registrantId?: string | null; deleted?: boolean; ghost?: boolean; mentionsMe?: boolean; team?: boolean; belief?: boolean; question?: boolean; ghostReply?: boolean };
type Tab = "chat" | "people" | "team" | "engagement" | "stats";

const SIDE_TABS: Array<[Exclude<Tab, "chat">, string]> = [["people", "Attendees"], ["team", "Mod Chat"], ["engagement", "Engagement"], ["stats", "Stats"]];
const SHORT: Record<string, string> = { "Mod Chat": "Mods", Engagement: "Engage" };
const clock = (iso: string | number) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const mmss = (s: number) => { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h ? `${h}:${String(m).padStart(2, "0")}` : `${m} min`; };

export function ModView({ member, event, session, serverNow, backHref, isAdmin = false }: { member: { id: string; display_name: string; email: string }; event: { slug: string; title: string; iconUrl: string | null; hostName: string; videoUrl: string | null; ctaAt: number | null; katherine: boolean; kaitlyn: KaitlynMode; autopilot?: "auto" | "on" | "off" }; session: { date: string; startsAt: number; endsAt: number }; serverNow: number; backHref: string; isAdmin?: boolean }) {
  const skew = useRef(0);
  const router = useRouter();
  const [list, setList] = useState<Item[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [desk, setDesk] = useState<Desk[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [showSim, setShowSim] = useState(true);
  const [team, setTeam] = useState<Mentionable[]>([]);
  const [picked, setPicked] = useState<Mentionable[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [markets, setMarkets] = useState<MarketCount[]>([]);
  const [kaitlyn, setKaitlyn] = useState<KPending[]>([]);
  const [autopilot, setAutopilot] = useState<"auto" | "on" | "off">(event.autopilot ?? "auto");
  const [fixing, setFixing] = useState<number | null>(null);
  // Runs of her posted lines the desk tapped open (SPEC-kaitlyn-solo.md, H), by the first row's key.
  const [openRuns, setOpenRuns] = useState<Set<string>>(() => new Set());
  const [teach, setTeach] = useState("");
  const [taught, setTaught] = useState("");
  const [teamText, setTeamText] = useState("");
  const [error, setError] = useState("");
  const [confirmBlock, setConfirmBlock] = useState<string | null>(null);
  // The Ghost button opens the reason chips (SPEC-kaitlyn-ghosts.md, B4); `mid` is set when the ghost comes from a message row.
  const [confirmGhost, setConfirmGhost] = useState<{ rid: string; mid?: number } | null>(null);
  const [onlyMentions, setOnlyMentions] = useState(false);
  const [edge, setEdge] = useState(true);
  const [bookingHref, setBookingHref] = useState<string | null>(null);
  const [name, setName] = useState(member.display_name);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(member.display_name);
  const [mine, setMine] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(serverNow);
  const [tab, setTab] = useState<Tab>("chat");
  const [sideTab, setSideTab] = useState<Exclude<Tab, "chat">>("people");
  const [teamUnread, setTeamUnread] = useState(0);
  const [history, setHistory] = useState<HistoryRow[] | null>(null);
  const [monitorOpen, setMonitorOpen] = useState(true);
  const cursor = useRef({ after: 0, since: "" });
  const sim = useRef<{ rows: SimulatedRow[]; next: number }>({ rows: [], next: 0 });
  const scroller = useRef<HTMLDivElement>(null);
  const teamScroller = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  const atBottomRef = useRef(true);
  const [pending, setPending] = useState(0);
  const presence = useRef({ tab: "chat", to: "" });
  const teamOpenRef = useRef(false);
  const offset = useCallback(() => (Date.now() + skew.current - session.startsAt) / 1000, [session.startsAt]);
  const offsetNow = (now - session.startsAt) / 1000;
  const live = now >= session.startsAt && now < session.endsAt;

  useEffect(() => {
    fetch(`/api/mod/history?event=${event.slug}&today=${session.date}`, { cache: "no-store" }).then((r) => r.json()).then((j: { sessions?: HistoryRow[] }) => setHistory(j.sessions ?? [])).catch(() => setHistory([]));
  }, [event.slug, session.date]);

  useEffect(() => {
    skew.current = serverNow - Date.now();
    const id = setInterval(() => setNow(Date.now() + skew.current), 1000);
    return () => clearInterval(id);
  }, [serverNow]);

  // What this moderator is doing, for the presence strip on everyone's desk (read by the poll through refs).
  const teamOpen = tab === "team" || (tab === "chat" && sideTab === "team");
  useEffect(() => {
    teamOpenRef.current = teamOpen;
    presence.current = { tab: tab === "chat" ? sideTab : tab, to: picked.find((p) => !p.id.startsWith("m:") && text.includes(`@${p.name}`))?.name ?? "" };
  }, [teamOpen, tab, sideTab, picked, text]);

  useEffect(() => {
    let stop = false;
    let t: ReturnType<typeof setTimeout> | null = null;
    const poll = async () => {
      if (stop) return;
      try {
        const q = new URLSearchParams({ event: event.slug, date: session.date, after: String(cursor.current.after), since: cursor.current.since, tab: presence.current.tab, to: presence.current.to });
        const res = await fetch(`/api/mod?${q}`, { cache: "no-store" });
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        const j = (await res.json()) as { new: Wire[]; updated: ChatUpdate[]; people: Person[]; team?: Mentionable[]; desk?: Desk[]; stats?: Stats; now: string; edge?: boolean; session_start?: number; session_date?: string; booking_href?: string | null; kaitlyn?: { mode: string; pending: KPending[]; autopilot?: "auto" | "on" | "off" } };
        // The session moved (a restart, or the day turned): start over with the right clock.
        if (j.session_start && j.session_start !== session.startsAt && j.session_date === session.date) {
          window.location.reload();
          return;
        }
        const fresh: Item[] = j.new.map((m) => ({ key: `r${m.id}`, id: m.id, registrantId: m.registrant_id, name: m.author_name, role: m.role, body: m.body, at: new Date(m.created_at).getTime(), reactions: m.reactions ?? {}, deleted: Boolean(m.deleted_at), ghost: m.visibility === "author", team: m.visibility === "team", belief: Boolean(m.belief), question: Boolean(m.is_question), kind: m.kind, ghostReply: Boolean(m.visible_to), mentionNames: m.mention_names ?? [], mentionsMe: (m.mentions ?? []).includes(`m:${member.id}`) }));
        setEdge(j.edge !== false);
        setBookingHref(j.booking_href ?? null);
        if (fresh.length) cursor.current.after = fresh[fresh.length - 1].id!;
        cursor.current.since = j.now;
        const chatFresh = fresh.filter((f) => !f.team);
        const teamFresh = fresh.filter((f) => f.team && f.name !== name);
        if (chatFresh.length && !atBottomRef.current) setPending((n) => n + chatFresh.length);
        if (teamFresh.length && !teamOpenRef.current) setTeamUnread((n) => n + teamFresh.length);
        // Real rows are never trimmed (the moderator needs them all); only the crowd is capped, see trimCrowd.
        setList((l) => trimCrowd([...mergeUpdates(l, j.updated).map((x) => (j.updated.find((u) => u.id === x.id)?.deleted ? { ...x, deleted: true } : x)), ...fresh.filter((f) => !l.some((x) => x.id === f.id))], 300) as Item[]);
        setPeople(j.people);
        if (j.team) setTeam(j.team);
        if (j.desk) setDesk(j.desk);
        if (j.stats) setStats(j.stats);
        if (j.kaitlyn) { setKaitlyn(j.kaitlyn.pending); if (j.kaitlyn.autopilot) setAutopilot(j.kaitlyn.autopilot); }
      } catch {
        /* next poll */
      }
      t = setTimeout(poll, 3000);
    };
    poll();
    return () => {
      stop = true;
      if (t) clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.slug, session.date, session.startsAt, router, member.id]);

  useEffect(() => {
    if (!showSim) return;
    fetch(`/api/simulated?event=${event.slug}`)
      .then((r) => r.json())
      .then((j: { rows?: SimulatedRow[] }) => {
        sim.current = { rows: j.rows ?? [], next: 0 };
      })
      .catch(() => {});
    const id = setInterval(() => {
      const { items, nextIndex } = simulatedCursor(sim.current.rows, offset(), sim.current.next);
      if (!items.length) return;
      sim.current.next = nextIndex;
      if (!atBottomRef.current) setPending((c) => c + items.length);
      const n = Date.now();
      setList((l) => trimCrowd([...l, ...items.map((r, i) => ({ key: `s${nextIndex}-${i}`, name: r.name, role: "simulated" as const, body: r.body, at: n - (offset() - r.offset_seconds) * 1000, reactions: {} }))], 300) as Item[]);
    }, 1000);
    return () => clearInterval(id);
  }, [showSim, event.slug, offset]);

  useEffect(() => {
    const el = scroller.current;
    if (el && atBottomRef.current) el.scrollTop = el.scrollHeight;
    const tl = teamScroller.current;
    if (tl) tl.scrollTop = tl.scrollHeight;
  }, [list]);
  function onScroll() {
    const el = scroller.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    atBottomRef.current = near;
    setAtBottom(near);
    if (near) setPending(0);
  }

  async function act(body: object): Promise<boolean> {
    const res = await fetch("/api/mod", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ event: event.slug, date: session.date, ...body }) });
    const j = (await res.json().catch(() => ({}))) as { error?: string; reactions?: Record<string, number>; on?: boolean };
    if (!res.ok) {
      setError(j.error ?? "That didn't work.");
      return false;
    }
    setError("");
    const b = body as { action?: string; id?: number; emoji?: string };
    if (b.action === "react" && j.reactions && b.id) {
      const key = `${b.id}:${b.emoji}`;
      setMine((s) => { const n = new Set(s); if (j.on) n.add(key); else n.delete(key); return n; });
      setList((l) => l.map((m) => (m.id === b.id ? { ...m, reactions: j.reactions! } : m)));
    }
    return true;
  }
  const person = (rid?: string | null) => people.find((p) => p.registrant_id === rid);
  /** Not seen in the room for two minutes (William, Oct 15: grey the name and say "left"). */
  const gone = (m: { role: string; registrantId?: string | null }) => m.role === "attendee" && person(m.registrantId)?.in_room === false;

  // A sent message shows here at once; the poll would otherwise take up to three seconds to bring it back.
  async function send(body: string, extra: object): Promise<boolean> {
    const res = await fetch("/api/mod", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ event: event.slug, date: session.date, action: "reply", body, ...extra }) });
    const j = (await res.json().catch(() => ({}))) as { error?: string; message?: Wire };
    if (!res.ok || !j.message) {
      setError(j.error ?? "That didn't work.");
      return false;
    }
    setError("");
    const m = j.message;
    setList((l) => (l.some((x) => x.id === m.id) ? l : trimCrowd([...l, { key: `r${m.id}`, id: m.id, registrantId: null, name: m.author_name, role: "moderator" as const, body: m.body, at: Date.now(), reactions: {}, mentionNames: m.mention_names ?? [], team: m.visibility === "team" }], 300) as Item[]));
    return true;
  }
  // Acting on one of Kaitlyn's suggestions: the row leaves the desk at once and her reply (if any) shows as hers.
  async function kaitlynAct(k: KPending, decision: KDecision, body?: string, reason?: string): Promise<boolean> {
    const res = await fetch("/api/mod", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ event: event.slug, date: session.date, action: "kaitlyn", id: k.id, decision, body, reason }) });
    const j = (await res.json().catch(() => ({}))) as { error?: string; message?: Wire | null };
    if (!res.ok) {
      setError(j.error ?? "That didn't work.");
      return false;
    }
    setError("");
    if (decision === "react") setKaitlyn((l) => (k.action === "skip" ? l.filter((x) => x.id !== k.id) : l.map((x) => (x.id === k.id ? { ...x, react: "" } : x))));
    else setKaitlyn((l) => l.filter((x) => x.id !== k.id));
    if (decision === "ghost") setPeople((p) => p.map((x) => (x.registrant_id === k.registrant_id ? { ...x, ghosted: true } : x)));
    const m = j.message;
    if (m) setList((l) => (l.some((x) => x.id === m.id) ? l : trimCrowd([...l, { key: `r${m.id}`, id: m.id, registrantId: null, name: m.author_name, role: "moderator" as const, body: m.body, at: Date.now(), reactions: {}, mentionNames: m.mention_names ?? [], kind: m.kind }], 300) as Item[]));
    return true;
  }
  // Fixing one of Kaitlyn's lines (William, Oct 18): hers reads as deleted at once and his replacement shows as hers.
  async function fix(m: Item, body: string): Promise<boolean> {
    const res = await fetch("/api/mod", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ event: event.slug, date: session.date, action: "fix", id: m.id, body }) });
    const j = (await res.json().catch(() => ({}))) as { error?: string; message?: Wire | null };
    if (!res.ok) {
      setError(j.error ?? "That didn't work.");
      return false;
    }
    setError("");
    setFixing(null);
    const n = j.message;
    setList((l) => {
      const gone = l.map((x) => (x.id === m.id ? { ...x, deleted: true } : x));
      return n && !gone.some((x) => x.id === n.id) ? (trimCrowd([...gone, { key: `r${n.id}`, id: n.id, registrantId: null, name: n.author_name, role: "moderator" as const, body: n.body, at: Date.now(), reactions: {}, mentionNames: n.mention_names ?? [], kind: n.kind }], 300) as Item[]) : gone;
    });
    return true;
  }
  async function reply(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    const mentions = picked.filter((p) => body.includes(`@${p.name}`)).map((p) => p.id);
    atBottomRef.current = true;
    setAtBottom(true);
    if (await send(body, { mentions })) {
      setText("");
      setPicked([]);
    }
  }
  async function sendTeam(e: React.FormEvent) {
    e.preventDefault();
    const body = teamText.trim();
    if (!body) return;
    if (await send(body, { team: true })) setTeamText("");
  }
  // Showing or hiding the crowd, or the mentions filter, lands you at the newest messages, never the top.
  function toBottomSoon() {
    atBottomRef.current = true;
    setAtBottom(true);
    setPending(0);
    requestAnimationFrame(() => { const el = scroller.current; if (el) el.scrollTop = el.scrollHeight; });
  }
  async function saveName() {
    const n = nameDraft.trim().replace(/\s+/g, " ");
    if (!n || n === name) { setEditingName(false); return; }
    if (await act({ action: "rename", name: n })) {
      const old = name;
      setName(n);
      setList((l) => l.map((x) => (x.role === "moderator" && x.name === old ? { ...x, name: n } : x)));
      setEditingName(false);
    }
  }
  // The booking link, with the one @mentioned person's first name and id when there is exactly one, so their form greets them.
  function insertBookingLink() {
    const one = picked.filter((p) => !p.id.startsWith("m:") && text.includes(`@${p.name}`));
    const href = (one.length === 1 ? people.find((x) => x.registrant_id === one[0].id)?.booking_href : null) ?? bookingHref;
    if (!href) return;
    setText((t) => `${t && !/\s$/.test(t) ? `${t} ` : t}${href} `.slice(0, 500));
    input.current?.focus();
  }
  // "@" at the caret offers everyone in the room and the team (yourself included); refines as you type.
  const atWord = /(?:^|\s)@([^@\s]*)$/.exec(text);
  const options: Mentionable[] = atWord
    ? [...people.filter((p) => p.in_room && p.person !== false).map((p) => ({ id: p.registrant_id, name: p.first_name, sub: p.email_masked })), ...team].filter((p) => p.name.toLowerCase().startsWith(atWord[1].toLowerCase())).slice(0, 8)
    : [];
  function pick(p: Mentionable) {
    setText(text.replace(/@[^@\s]*$/, `@${p.name} `));
    setPicked((l) => (l.some((x) => x.id === p.id) ? l : [...l, p]));
    input.current?.focus();
  }
  // Reply puts "@Name " in the box with the mention attached (the room has the same on tap); the Answer chip adds
  // Kevin's line for the market they named. Nothing sends until the moderator does.
  function replyTo(m: Item, draft = "") {
    setText((t) => `${t.trim() ? `${t.trimEnd()} ` : ""}@${m.name} ${draft}`.slice(0, 500));
    if (m.registrantId) setPicked((l) => (l.some((x) => x.id === m.registrantId) ? l : [...l, { id: m.registrantId!, name: m.name }]));
    input.current?.focus();
  }
  // The directory's count per market, once per desk visit (the sync refreshes it every 30 minutes).
  useEffect(() => {
    fetch("/api/mod/markets").then((r) => (r.ok ? r.json() : null)).then((j: { markets?: MarketCount[] } | null) => { if (j?.markets) setMarkets(j.markets); }).catch(() => {});
  }, []);
  // Answer chips only once the pitch has started: before it the room is saying where it is from, not asking.
  const pitchMs = event.ctaAt !== null ? session.startsAt + event.ctaAt * 1000 : null;

  const chat = list.filter((m) => !m.team);
  const teamMsgs = list.filter((m) => m.team && !m.deleted);
  const shown = chat.filter((m) => (m.role !== "simulated" || showSim) && (!onlyMentions || m.mentionsMe));
  const { runs, hiddenRows } = foldRuns(shown, openRuns, fixing);
  const inRoom = people.filter((p) => p.in_room && p.person !== false && p.source !== "test");
  const msgCount = new Map<string, number>();
  const beliefCount = new Map<string, number>();
  for (const m of chat) if (m.role === "attendee" && m.registrantId && !m.deleted) { msgCount.set(m.registrantId, (msgCount.get(m.registrantId) ?? 0) + 1); if (m.belief) beliefCount.set(m.registrantId, (beliefCount.get(m.registrantId) ?? 0) + 1); }
  const messages = chat.filter((m) => m.role === "attendee" && !m.deleted).length;

  const panes = (which: Exclude<Tab, "chat">) =>
    which === "people" ? <PeoplePane people={people} msgCount={msgCount} confirmBlock={confirmBlock} setConfirmBlock={setConfirmBlock} confirmGhost={confirmGhost} setConfirmGhost={setConfirmGhost} act={act} edge={edge} />
    : which === "team" ? <TeamPane msgs={teamMsgs} me={name} text={teamText} setText={setTeamText} onSend={sendTeam} scroller={teamScroller} />
    : which === "engagement" ? <EngagementPane people={people} msgCount={msgCount} beliefCount={beliefCount} pitchMinutes={event.ctaAt !== null ? event.ctaAt / 60 : 75} />
    : <StatsPane stats={stats} chatters={msgCount.size} messages={messages} now={now} ctaAt={event.ctaAt} startsAt={session.startsAt} history={history} live={live} />;

  const tabButton = (key: Tab, label: string, active: boolean, onClick: () => void) => (
    <button key={key} type="button" onClick={() => { onClick(); if (key === "team") setTeamUnread(0); }} className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 px-2 text-[15px] ${active ? "border-b-2 border-brand font-bold text-ink" : "text-muted hover:text-ink"} focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand`}>
      {label}
      {key === "people" && <span className="rounded-full bg-panel px-2 py-0.5 text-xs text-muted tabular-nums">{inRoom.length}</span>}
      {key === "team" && teamUnread > 0 && <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-bold text-white tabular-nums">{teamUnread}</span>}
    </button>
  );

  return (
    <div className="relative flex h-dvh flex-col bg-room text-ink">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-4 py-2" style={{ paddingTop: "calc(0.5rem + env(safe-area-inset-top, 0px))" }}>
        <a href={backHref} className="flex min-h-9 items-center gap-1 rounded-md px-2 text-sm text-muted hover:bg-panel hover:text-ink" aria-label="Back to the admin">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 6l-6 6 6 6" />
          </svg>
          Admin
        </a>
        {event.iconUrl && <img src={event.iconUrl} alt="" className="h-9 w-9" />}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-bold">{event.title}</h1>
          <p className="text-sm text-muted">
            {session.date}, {live ? `live, ${mmss(Math.max(0, Math.floor(offsetNow)))} in, ` : now < session.startsAt ? "not started. " : "ended. "}{live && <span className="font-bold text-emerald-400 tabular-nums">{inRoom.length} in the room</span>}{live && stats && stats.at_pitch !== null && <span className="text-muted"> · at the pitch <span className="font-bold text-ink tabular-nums">{stats.at_pitch}</span></span>}{live && ". "}Replying as{" "}
            {editingName ? (
              <span className="inline-flex items-center gap-1 align-middle">
                <input value={nameDraft} onChange={(e) => setNameDraft(e.target.value.slice(0, 40))} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveName(); } if (e.key === "Escape") setEditingName(false); }} autoFocus aria-label="Your display name" className="h-7 w-44 rounded-md border border-line bg-panel px-2 text-sm text-ink focus:border-brand focus:outline-none" />
                <button type="button" onClick={saveName} className="h-7 rounded-md bg-brand px-2 text-xs font-bold text-white">Save</button>
                <button type="button" onClick={() => setEditingName(false)} className="h-7 px-1 text-xs text-muted hover:text-ink">Cancel</button>
              </span>
            ) : (
              <>
                <span className="text-ink">{name}</span>
                <button type="button" onClick={() => { setNameDraft(name); setEditingName(true); }} className="ml-1 inline-grid h-7 w-7 place-items-center rounded-md align-middle text-brand hover:bg-panel" aria-label="Change your display name" title="Change your display name. Every message you have sent updates too.">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                </button>
              </>
            )}
          </p>
        </div>
        <a href={`/admin/blocked?event=${event.slug}`} className="rounded-md border border-line px-3 py-1.5 text-sm text-muted hover:text-ink">
          Blocked
        </a>
        <form action={signOut}>
          <button type="submit" className="rounded-md border border-line px-3 py-1.5 text-sm text-muted hover:text-ink">
            Sign out
          </button>
        </form>
      </header>

      {(desk.length > 0 || event.katherine || event.kaitlyn !== "off") && (
        <div className="flex items-center gap-2 overflow-x-auto border-b border-line px-4 py-1.5 text-[13px] text-muted">
          <span className="shrink-0">On the desk:</span>
          {event.kaitlyn !== "off" && (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-dashed border-cta/60 py-0.5 pl-1 pr-2.5 text-ink" title="The AI moderator. Her suggestions show under the message they answer.">
              <Avatar name={KAITLYN} size="h-5 w-5 text-[9px]" />
              Kaitlyn<span className="text-muted">{event.kaitlyn === "shadow" ? "shadow · drafts for you" : event.kaitlyn === "assisted" ? "assisted · routine replies post themselves" : "auto · replies post themselves"}{` · autopilot ${autopilot === "auto" ? "armed, 3 min after the last moderator leaves" : autopilot === "on" ? "on, answering on her own" : "off"}`}{kaitlyn.length ? ` · ${kaitlyn.length} waiting` : ""}</span>
            </span>
          )}
          {event.katherine && (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-dashed border-cta/60 py-0.5 pl-1 pr-2.5 text-ink" title="Answers the replay question once per person">
              <Avatar name="Katherine AI" size="h-5 w-5 text-[9px]" />
              Katherine AI<span className="text-muted">auto · replay questions</span>
            </span>
          )}
          {isAdmin && event.kaitlyn !== "off" && (
            <>
              <label className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-panel py-0.5 pl-2.5 pr-1 text-ink" title="Autopilot: auto takes over when the desk has been empty 3 minutes (or from minute 5 of a session nobody opened), on from the first message, off never">
                Autopilot
                <select value={autopilot} onChange={async (e) => { const value = e.target.value as "auto" | "on" | "off"; setAutopilot(value); const res = await fetch("/api/mod", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ event: event.slug, date: session.date, action: "autopilot", value }) }); if (!res.ok) setError("Could not switch Autopilot."); }} aria-label="Autopilot" className="min-h-6 rounded-full border-0 bg-transparent pr-1 text-[13px] font-bold text-cta focus:outline-none">
                  <option value="auto">auto</option>
                  <option value="on">on</option>
                  <option value="off">off</option>
                </select>
              </label>
              <form className="inline-flex shrink-0 items-center gap-1" onSubmit={async (e) => { e.preventDefault(); const text = teach.trim(); if (text.length < 4) return; const res = await fetch("/api/mod", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ event: event.slug, date: session.date, action: "teach", text }) }); if (res.ok) { setTeach(""); setTaught("she knows it now"); setTimeout(() => setTaught(""), 3000); } else setError("Could not teach her that."); }}>
                <input value={teach} onChange={(e) => setTeach(e.target.value.slice(0, 400))} placeholder="Teach Kaitlyn a fact" aria-label="Teach Kaitlyn a fact" className="min-h-6 w-52 rounded-full border border-line bg-panel px-2.5 text-[13px] text-ink placeholder:text-muted focus:border-brand focus:outline-none" />
                <button type="submit" disabled={teach.trim().length < 4} className="min-h-6 rounded-full border border-line px-2 text-[12px] font-bold text-ink disabled:opacity-40">Teach</button>
                {taught && <span className="text-cta">{taught}</span>}
              </form>
            </>
          )}
          {desk.map((d) => (
            <span key={d.member_id} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-panel py-0.5 pl-1 pr-2.5 text-ink" title={d.last_seen_at}>
              <Avatar name={d.name} size="h-5 w-5 text-[9px]" />
              {d.name}
              <span className="text-muted">{d.tab ? SIDE_TABS.find(([k]) => k === d.tab)?.[1] ?? d.tab : "Chat"}{d.replying_to ? ` · replying to ${d.replying_to}` : ""}</span>
            </span>
          ))}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="flex min-h-0 flex-1 flex-col">
          {event.videoUrl && <Monitor url={event.videoUrl} live={live} offset={offset} open={monitorOpen} onToggle={() => setMonitorOpen((o) => !o)} />}

          <div className="flex border-b border-line lg:hidden">
            {tabButton("chat", "Chat", tab === "chat", () => setTab("chat"))}
            {SIDE_TABS.map(([k, l]) => tabButton(k, SHORT[l] ?? l, tab === k, () => setTab(k)))}
          </div>

          <div className={`min-h-0 flex-1 flex-col ${tab === "chat" ? "flex" : "hidden lg:flex"}`}>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-4 py-1.5 text-sm text-muted">
              <button type="button" onClick={() => { setShowSim((s) => !s); toBottomSoon(); }} className="rounded-md border border-line px-2.5 py-1 text-[13px] text-muted hover:text-ink">
                {showSim ? "Hide simulated chat" : "Show simulated chat"}
              </button>
              <label className="flex items-center gap-2 text-[13px] text-muted">
                <input type="checkbox" checked={onlyMentions} onChange={(e) => { setOnlyMentions(e.target.checked); toBottomSoon(); }} className="h-4 w-4 accent-brand" />
                Mentions of me
              </label>
              <span className="ml-auto hidden text-[12px] sm:inline">green rows are real people</span>
            </div>

            <div ref={scroller} onScroll={onScroll} className="relative min-h-0 flex-1 overflow-y-auto px-4 py-2">
              {shown.length === 0 && <p className="py-8 text-center text-muted">No messages yet.</p>}
              {shown.map((m) => {
                // A run of her posted lines folds into one row (SPEC-kaitlyn-solo.md, H); the rows inside a folded run are not drawn.
                const run = runs.get(m.key);
                if (run) return <KaitlynRun key={m.key} run={run} onOpen={() => setOpenRuns((s) => new Set(s).add(run.key))} />;
                if (hiddenRows.has(m.key)) return null;
                return (
                <div key={m.key} className={`flex gap-3 border-b border-line/60 py-2.5 ${m.deleted ? "opacity-40" : ""} ${m.mentionsMe ? "-mx-4 bg-brand/10 px-4" : m.role === "attendee" ? "-mx-4 bg-emerald-500/10 px-4" : ""}`}>
                  <Avatar name={m.name} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className={`font-bold ${m.role === "moderator" ? "text-brand" : m.role === "simulated" || gone(m) ? "text-muted" : ""}`}>{m.name}</span>
                      {m.role === "simulated" && <span className="text-xs text-muted">simulated</span>}
                      {m.name === "Katherine AI" && <span className="rounded bg-cta/20 px-1.5 text-[11px] font-bold text-cta">{m.kind === "cta" ? "book-now row" : "auto"}</span>}
                      {m.name === KAITLYN && <span className="rounded bg-cta/20 px-1.5 text-[11px] font-bold text-cta" title={m.kind === "autopilot" ? "Posted by Kaitlyn while nobody was on the desk" : m.kind === "kaitlyn" ? "Posted by Kaitlyn herself" : "Kaitlyn's draft, sent by a moderator"}>{m.kind === "autopilot" ? "autopilot" : m.kind === "kaitlyn" ? "auto" : "approved"}</span>}
                      {m.ghostReply && <span className="rounded bg-panel px-1.5 text-[11px] text-muted" title="Only the ghost and the desk see this">ghost reply</span>}
                      {m.belief && <span className="rounded bg-emerald-500/15 px-1.5 text-[11px] font-bold text-emerald-400" title="Counts toward their score">belief</span>}
                      {m.question && <span className="rounded bg-panel px-1.5 text-[11px] text-muted">question</span>}
                      {m.role === "attendee" && person(m.registrantId)?.prior_sessions ? <span className="rounded bg-panel px-1.5 text-[11px] text-muted">watched before ×{person(m.registrantId)!.prior_sessions}</span> : null}
                      {m.role === "attendee" && person(m.registrantId) && <span className="text-xs text-muted">{person(m.registrantId)!.source} · {person(m.registrantId)!.minutes} min</span>}
                      {gone(m) && <span className="rounded bg-panel px-1.5 text-[11px] text-muted" title="Not seen in the room for two minutes">left {clock(person(m.registrantId)!.last_seen_at)}</span>}
                      {m.ghost && <span className="rounded bg-panel px-1.5 text-xs text-muted" title="Only they can see this">ghost</span>}
                      <span className="ml-auto text-xs text-muted tabular-nums">{clock(m.at)}</span>
                    </div>
                    <p className={`whitespace-pre-wrap break-words text-[15px] ${m.deleted ? "line-through" : ""}`}>
                      {splitBody(m.body, m.mentionNames, m.role === "moderator").map((part, i) =>
                        part.kind === "mention" ? <span key={i} className="font-bold text-brand">{part.text}</span>
                        : part.kind === "link" ? <a key={i} href={part.text.startsWith("www.") ? `https://${part.text}` : part.text} target="_blank" rel="noopener" className="break-all text-brand underline">{part.text}</a>
                        : <span key={i}>{part.text}</span>,
                      )}
                    </p>
                    {m.id !== undefined && !m.deleted && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {EMOJIS.map((e) => (
                          <button key={e} type="button" onClick={() => act({ action: "react", id: m.id, emoji: e })} className={`min-h-8 rounded-full px-2 text-sm hover:bg-line ${mine.has(`${m.id}:${e}`) ? "border border-brand bg-brand/15" : "bg-panel"}`} aria-pressed={mine.has(`${m.id}:${e}`)} aria-label={`React ${e}`}>
                            {e}
                            {m.reactions[e] ? <span className="ml-1 text-xs text-muted tabular-nums">{m.reactions[e]}</span> : null}
                          </button>
                        ))}
                        {m.role === "attendee" && m.registrantId && (
                          <button type="button" onClick={() => replyTo(m)} className="min-h-8 rounded-full px-2 text-sm text-muted hover:text-ink">
                            Reply
                          </button>
                        )}
                        <AnswerChip m={m} markets={markets} pitchMs={pitchMs} onPick={replyTo} />
                        <button type="button" onClick={() => act({ action: "delete", id: m.id })} className="min-h-8 rounded-full px-2 text-sm text-muted hover:text-ink">
                          Delete
                        </button>
                        {m.name === KAITLYN && (
                          <button type="button" onClick={() => setFixing((f) => (f === m.id ? null : m.id!))} className={`min-h-8 rounded-full px-2 text-sm ${fixing === m.id ? "font-bold text-cta" : "text-muted hover:text-cta"}`} title="Delete her line, post your better one as her, and she learns it for next time">
                            Fix
                          </button>
                        )}
                        {m.role === "attendee" && m.registrantId && (
                          confirmBlock === m.registrantId ? (
                            <>
                              <button type="button" onClick={async () => { await act({ action: "block", registrant_id: m.registrantId }); setConfirmBlock(null); }} className="min-h-8 rounded-full bg-live px-3 text-sm font-bold text-white">
                                Confirm block
                              </button>
                              <button type="button" onClick={async () => { await act({ action: "block_ip", registrant_id: m.registrantId }); setConfirmBlock(null); }} className="min-h-8 rounded-full border border-live px-3 text-sm font-bold text-live" title={edge ? "Blocked at the edge and here" : "Blocked here; edge blocking needs VERCEL_TOKEN"}>
                                Block their IP too
                              </button>
                              <button type="button" onClick={() => setConfirmBlock(null)} className="min-h-8 rounded-full px-2 text-sm text-muted">
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button type="button" onClick={() => setConfirmBlock(m.registrantId!)} className="min-h-8 rounded-full px-2 text-sm text-muted hover:text-live">
                                Block
                              </button>
                              {confirmGhost?.rid === m.registrantId && confirmGhost.mid === m.id ? (
                                <GhostChips onPick={async (reason) => { await act({ action: "ghost", registrant_id: m.registrantId, id: m.id, reason }); setConfirmGhost(null); }} onCancel={() => setConfirmGhost(null)} />
                              ) : (
                                <button type="button" onClick={() => (person(m.registrantId)?.ghosted ? act({ action: "unghost", registrant_id: m.registrantId }) : setConfirmGhost({ rid: m.registrantId!, mid: m.id }))} className={`min-h-8 rounded-full px-2 text-sm ${person(m.registrantId)?.ghosted ? "bg-live/15 font-bold text-live" : "text-muted hover:text-ink"}`} title="They keep chatting; only they see it">
                                  {person(m.registrantId)?.ghosted ? "Unghost" : "Ghost"}
                                </button>
                              )}
                              {person(m.registrantId)?.ip_blocked && (
                                <button type="button" onClick={() => act({ action: "unblock_ip", registrant_id: m.registrantId })} className="min-h-8 rounded-full px-2 text-sm text-live hover:text-ink">
                                  Unblock IP
                                </button>
                              )}
                            </>
                          )
                        )}
                      </div>
                    )}
                    {m.role === "attendee" && m.id !== undefined && kaitlyn.filter((k) => k.message_id === m.id).map((k) => <KaitlynRow key={k.id} k={k} ghosted={Boolean(person(m.registrantId)?.ghosted)} onAct={kaitlynAct} />)}
                    {fixing === m.id && m.id !== undefined && !m.deleted && <FixRow m={m} onFix={fix} onClose={() => setFixing(null)} />}
                  </div>
                </div>
                );
              })}
            </div>

            {pending > 0 && !atBottom && (
              <button type="button" onClick={() => { atBottomRef.current = true; setAtBottom(true); setPending(0); scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" }); }} className="absolute bottom-20 left-1/2 z-10 -translate-x-1/2 rounded-full bg-brand px-4 py-1.5 text-sm font-bold text-white shadow-lg lg:left-[calc(50%-200px)]">
                {pending} new message{pending > 1 ? "s" : ""} ↓
              </button>
            )}
            <form onSubmit={reply} className="relative border-t border-line p-3" style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}>
              {options.length > 0 && (
                <ul className="absolute bottom-full left-3 right-3 mb-1 max-w-md overflow-hidden rounded-xl border border-line bg-panel shadow-lg" role="listbox">
                  {options.map((p) => (
                    <li key={p.id}>
                      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(p)} className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-base hover:bg-line">
                        <Avatar name={p.name} size="h-7 w-7 text-[11px]" />
                        <span className="min-w-0 flex-1 truncate">{p.name}</span>
                        <span className="shrink-0 text-xs text-muted">{p.id.startsWith("m:") ? "team" : p.sub}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex items-end gap-2">
                {bookingHref && (
                  <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={insertBookingLink} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border border-line px-3 text-sm font-bold text-ink hover:border-brand" title="Insert the booking link. With one person @mentioned it carries their name, so their form greets them.">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.5-1.5" /></svg>
                    <span className="hidden sm:inline">Booking link</span>
                  </button>
                )}
                <input ref={input} value={text} onChange={(e) => setText(e.target.value.slice(0, 500))} onKeyDown={(e) => { if (e.key === "Tab" && options[0]) { e.preventDefault(); pick(options[0]); } }} placeholder={`Reply as ${name}… type @ to mention`} autoComplete="off" enterKeyHint="send" className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-panel px-3 text-base focus:border-brand focus:outline-none" />
                <button type="submit" disabled={!text.trim()} className="min-h-11 rounded-xl bg-brand px-4 font-bold text-white disabled:opacity-40">
                  Send
                </button>
              </div>
              {error && <p className="pt-1 text-sm text-live">{error}</p>}
            </form>
          </div>

          {tab !== "chat" && <div className="min-h-0 flex-1 overflow-y-auto lg:hidden">{panes(tab)}</div>}
        </div>

        <aside className="hidden min-h-0 w-[400px] flex-none flex-col border-l border-line lg:flex">
          <div className="flex border-b border-line">{SIDE_TABS.map(([k, l]) => tabButton(k, l, sideTab === k, () => setSideTab(k)))}</div>
          <div className="min-h-0 flex-1 overflow-y-auto">{panes(sideTab)}</div>
        </aside>
      </div>
    </div>
  );
}

/** The room's video on the room's clock: muted until asked, never the attendee player (no banner, no full screen). */
function Monitor({ url, live, offset, open, onToggle }: { url: string; live: boolean; offset: () => number; open: boolean; onToggle: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => {
      const v = ref.current;
      if (!v) return;
      if (!live || document.visibilityState !== "visible") { if (!v.paused) v.pause(); return; }
      const want = offset();
      if (Math.abs(v.currentTime - want) > 2) v.currentTime = want;
      if (v.paused) v.play().catch(() => {});
    }, 1000);
    return () => clearInterval(id);
  }, [open, live, offset]);
  return (
    <div className={`relative shrink-0 border-b border-line bg-black ${open ? "h-[200px] sm:h-[240px] lg:h-[300px]" : "h-10"}`}>
      {open && <video ref={ref} src={url} muted={muted} playsInline preload="metadata" className="h-full w-full object-contain" />}
      <div className={`absolute inset-x-0 top-0 flex items-center gap-2 px-3 py-1.5 text-xs text-white ${open ? "bg-gradient-to-b from-black/70 to-transparent" : "h-10 bg-panel text-ink"}`}>
        <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-bold ${live ? "bg-live" : "bg-panel text-muted"}`}>{live ? "Now playing" : "Not started"}</span>
        <span className="text-white/80">{open ? "monitor · same clock as the room" : "video hidden"}</span>
        <span className="ml-auto flex gap-1.5">
          {open && live && (
            <button type="button" onClick={() => setMuted((m) => !m)} className="rounded-md bg-black/60 px-2.5 py-1 text-[12px] font-bold text-white hover:bg-black/80">{muted ? "Sound on" : "Mute"}</button>
          )}
          <button type="button" onClick={onToggle} className="rounded-md bg-black/60 px-2.5 py-1 text-[12px] font-bold text-white hover:bg-black/80">{open ? "Hide video" : "Show video"}</button>
        </span>
      </div>
    </div>
  );
}

function PeoplePane({ people, msgCount, confirmBlock, setConfirmBlock, confirmGhost, setConfirmGhost, act, edge }: { people: Person[]; msgCount: Map<string, number>; confirmBlock: string | null; setConfirmBlock: (v: string | null) => void; confirmGhost: { rid: string; mid?: number } | null; setConfirmGhost: (v: { rid: string; mid?: number } | null) => void; act: (b: object) => Promise<boolean>; edge: boolean }) {
  const [q, setQ] = useState("");
  const hit = (p: Person) => !q.trim() || `${p.first_name} ${p.email_masked}`.toLowerCase().includes(q.trim().toLowerCase());
  const here = people.filter((p) => p.in_room && hit(p)).sort((a, b) => a.joined_at.localeCompare(b.joined_at));
  const left = people.filter((p) => !p.in_room && hit(p)).sort((a, b) => b.last_seen_at.localeCompare(a.last_seen_at));
  const row = (p: Person, gone: boolean) => (
    <li key={p.registrant_id} className={`flex items-center gap-2.5 border-b border-line/60 px-4 py-2 ${gone ? "opacity-60" : ""}`}>
      <Avatar name={p.first_name} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-bold">
          {p.first_name}
          <span className="ml-1.5 rounded bg-panel px-1.5 text-[11px] font-bold text-muted">{p.source === "zapier" ? "zap" : p.source}</span>
          {p.person === false && <span className="ml-1.5 rounded bg-panel px-1.5 text-[11px] text-muted" title="Here under two minutes and no line or click yet: not a person until then (SPEC-link-opens.md)">arriving</span>}
          {p.ghosted && <span className="ml-1.5 rounded bg-panel px-1.5 text-[11px] text-muted line-through" title={p.auto_ghost_reason ? (p.auto_ghost_reason.startsWith("by hand") ? p.auto_ghost_reason : `auto: ${p.auto_ghost_reason}`) : undefined}>{p.auto_ghost_reason && !p.auto_ghost_reason.startsWith("by hand") ? "auto-ghosted" : "ghosted"}</span>}
          {p.prior_sessions ? <span className="ml-1.5 rounded bg-panel px-1.5 text-[11px] text-muted">watched before ×{p.prior_sessions}</span> : null}
          {p.hot ? <span className="ml-1.5 rounded bg-panel px-1.5 text-[11px] text-muted" title={`Watched ${p.training_minutes ?? 0} min of the free training before the session`}>{p.ultra_hot ? "🔥🔥 ultra-hot" : "🔥 hot"}</span> : null}
          {p.ip_blocked && <span className="ml-1.5 rounded bg-live/20 px-1.5 text-[11px] font-bold text-live">IP blocked</span>}
        </p>
        <p className="truncate text-xs text-muted">
          {gone ? `${clock(p.joined_at)} to ${clock(p.last_seen_at)}` : `joined ${clock(p.joined_at)}`} · {p.minutes} min{msgCount.get(p.registrant_id) ? ` · ${msgCount.get(p.registrant_id)} message${msgCount.get(p.registrant_id) === 1 ? "" : "s"}` : ""}{p.at_pitch ? " · at the pitch" : ""}{p.clicked_offer ? " · clicked the offer" : ""}
        </p>
      </div>
      {!gone && (
        confirmBlock === p.registrant_id ? (
          <span className="flex shrink-0 gap-1">
            <button type="button" onClick={async () => { await act({ action: "block", registrant_id: p.registrant_id }); setConfirmBlock(null); }} className="min-h-8 rounded-full bg-live px-2.5 text-xs font-bold text-white">Confirm</button>
            <button type="button" onClick={async () => { await act({ action: "block_ip", registrant_id: p.registrant_id }); setConfirmBlock(null); }} className="min-h-8 rounded-full border border-live px-2.5 text-xs font-bold text-live" title={edge ? "Blocked at the edge and here" : "Blocked here; edge blocking needs VERCEL_TOKEN"}>+IP</button>
            <button type="button" onClick={() => setConfirmBlock(null)} className="min-h-8 px-1.5 text-xs text-muted">Cancel</button>
          </span>
        ) : (
          confirmGhost?.rid === p.registrant_id && confirmGhost.mid === undefined ? (
          <GhostChips onPick={async (reason) => { await act({ action: "ghost", registrant_id: p.registrant_id, reason }); setConfirmGhost(null); }} onCancel={() => setConfirmGhost(null)} />
        ) : (
          <span className="flex shrink-0 gap-1">
            <button type="button" onClick={() => (p.ghosted ? act({ action: "unghost", registrant_id: p.registrant_id }) : setConfirmGhost({ rid: p.registrant_id }))} className={`min-h-8 rounded-full border px-2.5 text-xs ${p.ghosted ? "border-live bg-live/15 font-bold text-live" : "border-line text-muted hover:text-ink"}`}>{p.ghosted ? "Unghost" : "Ghost"}</button>
            <button type="button" onClick={() => setConfirmBlock(p.registrant_id)} className="min-h-8 rounded-full border border-line px-2.5 text-xs text-muted hover:border-live hover:text-live">Block</button>
          </span>
        )
        )
      )}
    </li>
  );
  return (
    <div>
      <div className="border-b border-line px-3 py-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find someone by name or email…" aria-label="Search attendees" className="min-h-9 w-full rounded-lg border border-line bg-panel px-3 text-sm focus:border-brand focus:outline-none" />
      </div>
    <ul className="py-1">
      {here.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted">{q ? "No one matches." : "Nobody in the room yet."}</li>}
      {here.map((p) => row(p, false))}
      {left.length > 0 && <li className="px-4 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wide text-muted">Left the room · {left.length}</li>}
      {left.map((p) => row(p, true))}
    </ul>
    </div>
  );
}

/**
 * One of Kaitlyn's suggestions under the message it is about: her draft in a box you can edit before it posts as her,
 * a ghost or a reaction to approve with one tap, or a line she wants a human on (the box is there, empty, for the
 * proper answer; it posts as her). Skip drops it; nothing posts on its own.
 */
function KaitlynRow({ k, ghosted, onAct }: { k: KPending; ghosted: boolean; onAct: (k: KPending, decision: KDecision, body?: string, reason?: string) => Promise<boolean> }) {
  const [draft, setDraft] = useState(k.text);
  const [busy, setBusy] = useState(false);
  // Skip on a draft asks why (SPEC-kaitlyn-solo.md, E): "wrong" is the one she learns from.
  const [skipping, setSkipping] = useState(false);
  const go = async (decision: KDecision, body?: string, reason?: string) => { setBusy(true); await onAct(k, decision, body, reason); setBusy(false); };
  const label = k.action === "reply" ? "reply" : k.action === "ghost" ? "ghost?" : k.action === "ask_william" ? "needs you" : "react?";
  const editable = k.action === "reply" || k.action === "ask_william";
  return (
    <div className="mt-2 rounded-xl border border-dashed border-cta/60 bg-cta/5 p-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted">
        <Avatar name={KAITLYN} size="h-5 w-5 text-[9px]" />
        <span className="font-bold text-cta">Kaitlyn · {label}</span>
        <span className="rounded bg-panel px-1.5">{k.category}</span>
        {ghosted && <span className="rounded bg-panel px-1.5" title="They are ghosted: only they see what Kaitlyn or you send them">ghosted</span>}
        <span className="min-w-0 truncate" title={k.why}>{k.why}</span>
      </div>
      {k.screen && <p className="mt-1 text-[12px] italic text-muted" title="What William was saying on screen when they typed">on screen: {k.screen}</p>}
      {editable ? (
        <div className="mt-1.5 flex items-end gap-2">
          <input value={draft} onChange={(e) => setDraft(e.target.value.slice(0, 500))} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (draft.trim()) go("send", draft); } }} aria-label="Kaitlyn's draft" placeholder={k.action === "ask_william" ? "Your answer, posted as Kaitlyn" : undefined} className="min-h-9 min-w-0 flex-1 rounded-lg border border-line bg-panel px-2.5 text-[15px] focus:border-brand focus:outline-none" />
          <button type="button" disabled={busy || !draft.trim()} onClick={() => go("send", draft)} className="min-h-9 shrink-0 rounded-lg bg-cta px-3 text-sm font-bold text-white disabled:opacity-40">Send as Kaitlyn</button>
        </div>
      ) : null}
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {k.action === "ghost" && (
          <button type="button" disabled={busy} onClick={() => go("ghost")} className="min-h-8 rounded-full bg-live px-3 text-sm font-bold text-white disabled:opacity-40" title="They keep chatting; only they see it. The line above hides from the room.">Ghost them</button>
        )}
        {k.react && (
          <button type="button" disabled={busy} onClick={() => go("react")} className="min-h-8 rounded-full border border-line bg-panel px-2.5 text-sm disabled:opacity-40" title="React as Kaitlyn">React {k.react}</button>
        )}
        {k.action !== "reply" ? (
          <button type="button" disabled={busy} onClick={() => go("skip")} className="min-h-8 rounded-full px-2 text-sm text-muted hover:text-ink disabled:opacity-40">{k.action === "ask_william" ? "Dismiss" : "Skip"}</button>
        ) : skipping ? (
          <span className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Why skip it">
            {SKIP_REASONS.map((r) => (
              <button key={r} type="button" disabled={busy} onClick={() => go("skip", undefined, r)} className={`min-h-8 rounded-full px-2.5 text-xs font-bold disabled:opacity-40 ${r === "wrong" ? "bg-live text-white" : "border border-line bg-panel text-ink"}`} title={r === "wrong" ? "Skip it, and she learns not to say this" : "Skip it; nothing learned"}>{r}</button>
            ))}
            <button type="button" onClick={() => setSkipping(false)} className="min-h-8 rounded-full px-2 text-xs text-muted">cancel</button>
          </span>
        ) : (
          <button type="button" disabled={busy} onClick={() => setSkipping(true)} className="min-h-8 rounded-full px-2 text-sm text-muted hover:text-ink disabled:opacity-40">Skip</button>
        )}
      </div>
    </div>
  );
}

/**
 * Fix one of Kaitlyn's posted lines (William, Oct 18): her text in a box to replace, posted as her to the same person.
 * Her line is deleted, the decision keeps both, and she reads the correction from the next message on.
 */
function FixRow({ m, onFix, onClose }: { m: Item; onFix: (m: Item, body: string) => Promise<boolean>; onClose: () => void }) {
  const name = m.mentionNames?.[0];
  const hers = name && m.body.startsWith(`@${name} `) ? m.body.slice(name.length + 2) : m.body;
  const [draft, setDraft] = useState(hers);
  const [busy, setBusy] = useState(false);
  const same = draft.trim() === hers.trim();
  const go = async () => { if (!draft.trim() || same) return; setBusy(true); await onFix(m, draft.trim()); setBusy(false); };
  return (
    <div className="mt-2 rounded-xl border border-dashed border-cta/60 bg-cta/5 p-2">
      <p className="text-[12px] text-muted">Your better answer replaces hers{name ? ` to ${name}` : ""}, posted as Kaitlyn. She learns it for next time.</p>
      <div className="mt-1.5 flex items-end gap-2">
        <input value={draft} onChange={(e) => setDraft(e.target.value.slice(0, 500))} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); go(); } if (e.key === "Escape") onClose(); }} autoFocus aria-label="The better answer, posted as Kaitlyn" className="min-h-9 min-w-0 flex-1 rounded-lg border border-line bg-panel px-2.5 text-[15px] focus:border-brand focus:outline-none" />
        <button type="button" disabled={busy || !draft.trim() || same} onClick={go} className="min-h-9 shrink-0 rounded-lg bg-cta px-3 text-sm font-bold text-white disabled:opacity-40">Post as Kaitlyn</button>
        <button type="button" onClick={onClose} className="min-h-9 shrink-0 px-2 text-sm text-muted hover:text-ink">Cancel</button>
      </div>
    </div>
  );
}

/**
 * The Answer chip: after the pitch, an attendee row that names a market (or asks a market question) gets the
 * directory's count; clicking drafts Kevin's reply into the box. Other matching markets sit on the hover.
 */
function AnswerChip({ m, markets, pitchMs, onPick }: { m: Item; markets: MarketCount[]; pitchMs: number | null; onPick: (m: Item, draft: string) => void }) {
  const on = m.role === "attendee" && pitchMs !== null && m.at >= pitchMs && markets.length > 0;
  const chip = useMemo(() => {
    if (!on) return null;
    const hits = findMarkets(m.body, markets);
    const states = findStates(m.body);
    if (!hits.length && !states.length && !asksMarket(m.body)) return null;
    const top = hits[0];
    const sums = states.map((c) => rollup(c, markets));
    // A bare state ("Maryland", "PA & NJ") answers with every market in it summed; a city the directory lacks ("Cape Coral Florida") does not.
    const whole = !top && sums.length && onlyStates(m.body, states) ? sums : [];
    const label = top ? `${top.clients} in ${top.name} · ${top.live} live` : whole.length ? whole.map((s) => `${s.clients} across ${s.code}`).join(" + ") : "no market match";
    const draft = top ? marketDraft(top.name, top.clients) : whole.length ? rollupDraft(whole) : NO_MATCH_DRAFT;
    const notes = [
      ...hits.slice(1, 4).map((h) => `${h.clients} in ${h.name}`),
      ...sums.map((s) => `${s.code}: ${s.clients} across ${s.markets.length} (${s.markets.filter((x) => x.clients).slice(0, 6).map((x) => `${placeOf(x.name)} ${x.clients}`).join(", ") || "none"})`),
    ];
    const title = notes.length ? notes.join(" · ") : top ? "The directory's count, every status; live = active, onboarding, renewal, paused" : "No market by that name in the directory";
    return { label, draft, title, strong: Boolean(top || whole.length) };
  }, [on, m.body, markets]);
  if (!chip) return null;
  return (
    <button type="button" onClick={() => onPick(m, chip.draft)} title={chip.title} className={`min-h-8 rounded-full border px-2.5 text-sm font-bold ${chip.strong ? "border-brand text-brand hover:bg-brand/10" : "border-line text-muted hover:text-ink"}`}>
      Answer · {chip.label}
    </button>
  );
}

function TeamPane({ msgs, me, text, setText, onSend, scroller }: { msgs: Item[]; me: string; text: string; setText: (t: string) => void; onSend: (e: React.FormEvent) => void; scroller: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div className="flex h-full flex-col">
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-4 py-2">
        {msgs.length === 0 && <p className="py-6 text-center text-sm text-muted">Only the team sees this. Nothing here reaches an attendee or the chat export.</p>}
        {msgs.map((m) => (
          <div key={m.key} className="flex gap-2.5 py-1.5">
            <Avatar name={m.name} size="h-7 w-7 text-[11px]" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2"><span className={`text-sm font-bold ${m.name === me ? "text-ink" : "text-brand"}`}>{m.name}</span><span className="ml-auto text-xs text-muted tabular-nums">{clock(m.at)}</span></div>
              <p className="whitespace-pre-wrap break-words text-[15px]">{m.body}</p>
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={onSend} className="flex gap-2 border-t border-line p-3" style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}>
        <input value={text} onChange={(e) => setText(e.target.value.slice(0, 500))} placeholder="Message the team…" autoComplete="off" enterKeyHint="send" className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-panel px-3 text-base focus:border-brand focus:outline-none" />
        <button type="submit" disabled={!text.trim()} className="min-h-11 rounded-xl bg-brand px-4 font-bold text-white disabled:opacity-40">Send</button>
      </form>
    </div>
  );
}

function EngagementPane({ people, msgCount, beliefCount, pitchMinutes }: { people: Person[]; msgCount: Map<string, number>; beliefCount: Map<string, number>; pitchMinutes: number }) {
  // A leaderboard: the same score the setters' top ten uses after the session, best first.
  const [sort, setSort] = useState<"score" | "minutes" | "messages">("score");
  const ranked = rankEngagement(people.filter((p) => p.source !== "test").map((p) => ({ ...p, messages: msgCount.get(p.registrant_id) ?? 0, belief: beliefCount.get(p.registrant_id) ?? 0, atPitch: p.at_pitch, clicked: p.clicked_offer })), pitchMinutes);
  const rows = sort === "score" ? ranked : [...ranked].sort((a, b) => (sort === "minutes" ? b.minutes - a.minutes : b.messages - a.messages) || b.score - a.score);
  const th = (key: "score" | "minutes" | "messages", label: string) => (
    <th className="py-2 pr-3 text-right"><button type="button" onClick={() => setSort(key)} className={`text-[11px] font-bold uppercase tracking-wide ${sort === key ? "text-ink" : "text-muted hover:text-ink"}`}>{label}{sort === key ? " ▾" : ""}</button></th>
  );
  return (
    <table className="w-full text-sm">
      <thead><tr className="border-b border-line text-left"><th className="py-2 pl-4 pr-2 text-[11px] font-bold uppercase tracking-wide text-muted">#</th><th className="py-2 pr-3 text-[11px] font-bold uppercase tracking-wide text-muted">Name</th>{th("score", "Score")}{th("minutes", "Min")}{th("messages", "Msgs")}<th className="py-2 pr-3 text-center text-[11px] font-bold uppercase tracking-wide text-muted">Pitch</th><th className="py-2 pr-4 text-center text-[11px] font-bold uppercase tracking-wide text-muted">Clicked</th></tr></thead>
      <tbody>
        {rows.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-muted">Nobody has joined yet.</td></tr>}
        {rows.map((p) => (
          <tr key={p.registrant_id} className={`border-b border-line/60 ${p.in_room ? "" : "opacity-60"}`}>
            <td className="py-1.5 pl-4 pr-2 text-muted tabular-nums">{p.rank}</td>
            <td className="py-1.5 pr-3"><span className="font-bold">{p.first_name}</span><span className="ml-1.5 text-[11px] text-muted">{p.in_room ? (p.person === false ? "arriving" : "") : "left"}</span></td>
            <td className="py-1.5 pr-3 text-right font-bold tabular-nums">{Math.round(p.score * 100)}</td>
            <td className="py-1.5 pr-3 text-right tabular-nums">{p.minutes}</td>
            <td className="py-1.5 pr-3 text-right tabular-nums">{p.messages}{p.belief ? <span className="ml-1 text-[11px] text-emerald-400">+{p.belief}</span> : null}</td>
            <td className="py-1.5 pr-3 text-center">{p.at_pitch ? <span className="text-emerald-400">✓</span> : <span className="text-muted">–</span>}</td>
            <td className="py-1.5 pr-4 text-center">{p.clicked_offer ? <span className="text-emerald-400">✓</span> : <span className="text-muted">–</span>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function StatsPane({ stats, chatters, messages, now, ctaAt, startsAt, history, live }: { stats: Stats | null; chatters: number; messages: number; now: number; ctaAt: number | null; startsAt: number; history: HistoryRow[] | null; live: boolean }) {
  if (!stats) return <p className="py-6 text-center text-sm text-muted">Loading…</p>;
  const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : "–");
  const untilPitch = ctaAt !== null ? Math.max(0, Math.round((startsAt + ctaAt * 1000 - now) / 60000)) : null;
  const tile = (v: string | number, l: string, accent = false, fine?: string) => (
    <div className="rounded-xl border border-line bg-panel px-3 py-2.5">
      <div className={`text-[22px] font-bold leading-tight tabular-nums ${accent ? "text-cta" : ""}`}>{v}</div>
      <div className="text-xs text-muted">{l}</div>
      {fine && <div className="text-[11px] text-muted">{fine}</div>}
    </div>
  );
  return (
    <div className="grid grid-cols-2 gap-2 p-4">
      {tile(stats.registered - (stats.moved_in ?? 0), "registered tonight", false, stats.moved_in ? `+ ${stats.moved_in} moved in today from an older link` : undefined)}
      {tile(stats.joined, `people · ${pct(stats.joined, stats.registered - (stats.moved_in ?? 0))} of tonight's`, false, stats.visits !== undefined ? `${stats.visits} link opens` : undefined)}
      <div className="rounded-xl border border-emerald-500/40 bg-panel px-3 py-2.5">
        <div className="text-[22px] font-bold leading-tight text-emerald-400 tabular-nums">{stats.in_room}</div>
        <div className="text-xs text-muted">in the room now{stats.arriving ? ` · ${stats.arriving} arriving` : ""}</div>
        {stats.peak > 0 && <div className="text-[11px] text-muted">retention {pct(stats.in_room, stats.peak)} of peak</div>}
      </div>
      {tile(stats.peak, "peak")}
      {stats.at_pitch !== null ? tile(stats.at_pitch, `at the pitch (${ctaAt !== null ? mmss(ctaAt) : ""})`, true) : tile(untilPitch !== null ? `${untilPitch}m` : "–", "until the pitch", false, ctaAt !== null ? `at ${mmss(ctaAt)} in` : undefined)}
      {tile(stats.clicked, "offer clicks")}
      {tile(chatters, `chatters · ${messages} messages`)}
      {tile(stats.stayed_15, "stayed 15+ min")}
      {(() => {
        // Typical night: the average minute curve of the last ten sessions, and where tonight sits on it.
        const curves = (history ?? []).map((h) => h.curve).filter((c): c is number[] => Array.isArray(c) && c.length > 0);
        if (curves.length === 0) return tile("–", "typical night", false, "no past sessions yet");
        const len = Math.max(...curves.map((c) => c.length));
        const avg = Array.from({ length: len }, (_, m) => { const xs = curves.map((c) => c[m]).filter((v) => typeof v === "number"); return xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : 0; });
        const peakV = Math.max(...avg); const peakM = avg.indexOf(peakV);
        let holdEnd = peakM; for (let m = peakM; m < avg.length; m++) if (avg[m] >= 0.75 * peakV) holdEnd = m;
        const m = Math.max(0, Math.floor((now - startsAt) / 60000));
        const cur = avg[Math.min(m, avg.length - 1)] ?? 0;
        const phase = !live ? "—" : cur >= 0.9 * peakV ? "Peak" : m < peakM ? "Warming" : cur >= 0.75 * peakV ? "Holding" : "Cooling";
        return tile(phase, `typical night · peak at min ${peakM}`, phase === "Peak", `holding to ${mmss(holdEnd * 60)}, cooling after · tonight ${stats.in_room} vs ${Math.round(cur)} typical at this minute · ${curves.length} sessions`);
      })()}
      {tile(stats.booked, `booked${stats.at_pitch ? ` · ${pct(stats.booked, stats.at_pitch)} of those at the pitch` : ""}`, false, "from iClosed, via leadogo, within the half hour")}
      {(() => {
        // Projection: tonight's at-the-pitch count × the book rate of past sessions, this weekday once it has four, else all.
        if (!history) return tile("…", "projected bookings");
        const wd = new Date(startsAt).getDay();
        const same = history.filter((h) => h.weekday === wd && h.at_pitch > 0);
        const pool = same.length >= 4 ? same : history.filter((h) => h.at_pitch > 0);
        const sumPitch = pool.reduce((s, h) => s + h.at_pitch, 0);
        const rate = sumPitch > 0 ? pool.reduce((s, h) => s + h.booked, 0) / sumPitch : null;
        const base = stats.at_pitch ?? stats.in_room;
        return rate === null ? tile("–", "projected bookings", false, "no past sessions with bookings yet") : tile(`≈ ${Math.round(base * rate)}`, "projected bookings", true, `${Math.round(rate * 100)}% of ${stats.at_pitch !== null ? "those at the pitch" : "the room now"} · ${same.length >= 4 ? "this weekday" : "all days"}, ${pool.length} session${pool.length === 1 ? "" : "s"}`);
      })()}
    </div>
  );
}

/** Three or more of Kaitlyn's posted lines in a row fold into one row (SPEC-kaitlyn-solo.md, H), so at five lines a minute the cards that need a human stay on screen. A run being fixed, or tapped open, stays unfolded; the rows inside a folded run are not drawn. */
function foldRuns(shown: Item[], openRuns: Set<string>, fixing: number | null): { runs: Map<string, Run>; hiddenRows: Set<string> } {
  const runs = new Map<string, Run>();
  const hiddenRows = new Set<string>();
  let run: Item[] = [];
  const flush = () => {
    if (run.length >= 3 && !openRuns.has(run[0].key)) {
      runs.set(run[0].key, { key: run[0].key, n: run.length, names: [...new Set(run.flatMap((r) => r.mentionNames ?? []))], first: run[0].at, last: run[run.length - 1].at });
      for (const r of run.slice(1)) hiddenRows.add(r.key);
    }
    run = [];
  };
  for (const m of shown) {
    if (m.name === KAITLYN && m.role === "moderator" && !m.deleted && fixing !== m.id) run.push(m);
    else flush();
  }
  flush();
  return { runs, hiddenRows };
}

/** A folded run of Kaitlyn's posted lines (SPEC-kaitlyn-solo.md, H): how many, to whom, and when; a tap opens the lines with their Fix and Delete. */
function KaitlynRun({ run, onOpen }: { run: Run; onOpen: () => void }) {
  const names = run.names.slice(0, 6).join(", ") + (run.names.length > 6 ? ` +${run.names.length - 6}` : "");
  return (
    <button type="button" onClick={onOpen} className="-mx-4 flex w-[calc(100%+2rem)] items-center gap-3 border-b border-line/60 bg-cta/5 px-4 py-2 text-left hover:bg-cta/10" title="Open her lines, with Fix and Delete">
      <Avatar name={KAITLYN} />
      <span className="min-w-0 flex-1 text-sm">
        <span className="font-bold text-brand">Kaitlyn</span> answered {run.n}{names ? `: ${names}` : ""}
        <span className="ml-2 text-xs text-muted tabular-nums">{clock(run.first)} to {clock(run.last)} · tap to open</span>
      </span>
    </button>
  );
}

/** Why (SPEC-kaitlyn-ghosts.md, B4): one tap, and the reason rides into the ghost view Kaitlyn learns from and into the morning digest. "other" ghosts without one. */
function GhostChips({ onPick, onCancel }: { onPick: (reason: string) => void | Promise<void>; onCancel: () => void }) {
  return (
    <span className="flex flex-wrap items-center gap-1">
      {[...GHOST_REASONS, "other"].map((r) => (
        <button key={r} type="button" onClick={() => void onPick(r)} className="min-h-8 rounded-full bg-live px-2.5 text-xs font-bold text-white" title="Ghost them, with this as the reason">{r}</button>
      ))}
      <button type="button" onClick={onCancel} className="min-h-8 px-1.5 text-xs text-muted">Cancel</button>
    </span>
  );
}
