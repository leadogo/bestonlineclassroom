"use client";
// The side of the room: Chat and People. Chat stays mounted behind the People tab so it keeps up and can show
// an unread count. Large tabs, nothing to learn.
import { useEffect, useState } from "react";
import type { SimulatedRow } from "@/lib/chat";
import { ChatPanel } from "./ChatPanel";
import { PeoplePanel } from "./PeoplePanel";

export function Panel({ token, firstName, hostName, simulatedNames, simulated, live, expected, onCount }: { token: string; firstName: string; hostName: string; simulatedNames: string[]; simulated: SimulatedRow[]; live: boolean; expected: () => number; onCount: (n: number) => void }) {
  const [tab, setTab] = useState<"chat" | "people">("chat");
  const [unread, setUnread] = useState(0);
  const [real, setReal] = useState<string[]>([]);

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

  const realNames = real.includes(firstName) ? real : [firstName, ...real];
  const count = 1 + realNames.length + simulatedNames.length;
  useEffect(() => onCount(count), [count, onCount]);

  return (
    <aside className="flex min-h-0 flex-1 flex-col bg-room lg:w-[380px] lg:flex-none lg:border-l lg:border-line landscape-phone:w-[40%] landscape-phone:flex-none landscape-phone:border-l landscape-phone:border-line">
      <div className="flex border-b border-line">
        <Tab active={tab === "chat"} onClick={() => { setTab("chat"); setUnread(0); }}>
          Chat
          {tab !== "chat" && unread > 0 && <span className="ml-2 rounded-full bg-brand px-2 py-0.5 text-xs font-bold text-white tabular-nums">{unread > 99 ? "99+" : unread}</span>}
        </Tab>
        <Tab active={tab === "people"} onClick={() => setTab("people")}>
          People
          <span className="ml-2 rounded-full bg-panel px-2 py-0.5 text-xs text-muted tabular-nums">{count}</span>
        </Tab>
      </div>
      <div className="min-h-0 flex-1" hidden={tab !== "chat"}>
        <ChatPanel token={token} firstName={firstName} simulated={simulated} live={live} expected={expected} visible={tab === "chat"} onUnread={() => setUnread((n) => n + 1)} />
      </div>
      <div className="min-h-0 flex-1" hidden={tab !== "people"}>
        <PeoplePanel hostName={hostName} you={firstName} realNames={realNames} simulatedNames={simulatedNames} />
      </div>
    </aside>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-11 flex-1 items-center justify-center px-3 text-base ${active ? "border-b-2 border-brand font-bold text-ink" : "text-muted hover:text-ink"} focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand`}
    >
      {children}
    </button>
  );
}
