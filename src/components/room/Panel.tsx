"use client";
// The right-hand panel, Zoom style: Chat and People tabs. Chat arrives with the chat module; People lists the
// host, the simulated attendees and the real ones seen in the last two minutes.
import { useEffect, useState } from "react";

type Person = { name: string; role: "host" | "attendee" };

export function Panel({ token, firstName, hostName, simulatedNames, live, offset, sessionDate }: { token: string; firstName: string; hostName: string; simulatedNames: string[]; live: boolean; offset: number; sessionDate: string }) {
  const [tab, setTab] = useState<"chat" | "people">("chat");
  const [real, setReal] = useState<string[]>([firstName]);

  useEffect(() => {
    if (!live) return;
    let stop = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/people?token=${encodeURIComponent(token)}`, { cache: "no-store" });
        const j = (await res.json()) as { names?: string[] };
        if (!stop && Array.isArray(j.names)) setReal(j.names);
      } catch {
        /* keep the last list */
      }
    };
    load();
    const id = setInterval(load, 30_000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [live, token]);

  const people: Person[] = [{ name: hostName, role: "host" }, ...real.map((n) => ({ name: n, role: "attendee" as const })), ...simulatedNames.map((n) => ({ name: n, role: "attendee" as const }))];
  const count = people.length;

  return (
    <aside className="flex h-[45dvh] min-h-0 flex-col border-t border-slate-800 lg:h-auto lg:w-[360px] lg:border-l lg:border-t-0">
      <div className="flex border-b border-slate-800 text-sm">
        <Tab active={tab === "chat"} onClick={() => setTab("chat")}>
          Chat
        </Tab>
        <Tab active={tab === "people"} onClick={() => setTab("people")}>
          People <span className="ml-1 rounded bg-slate-800 px-1.5 text-xs tabular-nums text-slate-300">{count}</span>
        </Tab>
      </div>
      {tab === "chat" ? (
        <div className="flex flex-1 items-center justify-center p-4 text-center text-sm text-slate-500">{live ? "Chat is loading…" : "Chat opens when the session starts."}</div>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto py-1">
          {people.map((p, i) => (
            <li key={`${p.name}-${i}`} className="flex items-center gap-3 px-4 py-1.5 text-sm">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-800 text-xs font-medium text-slate-200">{initials(p.name)}</span>
              <span className="truncate">{p.name}</span>
              {p.role === "host" && <span className="ml-auto text-xs text-slate-500">Host</span>}
            </li>
          ))}
        </ul>
      )}
      <span className="sr-only">{`${sessionDate} ${offset}`}</span>
    </aside>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`flex-1 px-3 py-2.5 ${active ? "border-b-2 border-sky-400 font-medium text-white" : "text-slate-400 hover:text-slate-200"} focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500`}>
      {children}
    </button>
  );
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}
