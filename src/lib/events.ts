// An event row as the room and the webhook read it, cached for a minute per slug so a burst of joiners at 5 PM
// costs one query. The admin UI (phase 2) will write these rows; tonight the seed script does.
import { db } from "./db.ts";

export type EventRow = {
  id: string;
  slug: string;
  title: string;
  host_name: string;
  timezone: string;
  start_time: string;
  video_url: string | null;
  video_seconds: number | null;
  cta_at_seconds: number | null;
  cta_hide_seconds: number | null;
  cta_label: string | null;
  cta_href: string | null;
  end_url: string;
  simulated_names: string[];
  logo_url: string | null;
  icon_url: string | null;
};

const TTL_MS = 60_000;
const cache = new Map<string, { at: number; row: EventRow | null }>();

export async function getEvent(slug: string): Promise<EventRow | null> {
  const hit = cache.get(slug);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.row;
  const { data, error } = await db().from("events").select("*").eq("slug", slug).maybeSingle();
  if (error) throw error;
  const row = (data as EventRow | null) ?? null;
  cache.set(slug, { at: Date.now(), row });
  return row;
}
