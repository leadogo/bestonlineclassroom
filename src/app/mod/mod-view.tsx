"use client";
// The moderator view (SPEC-moderator.md): the real stream, a reply box under the member's display name, and per
// message delete, react and block. Phase 4: ghost (they keep talking, nobody hears), IP block (edge + our side),
// a mentions filter, and per-person reactions. The simulated crowd can be shown alongside, off by default.
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOut } from "../login/actions";
import { mergeUpdates, simulatedCursor, splitMentions, trimList, type ChatItem, type ChatUpdate, type SimulatedRow } from "@/lib/chat";
import { EMOJIS } from "@/lib/moderation";
import { Avatar } from "@/components/room/PeoplePanel";

type Wire = { id: number; registrant_id: string | null; author_name: string; role: "attendee" | "moderator"; body: string; offset_seconds: number; reactions: Record<string, number>; deleted_at: string | null; created_at: string; visibility: "all" | "author"; mentions: string[] };
type Person = { first_name: string; last_seen_at: string; source: string; registrant_id: string; ghosted: boolean; has_ip: boolean; ip_blocked: boolean };
type Item = ChatItem & { registrantId?: string | null; deleted?: boolean; ghost?: boolean; mentionsMe?: boolean };

export function ModView({ member, event, session, serverNow }: { member: { id: string; display_name: string; email: string }; event: { slug: string; title: string; iconUrl: string | null; hostName: string }; session: { date: string; startsAt: number; endsAt: number }; serverNow: number }) {
  const skew = useRef(0);
  const router = useRouter();
  const [list, setList] = useState<Item[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [showSim, setShowSim] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [confirmBlock, setConfirmBlock] = useState<string | null>(null);
  const [onlyMentions, setOnlyMentions] = useState(false);
  const [edge, setEdge] = useState(true);
  const [mine, setMine] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(serverNow);
  const cursor = useRef({ after: 0, since: "" });
  const sim = useRef<{ rows: SimulatedRow[]; next: number }>({ rows: [], next: 0 });
  const scroller = useRef<HTMLDivElement>(null);
  const offset = () => (Date.now() + skew.current - session.startsAt) / 1000;
  const offsetNow = (now - session.startsAt) / 1000;
  const live = now >= session.startsAt && now < session.endsAt;

  useEffect(() => {
    skew.current = serverNow - Date.now();
    const id = setInterval(() => setNow(Date.now() + skew.current), 1000);
    return () => clearInterval(id);
  }, [serverNow]);

  useEffect(() => {
    let stop = false;
    let t: ReturnType<typeof setTimeout> | null = null;
    const poll = async () => {
      if (stop) return;
      try {
        const q = new URLSearchParams({ event: event.slug, date: session.date, after: String(cursor.current.after), since: cursor.current.since });
        const res = await fetch(`/api/mod?${q}`, { cache: "no-store" });
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        const j = (await res.json()) as { new: Wire[]; updated: ChatUpdate[]; people: Person[]; now: string; edge?: boolean };
        const fresh: Item[] = j.new.map((m) => ({ key: `r${m.id}`, id: m.id, registrantId: m.registrant_id, name: m.author_name, role: m.role, body: m.body, at: new Date(m.created_at).getTime(), reactions: m.reactions ?? {}, deleted: Boolean(m.deleted_at), ghost: m.visibility === "author", mentionsMe: (m.mentions ?? []).includes(`m:${member.id}`) }));
        setEdge(j.edge !== false);
        if (fresh.length) cursor.current.after = fresh[fresh.length - 1].id!;
        cursor.current.since = j.now;
        setList((l) => trimList([...mergeUpdates(l, j.updated).map((x) => (j.updated.find((u) => u.id === x.id)?.deleted ? { ...x, deleted: true } : x)), ...fresh.filter((f) => !l.some((x) => x.id === f.id))], 600) as Item[]);
        setPeople(j.people);
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
  }, [event.slug, session.date, router, member.id]);

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
      const n = Date.now();
      setList((l) => trimList([...l, ...items.map((r, i) => ({ key: `s${nextIndex}-${i}`, name: r.name, role: "simulated" as const, body: r.body, at: n - (offset() - r.offset_seconds) * 1000, reactions: {} }))], 600) as Item[]);
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSim, event.slug]);

  useEffect(() => {
    const el = scroller.current;
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 200) el.scrollTop = el.scrollHeight;
  }, [list]);

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

  async function reply(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    if (await act({ action: "reply", body })) setText("");
  }

  const shown = list.filter((m) => (m.role !== "simulated" || showSim) && (!onlyMentions || m.mentionsMe));
  const recent = people.filter((p) => now - new Date(p.last_seen_at).getTime() < 120_000);

  return (
    <div className="flex h-dvh flex-col bg-room text-ink">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-4 py-2" style={{ paddingTop: "calc(0.5rem + env(safe-area-inset-top, 0px))" }}>
        {event.iconUrl && <img src={event.iconUrl} alt="" className="h-7 w-7" />}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-bold">{event.title}</h1>
          <p className="text-sm text-muted">
            {session.date}, {live ? `live, ${Math.floor(Math.max(0, offsetNow) / 60)} min in` : now < session.startsAt ? "not started" : "ended"}. Replying as <span className="text-ink">{member.display_name}</span>
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={showSim} onChange={(e) => setShowSim(e.target.checked)} className="h-4 w-4 accent-brand" />
          Show simulated chat
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={onlyMentions} onChange={(e) => setOnlyMentions(e.target.checked)} className="h-4 w-4 accent-brand" />
          Mentions of me
        </label>
        <form action={signOut}>
          <button type="submit" className="rounded-md border border-line px-3 py-1.5 text-sm text-muted hover:text-ink">
            Sign out
          </button>
        </form>
      </header>

      {recent.length > 0 && (
        <div className="flex gap-2 overflow-x-auto border-b border-line px-4 py-2 text-sm">
          <span className="shrink-0 text-muted">In the room now:</span>
          {recent.map((p) => (
            <span key={p.registrant_id} className={`shrink-0 rounded-full px-2.5 py-0.5 ${p.ghosted ? "bg-panel text-muted line-through" : p.ip_blocked ? "bg-live/20 text-live" : "bg-panel"}`} title={p.ghosted ? "ghosted" : p.ip_blocked ? "IP blocked" : undefined}>
              {p.first_name}
              {p.source === "test" ? " (test)" : ""}
            </span>
          ))}
        </div>
      )}

      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-4 py-2">
        {shown.length === 0 && <p className="py-8 text-center text-muted">No messages yet.</p>}
        {shown.map((m) => (
          <div key={m.key} className={`flex gap-3 border-b border-line/60 py-2.5 ${m.deleted ? "opacity-40" : ""} ${m.mentionsMe ? "-mx-4 bg-brand/10 px-4" : ""}`}>
            <Avatar name={m.name} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className={`font-bold ${m.role === "moderator" ? "text-brand" : m.role === "simulated" ? "text-muted" : ""}`}>{m.name}</span>
                {m.role === "simulated" && <span className="text-xs text-muted">simulated</span>}
                {m.ghost && <span className="rounded bg-panel px-1.5 text-xs text-muted" title="Only they can see this">ghost</span>}
                <span className="ml-auto text-xs text-muted tabular-nums">{new Date(m.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
              </div>
              <p className={`whitespace-pre-wrap break-words text-[15px] ${m.deleted ? "line-through" : ""}`}>
                {splitMentions(m.body).map((part, i) => (part.mention ? <span key={i} className="font-bold text-brand">{part.text}</span> : <span key={i}>{part.text}</span>))}
              </p>
              {m.id !== undefined && !m.deleted && (
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {EMOJIS.map((e) => (
                    <button key={e} type="button" onClick={() => act({ action: "react", id: m.id, emoji: e })} className={`min-h-8 rounded-full px-2 text-sm hover:bg-line ${mine.has(`${m.id}:${e}`) ? "border border-brand bg-brand/15" : "bg-panel"}`} aria-pressed={mine.has(`${m.id}:${e}`)} aria-label={`React ${e}`}>
                      {e}
                      {m.reactions[e] ? <span className="ml-1 text-xs text-muted tabular-nums">{m.reactions[e]}</span> : null}
                    </button>
                  ))}
                  <button type="button" onClick={() => act({ action: "delete", id: m.id })} className="min-h-8 rounded-full px-2 text-sm text-muted hover:text-ink">
                    Delete
                  </button>
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
                        <button type="button" onClick={() => act({ action: person(m.registrantId)?.ghosted ? "unghost" : "ghost", registrant_id: m.registrantId })} className="min-h-8 rounded-full px-2 text-sm text-muted hover:text-ink" title="They keep chatting; only they see it">
                          {person(m.registrantId)?.ghosted ? "Unghost" : "Ghost"}
                        </button>
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
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={reply} className="border-t border-line p-3" style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}>
        <div className="flex items-end gap-2">
          <input value={text} onChange={(e) => setText(e.target.value.slice(0, 500))} placeholder={`Reply as ${member.display_name}…`} autoComplete="off" enterKeyHint="send" className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-panel px-3 text-base focus:border-brand focus:outline-none" />
          <button type="submit" disabled={!text.trim()} className="min-h-11 rounded-xl bg-brand px-4 font-bold text-white disabled:opacity-40">
            Send
          </button>
        </div>
        {error && <p className="pt-1 text-sm text-live">{error}</p>}
      </form>
    </div>
  );
}
