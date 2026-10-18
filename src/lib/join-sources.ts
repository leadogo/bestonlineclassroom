// Which link brought each person into the room (pure). A personal link carries ?src=email|sms|calendar; a Skool
// guest came through the open door with src=skool; everything else is "direct" (the thank-you page, a saved tab).
// A join is credited to the person's LAST tagged click before they joined; a booking follows its person's join.
export const JOIN_SOURCES = ["email", "sms", "skool", "calendar", "direct"] as const;
export type JoinSource = (typeof JOIN_SOURCES)[number];

export type ClickRow = { registrant_id: string | null; at: string; src: string | null; outcome: string };
export type JoinRow = { registrant_id: string; joined_at: string; max_offset: number; source?: string | null };
export type BookingRow = { registrant_id: string | null };
export type SourceCounts = { clicked: number; joined: number; at_pitch: number; booked: number };
export type JoinSourcesResult = Record<JoinSource, SourceCounts>;

export function normalizeSrc(src: string | null | undefined): JoinSource | null {
  const s = (src ?? "").trim().toLowerCase();
  if (s === "email" || s === "sms" || s === "skool" || s === "calendar") return s;
  return null;
}

const empty = (): SourceCounts => ({ clicked: 0, joined: 0, at_pitch: 0, booked: 0 });

export function joinSources(input: { clicks: ClickRow[]; joins: JoinRow[]; bookings: BookingRow[]; ctaAtSeconds: number }): JoinSourcesResult {
  const out = Object.fromEntries(JOIN_SOURCES.map((s) => [s, empty()])) as JoinSourcesResult;
  const clickedBy = new Map<JoinSource, Set<string>>(JOIN_SOURCES.map((s) => [s, new Set<string>()]));
  const tagged = new Map<string, Array<{ atMs: number; src: JoinSource }>>();
  for (const c of input.clicks) {
    const src = normalizeSrc(c.src);
    if (!c.registrant_id || !src) continue;
    clickedBy.get(src)!.add(c.registrant_id);
    const list = tagged.get(c.registrant_id) ?? [];
    list.push({ atMs: Date.parse(c.at), src });
    tagged.set(c.registrant_id, list);
  }
  for (const [src, people] of clickedBy) out[src].clicked = people.size;

  const sourceOf = new Map<string, JoinSource>();
  const seen = new Set<string>();
  for (const j of input.joins) {
    if (seen.has(j.registrant_id)) continue;
    seen.add(j.registrant_id);
    const joinedMs = Date.parse(j.joined_at) + 60_000;
    const before = (tagged.get(j.registrant_id) ?? []).filter((c) => c.atMs <= joinedMs).sort((a, b) => b.atMs - a.atMs);
    const src: JoinSource = before[0]?.src ?? (j.source === "skool" ? "skool" : "direct");
    sourceOf.set(j.registrant_id, src);
    out[src].joined++;
    if (j.max_offset >= input.ctaAtSeconds) out[src].at_pitch++;
  }
  for (const b of input.bookings) {
    if (!b.registrant_id) continue;
    const src = sourceOf.get(b.registrant_id) ?? (tagged.get(b.registrant_id)?.sort((a, c) => c.atMs - a.atMs)[0]?.src ?? "direct");
    out[src].booked++;
  }
  return out;
}

export function joinSourcesLine(title: string, date: string, r: JoinSourcesResult): string {
  const part = (s: JoinSource) => `${s} ${r[s].joined}${r[s].booked ? ` (${r[s].booked} booked)` : ""}`;
  const clicks = JOIN_SOURCES.filter((s) => s !== "direct").map((s) => `${s} ${r[s].clicked}`).join(" · ");
  return `🔗 *Joins by source, ${title} ${date}:* ${JOIN_SOURCES.map(part).join(" · ")} · link clicks: ${clicks}`;
}
