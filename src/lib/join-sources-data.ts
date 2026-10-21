// The room's rows for one session, shaped for joinSources(). Server only.
import { db } from "@/lib/db";
import { isPerson } from "@/lib/outcomes";
import { joinSources, type JoinSourcesResult } from "@/lib/join-sources";

export async function loadJoinSources(eventId: string, sessionDate: string, ctaAtSeconds: number): Promise<JoinSourcesResult> {
  const [clicks, joins, bookings] = await Promise.all([
    db().from("link_clicks").select("registrant_id, at, src, outcome").eq("event_id", eventId).eq("session_date", sessionDate).eq("path", "j"),
    db().from("attendance").select("registrant_id, joined_at, max_offset, seconds_watched, cta_clicked_at, registrant:registrants!inner(source)").eq("session_date", sessionDate).eq("kind", "live").eq("registrants.event_id", eventId),
    db().from("bookings").select("registrant_id").eq("event_id", eventId).eq("session_date", sessionDate).eq("status", "scheduled"),
  ]);
  return joinSources({
    clicks: (clicks.data ?? []) as Array<{ registrant_id: string | null; at: string; src: string | null; outcome: string }>,
    joins: (joins.data ?? []).filter((j) => (j.registrant as unknown as { source: string }).source !== "test" && isPerson({ seconds_watched: (j.seconds_watched as number | null) ?? 0, cta_clicked_at: (j.cta_clicked_at as string | null) ?? null })).map((j) => ({ registrant_id: j.registrant_id as string, joined_at: j.joined_at as string, max_offset: j.max_offset as number, source: (j.registrant as unknown as { source: string }).source })),
    bookings: (bookings.data ?? []) as Array<{ registrant_id: string | null }>,
    ctaAtSeconds,
  });
}
