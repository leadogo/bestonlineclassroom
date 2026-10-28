// Kaitlyn's knowledge base, the pure parts (SPEC-kaitlyn-knowledge.md): the key the model names per decision, the
// KNOWLEDGE block her prompt reads from `kaitlyn_kb`, the 9 AM digest's clock and text, the check that a humanizer rewrite
// kept William's facts, and the line she posts when she does not know and nobody is on the desk.
import { clipWords, escapeMrkdwn, HEADLINE_MAX_WORDS, williamMention, type Notice } from "./slack.ts";

export type KbHandling = "open" | "answer" | "me" | "ignore" | "ghost";
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
  const ghost = rows.filter((r) => r.handling === "ghost");
  const parts = [
    `KNOWLEDGE (William's approved answers: his words, in the shape he wants. When a question matches one, use its substance and its length, reworded to fit the line, never recited; a match counts as sure.)\n${answers.map((r) => `Q: ${r.question}\n   A: ${r.approved!.trim()}`).join("\n") || "(none yet)"}`,
  ];
  if (me.length) parts.push(`ALWAYS ASK_WILLIAM (he answers these himself; no draft needed)\n${me.map((r) => `- ${r.key}: ${r.question}`).join("\n")}`);
  if (skip.length) parts.push(`SKIP (never answer, never acknowledge)\n${skip.map((r) => `- ${r.key}: ${r.question}`).join("\n")}`);
  if (ghost.length) parts.push(`GHOST (William: a line that means this is a ghost, sure, on the spot; category negative, no text)\n${ghost.map((r) => `- ${r.key}: ${r.question}`).join("\n")}`);
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

/** Whether a moderator answered this person within the window of their line at `atMs`; a hand-off line of hers from before Oct 23 (`handoffIds`, the line is gone since SPEC-friday-unattended.md B) promised an answer and is not one. */
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
  // From 9 for the rest of the day: a Slack hiccup at 9 is retried at 10, and the once-a-day guard keeps it to one post (review of Oct 21).
  return { due: Number(get("hour")) % 24 >= 9 && lastOn !== today, today };
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
/** The owed line only from here (SPEC-post-session.md, B): a quiet night owes a handful between runs; a stalled push owes hundreds. */
export const OWED_FLOOR = 50;

export function digestNotice(o: { questions: Array<{ question: string; asked: number }>; people: number; waiting: number; url: string; unanswered?: string[]; ghosted?: Array<{ name: string; reason: string | null }>; posted?: Posted; stale?: string[]; /** outcome tags still to push to ActiveCampaign (SPEC-post-session.md, B) */ owed?: number; /** the last link sweep's counts (SPEC-friday-unattended.md, E4): a Zap that stops writing shows here the next morning */ links?: { at?: string; written: number; created: number; pending: number; prev?: { at: string; written: number; created: number; pending: number } | null } | null; now?: Date }): Notice | null {
  const n = o.questions.length;
  const plural = (k: number, one: string, many: string) => (k === 1 ? one : many);
  // The thread: the questions, the link, and every audit line; the channel post keeps the ask and the agreement numbers.
  const lines: string[] = [];
  if (n) lines.push(...o.questions.map((q) => `• ${escapeMrkdwn(q.question)}${q.asked > 1 ? ` (×${q.asked})` : ""}`));
  if (n || o.waiting) lines.push(`${n ? `Answer ${plural(n, "it", "them")}` : "Approve"}: ${o.url}`);
  const u = o.unanswered ?? [];
  if (u.length) lines.push(`Last night ${u.length} ${plural(u.length, "person", "people")} went unanswered: ${u.map(escapeMrkdwn).join(", ")}.`);
  const g = o.ghosted ?? [];
  if (g.length) lines.push(`You ghosted ${g.length} by hand: ${g.map((x) => (x.reason ? `${escapeMrkdwn(x.name)} (${escapeMrkdwn(x.reason)})` : escapeMrkdwn(x.name))).join(", ")}.`);
  const p = o.posted;
  if (p?.posted) {
    const changed = [[p.fixed, "fixed"], [p.deleted, "deleted"], [p.edited, "edited before sending"], [p.wrong, "skipped as wrong"]].filter(([n]) => n).map(([n, w]) => `${n} you ${w}`);
    lines.push(`Kaitlyn posted ${p.posted} last night: ${p.stood} stood${changed.length ? `, ${changed.join(", ")}` : ""} (agreement ${Math.round((100 * p.stood) / p.posted)}%).`);
  }
  const st = o.stale ?? [];
  if (st.length) lines.push(`${st.length} ${plural(st.length, "answer has", "answers have")} waited over a week for your OK: ${st.join(", ")}. ${o.url}`);
  // Both of yesterday's runs (3 PM and 3 AM) count; the previous run rides inside the last one.
  const dayAgo = (o.now ?? new Date()).getTime() - 24 * 3600 * 1000;
  const runs = [o.links, o.links?.prev].filter((r): r is NonNullable<typeof r> => Boolean(r) && (!r!.at || new Date(r!.at).getTime() >= dayAgo));
  const lk = runs.length ? { written: runs.reduce((n, r) => n + r.written, 0), created: runs.reduce((n, r) => n + r.created, 0), blank: Math.max(0, (o.links?.pending ?? 0) - (o.links?.written ?? 0)) } : null;
  if (lk && (lk.written || lk.blank > 0)) lines.push(`Links: the sweep gave ${lk.written} contact${lk.written === 1 ? "" : "s"} a personal link yesterday${lk.created ? ` (${lk.created} needed a room row)` : ""}${lk.blank > 0 ? `; ${lk.blank} still blank` : ""}.`);
  if (o.owed === -1) lines.push("Outcome tags owed to ActiveCampaign: unknown (the plan failed; check the push).");
  else if (o.owed !== undefined && o.owed >= OWED_FLOOR) lines.push(`Outcome tags owed to ActiveCampaign: ${o.owed} (the push is behind).`);
  const numbers = p?.posted ? [`${p.posted} posted last night`, `${p.stood} stood`, `${Math.round((100 * p.stood) / p.posted)}% agreement`] : [];
  const waiting = o.waiting ? `${o.waiting} ${plural(o.waiting, "answer needs", "answers need")} your OK` : "";
  const unanswered = n ? `${n} ${plural(n, "question", "questions")} she couldn't answer` : "";
  if (o.waiting || n) {
    // Something for Will: the staged answers to approve, the questions to answer, or both.
    const headline = waiting && unanswered ? `Kaitlyn: ${waiting} · ${unanswered}` : waiting ? `Kaitlyn: ${waiting}` : `Kaitlyn couldn't answer ${n} ${plural(n, "question", "questions")} last night (${o.people} asked)`;
    return { kind: "ask", headline, ask: { who: williamMention(), action: `${o.waiting ? "approve" : "answer"} them before tonight's room` }, numbers, detail: lines };
  }
  if (!lines.length && !numbers.length) return null;
  // Nothing to answer or approve: the night's audit as a read, its first line the headline.
  const headline = p?.posted ? `Kaitlyn posted ${p.posted} last night, ${p.stood} stood (${Math.round((100 * p.stood) / p.posted)}% agreement)` : clipWords(lines[0].replace(/[.:]$/, ""), HEADLINE_MAX_WORDS);
  return { kind: "read", headline, numbers, detail: lines };
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
