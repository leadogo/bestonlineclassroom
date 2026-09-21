"use client";
// The strip at the top of a webinar card, on the client so it turns red at the start second without a refresh.
// While a session is near or running, the page's data is refreshed every 60 s for the counts.
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function LiveStrip({ startsAt, endsAt, serverNow, inRoom, nextText, scheduleText }: { startsAt: number; endsAt: number; serverNow: number; inRoom: number; nextText: string; scheduleText: string }) {
  const router = useRouter();
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    const skew = serverNow - Date.now();
    const id = setInterval(() => setNow(Date.now() + skew), 1000);
    return () => clearInterval(id);
  }, [serverNow]);
  const live = startsAt <= now && now < endsAt;
  const near = now >= startsAt - 5 * 60_000 && now < endsAt;
  useEffect(() => {
    if (!near) return;
    const id = setInterval(() => router.refresh(), 60_000);
    return () => clearInterval(id);
  }, [near, router]);
  const ms = startsAt - now;
  const until = ms < 3_600_000 ? `in ${Math.max(1, Math.round(ms / 60_000))} min` : ms < 86_400_000 ? `in ${Math.round(ms / 3_600_000)} h` : `in ${Math.round(ms / 86_400_000)} days`;
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm ${live ? "bg-live/15" : "border-b border-line"}`}>
      {live ? (
        <>
          <span className="flex items-center gap-2 font-bold text-live">
            <span className="h-2.5 w-2.5 rounded-full bg-live live-dot" aria-hidden />
            Live now
          </span>
          <span className="tabular-nums">{inRoom} in the room</span>
          <span className="text-muted tabular-nums">{Math.floor((now - startsAt) / 60_000)} min in</span>
        </>
      ) : now >= endsAt ? (
        <span className="font-bold text-muted">Session over</span>
      ) : (
        <>
          <span className="font-bold">Next session {nextText}</span>
          <span className="text-muted">{until}</span>
        </>
      )}
      <span className="ml-auto text-muted">{scheduleText}</span>
    </div>
  );
}
