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
};

export type ChatUpdate = { id: number; reactions: Record<string, number>; deleted: boolean };

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
    out.push({ ...item, reactions: u.reactions });
  }
  return out;
}

export const MAX_BODY = 500;
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

/** Splits a body into plain text and `@Name` runs (a capitalized word, optionally followed by more capitalized words). */
// ponytail: name = capitalized words after "@"; "@Sam from William's team" highlights "@Sam". Store names on the row if it matters.
export function splitMentions(body: string): Array<{ text: string; mention: boolean }> {
  const out: Array<{ text: string; mention: boolean }> = [];
  const re = /@([A-Z][\w'’-]*(?: [A-Z][\w'’-]*)*)/g;
  let last = 0;
  for (const m of body.matchAll(re)) {
    if (m.index > last) out.push({ text: body.slice(last, m.index), mention: false });
    out.push({ text: m[0], mention: true });
    last = m.index + m[0].length;
  }
  if (last < body.length) out.push({ text: body.slice(last), mention: false });
  return out;
}
