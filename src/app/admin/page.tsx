import Link from "next/link";
import { currentOrNextSession, scheduleOf } from "@/lib/daily-schedule";
import { db } from "@/lib/db";
import type { EventRow } from "@/lib/events";

export default async function AdminHome() {
  const { data } = await db().from("events").select("*").order("created_at");
  const events = (data ?? []) as EventRow[];
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Events</h1>
      <ul className="grid gap-3 sm:grid-cols-2">
        {events.map((e) => {
          const next = currentOrNextSession(scheduleOf(e));
          return (
            <li key={e.id} className="rounded-xl border border-line bg-panel p-4">
              <Link href={`/admin/events/${e.slug}`} className="text-lg font-bold hover:underline">
                {e.title}
              </Link>
              <p className="mt-1 text-sm text-muted">
                {(e.days ?? []).length === 7 ? "Daily" : (e.days ?? []).map((d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d]).join(", ")} at {e.start_time.slice(0, 5)} {e.timezone}. Next: {next.date}. {e.video_seconds ? `${Math.round(e.video_seconds / 60)} min video.` : "No video yet."}
              </p>
              <div className="mt-3 flex flex-wrap gap-3 text-sm">
                <Link href={`/admin/events/${e.slug}`} className="text-brand underline">
                  Settings
                </Link>
                <Link href={`/admin/events/${e.slug}/sessions/${next.date}`} className="text-brand underline">
                  Registrants for {next.date}
                </Link>
                <Link href={`/mod?event=${e.slug}`} className="text-brand underline">
                  Moderate
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
