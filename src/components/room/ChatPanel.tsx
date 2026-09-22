"use client";
// The chat (SPEC-chat.md): the simulated crowd plays on the video's clock, real people and moderators arrive by a
// 3 s poll, and the viewer types into one box. A late joiner sees the room as it already is. Phase 4 chat-social:
// everyone reacts (one per emoji per person, tap again to remove) and can @mention people in the room.
import { useCallback, useEffect, useRef, useState } from "react";
import { canPost, MAX_BODY, mergeUpdates, simulatedCursor, splitBody, trimList, type ChatItem, type ChatUpdate, type SimulatedRow } from "@/lib/chat";
import { EMOJIS } from "@/lib/moderation";
import { Avatar } from "./PeoplePanel";

type Wire = { id: number; registrant_id: string | null; team_member_id: string | null; author_name: string; role: "attendee" | "moderator"; body: string; offset_seconds: number; reactions: Record<string, number>; mentions: string[]; mention_names?: string[]; created_at: string };
type Item = ChatItem & { mentionsMe?: boolean; mentionId?: string; local?: Record<string, number> };
export type Mentionable = { id: string; name: string; sub?: string };

const POLL_MS = 3000;

export function ChatPanel({ token, registrantId, simulated, live, expected, visible, onUnread, people, onRemoved }: { token: string; registrantId: string; simulated: SimulatedRow[]; live: boolean; expected: () => number; visible: boolean; onUnread: () => void; people: Mentionable[]; onRemoved: () => void }) {
  const [list, setList] = useState<Item[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [blocked, setBlocked] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const [pending, setPending] = useState(0);
  const [mine, setMine] = useState<Set<string>>(new Set());
  const [picked, setPicked] = useState<Mentionable[]>([]);
  const sim = useRef<{ rows: SimulatedRow[]; next: number }>({ rows: simulated, next: 0 });
  const cursor = useRef({ after: 0, since: "" });
  const lastPost = useRef<number | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const seq = useRef(0);
  const [mods, setMods] = useState<Mentionable[]>([]);

  const toItem = (m: Wire): Item => ({ key: `r${m.id}`, id: m.id, name: m.author_name, role: m.role, body: m.body, at: new Date(m.created_at).getTime(), reactions: m.reactions ?? {}, mine: m.registrant_id === registrantId, mentionsMe: (m.mentions ?? []).includes(registrantId), mentionNames: m.mention_names ?? [], mentionId: m.team_member_id ? `m:${m.team_member_id}` : (m.registrant_id ?? undefined) });

  const append = useCallback(
    (items: Item[]) => {
      if (items.length === 0) return;
      setList((l) => trimList([...l, ...items]) as Item[]);
      if (!visible) items.forEach(onUnread);
      else if (!atBottom) setPending((n) => n + items.length);
    },
    [visible, atBottom, onUnread],
  );

  // The simulated crowd: the whole history at once on open, then every second what the video's clock has reached.
  useEffect(() => {
    if (!live) return;
    const run = () => {
      const { items, nextIndex } = simulatedCursor(sim.current.rows, expected(), sim.current.next);
      if (items.length === 0) return;
      const first = sim.current.next === 0;
      sim.current.next = nextIndex;
      const now = Date.now();
      const mapped: Item[] = items.map((r) => ({ key: `s${seq.current++}`, name: r.name, role: "simulated" as const, body: r.body, at: now - (expected() - r.offset_seconds) * 1000, reactions: {} }));
      if (first) setList((l) => trimList([...mapped, ...l]) as Item[]);
      else append(mapped);
    };
    const t = setTimeout(run, 0);
    const id = setInterval(run, 1000);
    return () => {
      clearTimeout(t);
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, append]);

  // Real messages: poll while live and the tab is visible.
  useEffect(() => {
    if (!live) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const poll = async () => {
      if (stop) return;
      if (document.visibilityState === "visible") {
        try {
          const q = new URLSearchParams({ token, after: String(cursor.current.after), since: cursor.current.since });
          const res = await fetch(`/api/chat?${q}`, { cache: "no-store" });
          if (res.status === 403) {
            onRemoved();
            return;
          }
          if (res.ok) {
            const j = (await res.json()) as { new: Wire[]; updated: ChatUpdate[]; now: string; mine?: Array<{ id: number; emoji: string }> };
            const fresh = j.new.map(toItem);
            const newMods = j.new.filter((m) => m.role === "moderator" && m.team_member_id).map((m) => ({ id: `m:${m.team_member_id}`, name: m.author_name }));
            if (newMods.length) setMods((l) => [...l, ...newMods.filter((n) => !l.some((x) => x.id === n.id))]);
            if (fresh.length) cursor.current.after = fresh[fresh.length - 1].id!;
            cursor.current.since = j.now;
            if (j.mine?.length) setMine((s) => new Set([...s, ...j.mine!.map((r) => `${r.id}:${r.emoji}`)]));
            if (j.updated.length) setList((l) => mergeUpdates(l, j.updated) as Item[]);
            if (cursor.current.after && fresh.length && list.length === 0) setList((l) => trimList([...l, ...fresh]) as Item[]);
            else append(fresh.filter((f) => !list.some((x) => x.id === f.id)));
          }
        } catch {
          /* next poll */
        }
      }
      timer = setTimeout(poll, POLL_MS);
    };
    poll();
    return () => {
      stop = true;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, token]);

  // Stick to the bottom unless the reader scrolled up.
  useEffect(() => {
    const el = scroller.current;
    if (el && atBottom) el.scrollTop = el.scrollHeight;
  }, [list, atBottom, visible]);

  function onScroll() {
    const el = scroller.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setAtBottom(near);
    if (near) setPending(0);
  }

  // Simulated messages have no row to react to: the tap counts on this screen only.
  function reactLocal(key: string, emoji: string) {
    setList((l) => l.map((m) => (m.key !== key ? m : { ...m, local: { ...(m.local ?? {}), [emoji]: (m.local?.[emoji] ?? 0) === 1 ? 0 : 1 }, reactions: { ...m.reactions, [emoji]: Math.max(0, (m.reactions[emoji] ?? 0) + ((m.local?.[emoji] ?? 0) === 1 ? -1 : 1)) } })));
  }
  function replyTo(m: Item) {
    setText((t) => (t.trim() ? `${t.trimEnd()} @${m.name} ` : `@${m.name} `));
    if (m.mentionId) setPicked((l) => (l.some((x) => x.id === m.mentionId) ? l : [...l, { id: m.mentionId!, name: m.name }]));
    input.current?.focus();
  }

  async function react(id: number, emoji: string) {
    const key = `${id}:${emoji}`;
    try {
      const res = await fetch("/api/react", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, id, emoji }) });
      const j = (await res.json().catch(() => ({}))) as { reactions?: Record<string, number>; on?: boolean };
      if (!res.ok || !j.reactions) return;
      setMine((s) => {
        const n = new Set(s);
        if (j.on) n.add(key);
        else n.delete(key);
        return n;
      });
      setList((l) => l.map((m) => (m.id === id ? { ...m, reactions: j.reactions! } : m)));
    } catch {
      /* ignore */
    }
  }

  // "@" at the caret offers people in the room; picking one writes "@Name " and remembers the id.
  const atWord = /(?:^|\s)@([^@\s]*)$/.exec(text);
  const options: Mentionable[] = atWord ? [...people.filter((p) => p.id !== registrantId), ...mods].filter((p) => p.name.toLowerCase().startsWith(atWord[1].toLowerCase())).slice(0, 6) : [];
  function pick(p: Mentionable) {
    setText(text.replace(/@[^@\s]*$/, `@${p.name} `));
    setPicked((l) => (l.some((x) => x.id === p.id) ? l : [...l, p]));
    input.current?.focus();
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || blocked) return;
    if (!canPost(lastPost.current, Date.now())) {
      setError("One message at a time.");
      return;
    }
    setError("");
    const mentions = picked.filter((p) => body.includes(`@${p.name}`)).map((p) => p.id);
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, body, offset: Math.floor(expected()), mentions }) });
      const j = (await res.json().catch(() => ({}))) as { message?: Wire; error?: string };
      if (res.status === 403) {
        setBlocked(true);
        onRemoved();
        return;
      }
      if (!res.ok || !j.message) throw new Error(j.error ?? "Please try again.");
      lastPost.current = Date.now();
      const m = j.message;
      cursor.current.after = Math.max(cursor.current.after, m.id);
      setText("");
      setPicked([]);
      setAtBottom(true);
      setList((l) => trimList([...l, { ...toItem(m), at: Date.now(), mine: true }]) as Item[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Please try again.");
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div ref={scroller} onScroll={onScroll} className="relative min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {!live && <p className="px-1 py-6 text-center text-base text-muted">The chat opens when the session starts.</p>}
        {list.map((m) => (
          <Message key={m.key} m={m} mine={mine} onReact={react} onReactLocal={reactLocal} onReply={replyTo} />
        ))}
      </div>
      {pending > 0 && !atBottom && (
        <button type="button" onClick={() => { setAtBottom(true); scroller.current?.scrollTo({ top: scroller.current.scrollHeight }); }} className="mx-auto -mt-10 mb-2 rounded-full bg-brand px-4 py-1.5 text-sm font-bold text-white shadow">
          {pending} new message{pending > 1 ? "s" : ""} ↓
        </button>
      )}
      <form onSubmit={send} className="relative border-t border-line p-2" style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom, 0px))" }}>
        {options.length > 0 && (
          <ul className="absolute bottom-full left-2 right-2 mb-1 overflow-hidden rounded-xl border border-line bg-panel shadow-lg" role="listbox">
            {options.map((p) => (
              <li key={p.id}>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(p)} className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-base hover:bg-line">
                  <Avatar name={p.name} size="h-7 w-7 text-[11px]" />
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  {p.sub && <span className="shrink-0 text-xs text-muted">{p.sub}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
        {blocked ? (
          <p className="px-2 py-2 text-center text-sm text-muted">Chat is unavailable.</p>
        ) : (
          <div className="flex items-end gap-2">
            <label htmlFor="chat-input" className="sr-only">
              Your message
            </label>
            <input
              id="chat-input"
              ref={input}
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, MAX_BODY))}
              onKeyDown={(e) => { if (e.key === "Tab" && options[0]) { e.preventDefault(); pick(options[0]); } }}
              placeholder={live ? "Say something…" : "Chat opens at start"}
              disabled={!live}
              autoComplete="off"
              enterKeyHint="send"
              className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-panel px-3 text-base text-ink placeholder:text-muted focus:border-brand focus:outline-none"
            />
            <button type="submit" disabled={!live || !text.trim()} className="min-h-11 rounded-xl bg-brand px-4 text-base font-bold text-white disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70">
              Send
            </button>
          </div>
        )}
        {error && <p className="px-1 pt-1 text-sm text-live">{error}</p>}
        {text.length > 400 && <p className="px-1 pt-1 text-xs text-muted tabular-nums">{MAX_BODY - text.length} left</p>}
      </form>
    </div>
  );
}

function Message({ m, mine, onReact, onReactLocal, onReply }: { m: Item; mine: Set<string>; onReact: (id: number, emoji: string) => void; onReactLocal: (key: string, emoji: string) => void; onReply: (m: Item) => void }) {
  const time = new Date(m.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const entries = Object.entries(m.reactions).filter(([, n]) => n > 0);
  const real = m.id !== undefined;
  const pressed = (e: string) => (real ? mine.has(`${m.id}:${e}`) : (m.local?.[e] ?? 0) === 1);
  const tap = (e: string) => (real ? onReact(m.id!, e) : onReactLocal(m.key, e));
  return (
    <div className={`group flex gap-2.5 py-1.5 ${m.mentionsMe ? "-mx-3 bg-brand/10 px-3" : ""}`}>
      <Avatar name={m.name} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className={`truncate text-sm font-bold ${m.role === "moderator" ? "text-brand" : m.mine ? "text-ink" : "text-ink/90"}`}>{m.name}</span>
          {m.role === "moderator" && <span className="rounded bg-brand/15 px-1.5 py-px text-[11px] font-bold text-brand">Moderator</span>}
          <span className="ml-auto shrink-0 text-xs text-muted tabular-nums">{time}</span>
        </div>
        <p className="whitespace-pre-wrap break-words text-[15px] leading-snug text-ink landscape-phone:leading-normal">
          {splitBody(m.body, m.mentionNames, m.role === "moderator").map((part, i) =>
            part.kind === "mention" ? <span key={i} className="font-bold text-brand">{part.text}</span>
            : part.kind === "link" ? <a key={i} href={part.text.startsWith("www.") ? `https://${part.text}` : part.text} target="_blank" rel="noopener" className="break-all text-brand underline">{part.text}</a>
            : <span key={i}>{part.text}</span>,
          )}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {entries.map(([e, n]) => (
            <button key={e} type="button" onClick={() => tap(e)} className={`min-h-7 rounded-full px-2 text-xs tabular-nums ${pressed(e) ? "border border-brand bg-brand/15 text-ink" : "bg-panel text-ink/90"}`} aria-pressed={pressed(e)} aria-label={`${e} ${n}`}>
              {e} {n}
            </button>
          ))}
          <details className="relative">
            <summary className="grid min-h-7 min-w-7 cursor-pointer list-none place-items-center rounded-full bg-panel px-2 text-xs text-muted hover:text-ink" aria-label="React">
              +
            </summary>
            <div className="absolute bottom-full left-0 z-10 mb-1 flex gap-1 rounded-full border border-line bg-panel p-1 shadow-lg">
              {EMOJIS.map((e) => (
                <button key={e} type="button" onClick={(ev) => { tap(e); (ev.currentTarget.closest("details") as HTMLDetailsElement | null)?.removeAttribute("open"); }} className="grid h-9 w-9 place-items-center rounded-full text-lg hover:bg-line" aria-label={`React ${e}`}>
                  {e}
                </button>
              ))}
            </div>
          </details>
          {!m.mine && (
            <button type="button" onClick={() => onReply(m)} className="min-h-7 rounded-full px-2 text-xs text-muted hover:text-ink">
              Reply
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
