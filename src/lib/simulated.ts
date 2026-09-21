// The simulated chat for an event, read once a minute at most and handed to the room with the page so the chat
// is full the moment it opens (754 rows is about 60 KB, cheaper than a second round trip on a phone).
import type { SimulatedRow } from "./chat.ts";
import { db } from "./db.ts";

const TTL_MS = 60_000;
const cache = new Map<string, { at: number; rows: SimulatedRow[] }>();

export async function getSimulatedRows(eventId: string): Promise<SimulatedRow[]> {
  const hit = cache.get(eventId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.rows;
  const { data, error } = await db().from("simulated_messages").select("offset_seconds, name, body").eq("event_id", eventId).order("offset_seconds").order("id");
  if (error) throw error;
  const rows = (data ?? []) as SimulatedRow[];
  cache.set(eventId, { at: Date.now(), rows });
  return rows;
}
