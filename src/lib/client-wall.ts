// The client wall (SPEC-phase7.md): the snapshot bms-dashboard pushes every 30 minutes, normalized to the keys the
// database matches on (lowercased email, its hash, the last ten digits of a phone). Matching itself lives in SQL
// (client_wall_hit) so the insert trigger and the sync agree by construction.
import { db } from "./db.ts";
import { emailHash, normalizeEmail } from "./registrants.ts";
import { postToIntel } from "./slack.ts";

export type WallRow = { client_id: string; name: string | null; status: string | null; emails: string[]; email_hashes: string[]; phones: string[]; client_since: string | null };

/** A snapshot smaller than this is a bug upstream, not a directory; refusing it keeps a bad push from releasing everyone. */
export const MIN_SNAPSHOT = 100;
/** More than this many people walled in one sync is a bad snapshot; the database refuses and we tell Slack. */
export const FLAG_CAP = 300;

export function phoneKey(raw: unknown): string | null {
  const d = String(raw ?? "").replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-10) : null;
}

/** Rows the wall can match on; a client with no usable email or phone is dropped, duplicates collapse. */
export function normalizeClients(raw: unknown): WallRow[] {
  if (!Array.isArray(raw)) return [];
  const out: WallRow[] = [];
  for (const c of raw as Array<Record<string, unknown> | null>) {
    const id = String(c?.id ?? "").trim();
    if (!c || !id) continue;
    const emails = [...new Set((Array.isArray(c.emails) ? c.emails : []).map(normalizeEmail).filter((e): e is string => Boolean(e)))];
    const phones = [...new Set((Array.isArray(c.phones) ? c.phones : []).map(phoneKey).filter((p): p is string => Boolean(p)))];
    if (!emails.length && !phones.length) continue;
    const since = typeof c.since === "string" && !Number.isNaN(Date.parse(c.since)) ? new Date(c.since).toISOString() : null;
    out.push({ client_id: id.slice(0, 80), name: typeof c.name === "string" ? c.name.slice(0, 120) : null, status: typeof c.status === "string" ? c.status.slice(0, 40) : null, emails, email_hashes: emails.map(emailHash), phones, client_since: since });
  }
  return out;
}

/** One line to #autoweb-intel the first time in an hour a walled client opens a link; reloads stay quiet. */
export async function tellWallHit(r: { id: string; first_name: string; email: string | null; session_date: string }, eventTitle: string, path: "join" | "replay"): Promise<void> {
  const since = new Date(Date.now() - 3_600_000).toISOString();
  const { count } = await db().from("link_clicks").select("id", { count: "exact", head: true }).eq("registrant_id", r.id).eq("outcome", "walled").gte("at", since);
  if ((count ?? 0) > 1) return;
  await postToIntel(`🚧 Client wall: ${r.first_name}${r.email ? ` (${r.email})` : ""} opened the ${path} link for ${eventTitle} ${r.session_date} and got the 404.`);
}
