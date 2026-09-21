// An event row as the room and the webhook read it, cached for a minute per slug so a burst of joiners at 5 PM
// costs one query. The admin UI (phase 2) will write these rows; tonight the seed script does.
import { db } from "./db.ts";

export type EventRow = {
  id: string;
  slug: string;
  title: string;
  host_name: string;
  host_avatar_url: string | null;
  host_tagline: string | null;
  timezone: string;
  start_time: string;
  video_url: string | null;
  video_seconds: number | null;
  cta_at_seconds: number | null;
  cta_hide_seconds: number | null;
  cta_label: string | null;
  cta_href: string | null;
  cta_title: string | null;
  cta_subtitle: string | null;
  cta_icon_url: string | null;
  cta_strip_icon_url: string | null;
  artwork_url: string | null;
  captions_url: string | null;
  end_url: string;
  simulated_names: string[];
  logo_url: string | null;
  icon_url: string | null;
  chapters: Array<{ at: number; label: string }>;
  replay_hours: number;
  replay_copy: Record<string, unknown>;
  tags: Record<string, string>;
  reminder_rules: Array<{ key: string; minutes_before: number; subject: string; body: string }>;
  days: number[];
  confirmation: { subject?: string; body?: string; footer?: boolean };
};

const TTL_MS = 60_000;
const cache = new Map<string, { at: number; row: EventRow | null }>();

export function forgetEvent(slug: string): void {
  cache.delete(slug);
}

export async function getEvent(slug: string): Promise<EventRow | null> {
  const hit = cache.get(slug);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.row;
  const { data, error } = await db().from("events").select("*").eq("slug", slug).maybeSingle();
  if (error) throw error;
  const row = (data as EventRow | null) ?? null;
  cache.set(slug, { at: Date.now(), row });
  return row;
}
