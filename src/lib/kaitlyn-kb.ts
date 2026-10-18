// Kaitlyn's knowledge base, the pure parts (SPEC-kaitlyn-knowledge.md): the key the model names per decision, the
// KNOWLEDGE block her prompt reads from `kaitlyn_kb`, the 9 AM digest's clock and text, the check that a humanizer rewrite
// kept William's facts, and the line she posts when she does not know and nobody is on the desk.

export type KbHandling = "open" | "answer" | "me" | "ignore";
export type KbRow = { key: string; question: string; answer: string | null; approved: string | null; handling: KbHandling; asked: number };

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
  const answers = rows.filter((r) => r.handling === "answer" && r.approved?.trim());
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

/** Whether the 9 AM digest is due: 9 o'clock in the team's zone and not yet sent today. `today` is the local date to record. */
export function digestDue(now: Date, lastOn: string | null, tz = "America/Edmonton"): { due: boolean; today: string } {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const today = `${get("year")}-${get("month")}-${get("day")}`;
  return { due: Number(get("hour")) % 24 === 9 && lastOn !== today, today };
}

/** The Slack line for #autoweb-intel; null when there is nothing to say. */
export function digestText(o: { questions: Array<{ question: string; asked: number }>; people: number; waiting: number; url: string }): string | null {
  const n = o.questions.length;
  const plural = (k: number, one: string, many: string) => (k === 1 ? one : many);
  if (!n) return o.waiting ? `${o.waiting} of Kaitlyn's answers ${plural(o.waiting, "is", "are")} waiting for your OK: ${o.url}` : null;
  const lines = [
    `Kaitlyn couldn't answer ${n} ${plural(n, "question", "questions")} last night (${o.people} ${plural(o.people, "person", "people")} asked):`,
    ...o.questions.map((q) => `• ${q.question}${q.asked > 1 ? ` (×${q.asked})` : ""}`),
    `Answer ${plural(n, "it", "them")}: ${o.url}`,
  ];
  if (o.waiting) lines.push(`${o.waiting} ${plural(o.waiting, "answer is", "answers are")} waiting for your OK.`);
  return lines.join("\n");
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
