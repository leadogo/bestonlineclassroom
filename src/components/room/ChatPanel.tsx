"use client";
// The chat (SPEC-chat.md): the simulated crowd plays on the video's clock, real people and moderators arrive by a
// 3 s poll, and the viewer types into one box. A late joiner sees the room as it already is.
import { useCallback, useEffect, useRef, useState } from "react";
import { canPost, MAX_BODY, mergeUpdates, simulatedCursor, trimList, type ChatItem, type ChatUpdate, type SimulatedRow } from "@/lib/chat";
import { Avatar } from "./PeoplePanel";

type Wire = { id: number; author_name: string; role: "attendee" | "moderator"; body: string; offset_seconds: number; reactions: Record<string, number>; created_at: string };

const POLL_MS = 3000;

export function ChatPanel({ token, firstName, simulated, live, expected, visible, onUnread }: { token: string; firstName: string; simulated: SimulatedRow[]; live: boolean; expected: () => number; visible: boolean; onUnread: () => void }) {
  const [list, setList] = useState<ChatItem[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [blocked, setBlocked] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const [pending, setPending] = useState(0);
  const sim = useRef<{ rows: SimulatedRow[]; next: number }>({ rows: simulated, next: 0 });
  const cursor = useRef({ after: 0, since: "" });
  const lastPost = useRef<number | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const seq = useRef(0);

  const append = useCallback(
    (items: ChatItem[]) => {
      if (items.length === 0) return;
      setList((l) => trimList([...l, ...items]));
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
      const mapped = items.map((r) => ({ key: `s${seq.current++}`, name: r.name, role: "simulated" as const, body: r.body, at: now - (expected() - r.offset_seconds) * 1000, reactions: {} }));
      if (first) setList((l) => trimList([...mapped, ...l]));
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
          if (res.ok) {
            const j = (await res.json()) as { new: Wire[]; updated: ChatUpdate[]; now: string };
            const fresh = j.new.map((m) => ({ key: `r${m.id}`, id: m.id, name: m.author_name, role: m.role, body: m.body, at: new Date(m.created_at).getTime(), reactions: m.reactions ?? {}, mine: m.author_name === firstName && m.role === "attendee" }));
            if (fresh.length) cursor.current.after = fresh[fresh.length - 1].id!;
            cursor.current.since = j.now;
            if (j.updated.length) setList((l) => mergeUpdates(l, j.updated));
            if (cursor.current.after && fresh.length && list.length === 0) setList((l) => trimList([...l, ...fresh]));
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

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || blocked) return;
    if (!canPost(lastPost.current, Date.now())) {
      setError("One message at a time.");
      return;
    }
    setError("");
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, body, offset: Math.floor(expected()) }) });
      const j = (await res.json().catch(() => ({}))) as { message?: Wire; error?: string };
      if (res.status === 403) {
        setBlocked(true);
        return;
      }
      if (!res.ok || !j.message) throw new Error(j.error ?? "Please try again.");
      lastPost.current = Date.now();
      const m = j.message;
      cursor.current.after = Math.max(cursor.current.after, m.id);
      setText("");
      setAtBottom(true);
      setList((l) => trimList([...l, { key: `r${m.id}`, id: m.id, name: m.author_name, role: m.role, body: m.body, at: Date.now(), reactions: {}, mine: true }]));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Please try again.");
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div ref={scroller} onScroll={onScroll} className="relative min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {!live && <p className="px-1 py-6 text-center text-base text-muted">The chat opens when the session starts.</p>}
        {list.map((m) => (
          <Message key={m.key} m={m} />
        ))}
      </div>
      {pending > 0 && !atBottom && (
        <button type="button" onClick={() => { setAtBottom(true); scroller.current?.scrollTo({ top: scroller.current.scrollHeight }); }} className="mx-auto -mt-10 mb-2 rounded-full bg-brand px-4 py-1.5 text-sm font-bold text-white shadow">
          {pending} new message{pending > 1 ? "s" : ""} ↓
        </button>
      )}
      <form onSubmit={send} className="border-t border-line p-2" style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom, 0px))" }}>
        {blocked ? (
          <p className="px-2 py-2 text-center text-sm text-muted">Chat is unavailable.</p>
        ) : (
          <div className="flex items-end gap-2">
            <label htmlFor="chat-input" className="sr-only">
              Your message
            </label>
            <input
              id="chat-input"
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, MAX_BODY))}
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

function Message({ m }: { m: ChatItem }) {
  const time = new Date(m.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const entries = Object.entries(m.reactions).filter(([, n]) => n > 0);
  return (
    <div className="flex gap-2.5 py-1.5">
      <Avatar name={m.name} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className={`truncate text-sm font-bold ${m.role === "moderator" ? "text-brand" : m.mine ? "text-ink" : "text-ink/90"}`}>{m.name}</span>
          {m.role === "moderator" && <span className="rounded bg-brand/15 px-1.5 py-px text-[11px] font-bold text-brand">Moderator</span>}
          <span className="ml-auto shrink-0 text-xs text-muted tabular-nums">{time}</span>
        </div>
        <p className="whitespace-pre-wrap break-words text-[15px] leading-snug text-ink">{m.body}</p>
        {entries.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {entries.map(([e, n]) => (
              <span key={e} className="rounded-full bg-panel px-2 py-0.5 text-xs tabular-nums">
                {e} {n}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
