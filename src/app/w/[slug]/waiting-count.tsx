"use client";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/room/PeoplePanel";

/**
 * "Agents waiting: 92 and climbing" (Jeremy, Sep 23): the room's own crowd arriving. From fifteen minutes out the
 * number starts at `floor` and climbs to the crowd the People tab shows at the start, real openers added on top;
 * every 30 seconds, no reload. Hidden outside the window; at the start the poster bar takes over with the real count.
 */
export function WaitingCount({ startsAt, crowd, realOpeners, names, floor = 90, windowMinutes = 15 }: { startsAt: number; crowd: number; realOpeners: number; names: string[]; floor?: number; windowMinutes?: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const windowMs = windowMinutes * 60_000;
  const t = startsAt - now;
  if (t <= 0 || t > windowMs) return null;
  const progress = 1 - t / windowMs;
  const target = Math.max(floor, crowd);
  const n = Math.round(floor + (target - floor) * Math.pow(progress, 1.2)) + realOpeners;
  return (
    <div className="mt-3 flex items-center gap-3 text-sm" aria-live="polite">
      <div className="flex">
        {names.slice(0, 3).map((name, i) => (
          <span key={name} className={i ? "-ml-1.5" : ""}><Avatar name={name} size="h-6 w-6 text-[9px] ring-2 ring-panel" /></span>
        ))}
      </div>
      <p>Agents waiting: <b className="tabular-nums">{n}</b> and climbing</p>
    </div>
  );
}
