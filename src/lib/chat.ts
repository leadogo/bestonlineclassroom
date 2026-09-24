// The chat's pure logic (SPEC-chat.md): which simulated messages have "happened" by a given video offset, how a
// poll's changes fold into the list on screen, the posting rule, and the Slack line. Tested without a browser.

export type SimulatedRow = { offset_seconds: number; name: string; body: string };

export type ChatItem = {
  key: string;
  id?: number;
  name: string;
  role: "attendee" | "moderator" | "simulated";
  body: string;
  /** ms since epoch when it appeared on this client */
  at: number;
  reactions: Record<string, number>;
  mine?: boolean;
  /** The names this row @mentions (stored with the row); only these are coloured. */
  mentionNames?: string[];
  /** "cta": Katherine's book-now row, drawn by each viewer with their own link. */
  kind?: string;
};

export type ChatUpdate = { id: number; reactions: Record<string, number>; deleted: boolean; /** set when the author renamed themselves */ name?: string };

/** Rows from `nextIndex` whose offset is at or before `offset`. The first call (nextIndex 0) yields the whole history. */
export function simulatedCursor(rows: SimulatedRow[], offset: number, nextIndex: number): { items: SimulatedRow[]; nextIndex: number } {
  let i = nextIndex;
  while (i < rows.length && rows[i].offset_seconds <= offset) i++;
  return { items: rows.slice(nextIndex, i), nextIndex: i };
}

/** Applies deletions and reaction changes in place of the matching real messages; unknown ids are ignored. */
export function mergeUpdates(list: ChatItem[], updates: ChatUpdate[]): ChatItem[] {
  if (updates.length === 0) return list;
  const byId = new Map(updates.map((u) => [u.id, u]));
  const out: ChatItem[] = [];
  for (const item of list) {
    const u = item.id !== undefined ? byId.get(item.id) : undefined;
    if (!u) { out.push(item); continue; }
    if (u.deleted) continue;
    out.push({ ...item, reactions: u.reactions, ...(u.name ? { name: u.name } : {}) });
  }
  return out;
}

export const MAX_BODY = 500;

/** A North American phone number in the usual shapes; prices, years and deal counts do not match. */
export const PHONE_RE = /(?:\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/;
export const POST_GAP_MS = 2000;

export function canPost(lastPostedAt: number | null, now: number): boolean {
  return lastPostedAt === null || now - lastPostedAt >= POST_GAP_MS;
}

/** What #autoweb-chat has always received: `Name / Email / Question`. Guests have no email. */
export function slackLine(name: string, email: string | null, body: string): string {
  return `${name} / ${email || "guest"} / ${body}`;
}

/** Keeps the newest `max` items so a long session never grows the DOM without bound. */
export function trimList(list: ChatItem[], max = 400): ChatItem[] {
  return list.length > max ? list.slice(list.length - max) : list;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Splits a body into plain text and `@Name` runs. With `names` (the ones stored on the row), exactly those names
 * are matched, longest first, so "@Will Great point" colours only "@Will". Without names (the crowd's rows), one
 * word after "@".
 */
export function splitMentions(body: string, names?: string[]): Array<{ text: string; mention: boolean }> {
  const out: Array<{ text: string; mention: boolean }> = [];
  const list = (names ?? []).filter((n) => n.trim()).sort((a, b) => b.length - a.length);
  const re = list.length ? new RegExp(`@(?:${list.map(escapeRe).join("|")})(?![\\w'’-])`, "g") : /@[A-Z][\w'’-]*/g;
  let last = 0;
  for (const m of body.matchAll(re)) {
    if (m.index > last) out.push({ text: body.slice(last, m.index), mention: false });
    out.push({ text: m[0], mention: true });
    last = m.index + m[0].length;
  }
  if (last < body.length) out.push({ text: body.slice(last), mention: false });
  return out;
}

export type BodyPart = { text: string; kind: "text" | "mention" | "link" };
const URL_RE = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi;

/** The parts a chat row draws: mentions, and, for team messages only (`links`), clickable URLs. A trailing period stays text. */
export function splitBody(body: string, names?: string[], links = false): BodyPart[] {
  const out: BodyPart[] = [];
  const plain = (text: string) => { for (const p of splitMentions(text, names)) if (p.text) out.push({ text: p.text, kind: p.mention ? "mention" : "text" }); };
  if (!links) { plain(body); return out; }
  let last = 0;
  for (const m of body.matchAll(URL_RE)) {
    let url = m[0];
    const trail = /[.,;:!?)]+$/.exec(url);
    if (trail) url = url.slice(0, -trail[0].length);
    if (m.index > last) plain(body.slice(last, m.index));
    out.push({ text: url, kind: "link" });
    last = m.index + url.length;
  }
  if (last < body.length) plain(body.slice(last));
  return out;
}

/** The desk keeps every real row; only the crowd is capped, so showing the crowd again never drops a real message. */
export function trimCrowd<T extends { role: string }>(list: T[], maxSim = 300): T[] {
  let sim = 0;
  for (const x of list) if (x.role === "simulated") sim++;
  if (sim <= maxSim) return list;
  let drop = sim - maxSim;
  return list.filter((x) => (x.role === "simulated" && drop > 0 ? (drop--, false) : true));
}
