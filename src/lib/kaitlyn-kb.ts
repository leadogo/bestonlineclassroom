// Kaitlyn's knowledge base, the pure parts (SPEC-kaitlyn-knowledge.md): the key the model names per decision, the
// KNOWLEDGE block her prompt reads from `kaitlyn_kb`, the 9 AM digest's clock and text, the check that a humanizer rewrite
// kept William's facts, and the line she posts when she does not know and nobody is on the desk.

export type KbHandling = "open" | "answer" | "me" | "ignore";
export type KbRow = { key: string; question: string; answer: string | null; approved: string | null; /** When William approved the line; a rewrite waiting for his OK has `approved` text and no date, and stays out of her prompt. */ approved_at: string | null; handling: KbHandling; asked: number };

/** A slug: lowercase letters, digits and hyphens, 3 to 40 chars, no hyphen at either end. */
export const KB_KEY_RE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

export function kbKey(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const k = v.trim().toLowerCase();
  return KB_KEY_RE.test(k) ? k : null;
}

export function kbQuestion(v: unknown): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, 160) : "";
}

/** The block her system prompt carries: approved answers as Q/A, the keys William answers himself, the keys she skips, and every key she may name. Empty when the table is. */
export function knowledgeBlock(rows: KbRow[]): string {
  if (!rows.length) return "";
  // Only lines he approved: a rewrite still waiting for his OK on the Knowledge page (approved text, no date) is not hers yet.
  const answers = rows.filter((r) => r.handling === "answer" && r.approved?.trim() && r.approved_at);
  const me = rows.filter((r) => r.handling === "me");
  const skip = rows.filter((r) => r.handling === "ignore");
  const parts = [
    `KNOWLEDGE (William's approved answers: his words, in the shape he wants. When a question matches one, use its substance and its length, reworded to fit the line, never recited; a match counts as sure.)\n${answers.map((r) => `Q: ${r.question}\n   A: ${r.approved!.trim()}`).join("\n") || "(none yet)"}`,
  ];
  if (me.length) parts.push(`ALWAYS ASK_WILLIAM (he answers these himself; no draft needed)\n${me.map((r) => `- ${r.key}: ${r.question}`).join("\n")}`);
  if (skip.length) parts.push(`SKIP (never answer, never acknowledge)\n${skip.map((r) => `- ${r.key}: ${r.question}`).join("\n")}`);
  parts.push(`KEYS YOU MAY NAME (put the matching one in "kb"; coin a new lowercase-hyphen slug with a one-line question only when none matches)\n${rows.map((r) => `${r.key} (${r.question})`).join(" · ")}`);
  return parts.join("\n\n");
}

/** A line of hers the team fixed or removed (the kaitlyn_corrections view): the question as asked, what she said, and William's line when he gave one. */
export type Correction = { asked: string; said: string; fixed: string | null };

/** The block her prompt carries for the team's corrections, newest first: her line was wrong, William's is right. Empty when there are none. */
export function correctionsBlock(rows: Correction[]): string {
  if (!rows.length) return "";
  const one = (s: string) => s.replace(/\s+/g, " ").trim();
  return `CORRECTIONS (lines of yours the team fixed, reworded or removed, newest first. On a question like one of these, answer the way William did, in his words and his length, never the way you did. A removed line means say nothing like it.)\n${rows.map((r) => `Q: ${one(r.asked)}\n   you said: ${one(r.said) || "(nothing, you handed it to the desk)"}\n   ${r.fixed ? `William: ${one(r.fixed)}` : "removed by the team"}`).join("\n")}`;
}

/** A person William ghosted by hand (the kaitlyn_ghosts view, migration 038): the line it came from, their lines before it, the desk's reason chip. */
export type Ghost = { line: string; context: string[] | null; reason: string | null; /** how many times the team had answered them before that line (migration 039) */ answered?: number | null };

/** The block her prompt carries in place of the old static list (SPEC-kaitlyn-ghosts.md, B3): his hand, newest first, with the run-up so she sees the pattern and not just the words. Empty when there are none. */
export function ghostBlock(rows: Ghost[]): string {
  if (!rows.length) return "";
  const one = (s: string) => s.replace(/\s+/g, " ").trim();
  return `LINES THE TEAM GHOSTED (the line that got the person ghosted by hand, newest first; in brackets the desk's reason and what they said before it. Lines like these, in this run-up, are ghosts.)\n${rows.map((r) => {
    const notes = [r.reason ? one(r.reason) : null, r.answered ? `answered ${r.answered} time${r.answered === 1 ? "" : "s"} before` : null, r.context?.length ? `before it: ${r.context.map((c) => JSON.stringify(one(c))).join(" | ")}` : null].filter(Boolean);
    return `- ${one(r.line)}${notes.length ? ` (${notes.join("; ")})` : ""}`;
  }).join("\n")}`;
}

/** "Answered" for the digest and the audit (SPEC-kaitlyn-ghosts.md, E): a moderator line mentioning the person inside this window after their line. */
export const ANSWER_WINDOW_MS = 15 * 60_000;

/** Whether a moderator answered this person within the window of their line at `atMs`; her hand-off line (`handoffIds`) promises an answer and is not one. */
export function answeredWithin(atMs: number, rid: string, told: Array<{ id?: number; mentions: string[]; created_at: string }>, handoffIds: Set<number> = new Set()): boolean {
  return told.some((m) => {
    if (m.id !== undefined && handoffIds.has(m.id)) return false;
    if (!m.mentions.includes(rid)) return false;
    const t = new Date(m.created_at).getTime();
    return t >= atMs && t < atMs + ANSWER_WINDOW_MS;
  });
}

/** Whether the 9 AM digest is due: 9 o'clock in the team's zone and not yet sent today. `today` is the local date to record. */
export function digestDue(now: Date, lastOn: string | null, tz = "America/Edmonton"): { due: boolean; today: string } {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const today = `${get("year")}-${get("month")}-${get("day")}`;
  return { due: Number(get("hour")) % 24 === 9 && lastOn !== today, today };
}

/** Last night's lines by what became of them (SPEC-kaitlyn-solo.md, F): `stood` = posted and left alone (auto, sent as drafted); the rest the desk changed. `posted` is the sum. */
export type Posted = { posted: number; stood: number; fixed: number; deleted: number; edited: number; wrong: number };

/** The counts from the night's decision rows: auto and sent stood; edited, fixed and deleted were changed; a skip marked wrong is a line that would have been wrong. */
export function postedFrom(rows: Array<{ status: string; skip_reason?: string | null }>): Posted {
  const p: Posted = { posted: 0, stood: 0, fixed: 0, deleted: 0, edited: 0, wrong: 0 };
  for (const r of rows) {
    if (r.status === "auto" || r.status === "sent") p.stood++;
    else if (r.status === "fixed") p.fixed++;
    else if (r.status === "deleted") p.deleted++;
    else if (r.status === "edited") p.edited++;
    else if (r.status === "skipped" && r.skip_reason === "wrong") p.wrong++;
    else continue;
    p.posted++;
  }
  return p;
}

/** The Slack line for #autoweb-intel; null when there is nothing to say. `unanswered` and `ghosted` (SPEC-kaitlyn-ghosts.md, E2): who got no answer last night and who was ghosted by hand, so the audit is read every morning. `posted` (SPEC-kaitlyn-solo.md, F) is the agreement line; `stale` (G) names staged answers older than a week. */
export function digestText(o: { questions: Array<{ question: string; asked: number }>; people: number; waiting: number; url: string; unanswered?: string[]; ghosted?: Array<{ name: string; reason: string | null }>; posted?: Posted; stale?: string[] }): string | null {
  const n = o.questions.length;
  const plural = (k: number, one: string, many: string) => (k === 1 ? one : many);
  const lines: string[] = [];
  if (n) {
    lines.push(
      `Kaitlyn couldn't answer ${n} ${plural(n, "question", "questions")} last night (${o.people} ${plural(o.people, "person", "people")} asked):`,
      ...o.questions.map((q) => `• ${q.question}${q.asked > 1 ? ` (×${q.asked})` : ""}`),
      `Answer ${plural(n, "it", "them")}: ${o.url}`,
    );
    if (o.waiting) lines.push(`${o.waiting} ${plural(o.waiting, "answer is", "answers are")} waiting for your OK.`);
  } else if (o.waiting) lines.push(`${o.waiting} of Kaitlyn's answers ${plural(o.waiting, "is", "are")} waiting for your OK: ${o.url}`);
  const u = o.unanswered ?? [];
  if (u.length) lines.push(`Last night ${u.length} ${plural(u.length, "person", "people")} went unanswered: ${u.join(", ")}.`);
  const g = o.ghosted ?? [];
  if (g.length) lines.push(`You ghosted ${g.length} by hand: ${g.map((x) => (x.reason ? `${x.name} (${x.reason})` : x.name)).join(", ")}.`);
  const p = o.posted;
  if (p?.posted) {
    const changed = [[p.fixed, "fixed"], [p.deleted, "deleted"], [p.edited, "edited before sending"], [p.wrong, "skipped as wrong"]].filter(([n]) => n).map(([n, w]) => `${n} you ${w}`);
    lines.push(`Kaitlyn posted ${p.posted} last night: ${p.stood} stood${changed.length ? `, ${changed.join(", ")}` : ""} (agreement ${Math.round((100 * p.stood) / p.posted)}%).`);
  }
  const st = o.stale ?? [];
  if (st.length) lines.push(`${st.length} ${plural(st.length, "answer has", "answers have")} waited over a week for your OK: ${st.join(", ")}. ${o.url}`);
  return lines.length ? lines.join("\n") : null;
}

/** Facts in William's words that a rewrite dropped: numbers, dollar figures, links, and names (capitalised words that do not start a sentence). Empty when the rewrite kept them all. */
export function factsLost(original: string, rewrite: string): string[] {
  const low = rewrite.toLowerCase();
  const out: string[] = [];
  const seen = new Set<string>();
  const need = (t: string) => { if (!seen.has(t)) { seen.add(t); if (!low.includes(t.toLowerCase())) out.push(t); } };
  for (const m of original.matchAll(/\d+(?:[.,]\d+)*/g)) need(m[0]);
  for (const m of original.matchAll(/\b[\w-]+\.(?:com|ai|ca|net|org|io)\b/gi)) need(m[0]);
  for (const sentence of original.split(/(?<=[.!?])\s+|\n+/)) {
    for (const w of sentence.trim().split(/\s+/).slice(1)) {
      const c = w.replace(/[^\w'-]/g, "");
      if (/^[A-Z][a-z]+/.test(c) && c !== "I") need(c);
    }
  }
  return out;
}

const HANDOFF = [
  "good one, I'll get the team to answer that properly and they'll follow up with you",
  "let me pass that to the team so you get a proper answer, they'll reach out",
  "I'll flag that for the team, they'll follow up with you on it",
  "that one's better from the team, I'll have them follow up with you",
];

/** What she posts, once per person per night, when she does not know and nobody is on the desk (SPEC-kaitlyn-autopilot.md, decision 5). */
export function handoffLine(pick: () => number = Math.random): string {
  return HANDOFF[Math.min(HANDOFF.length - 1, Math.floor(pick() * HANDOFF.length))];
}
