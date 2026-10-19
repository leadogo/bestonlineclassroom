// His own answers are already on the tape (SPEC-kaitlyn-transcript.md, D): from the Q&A chapter of the recording William
// answers that night's chat live. This pulls those question/answer pairs out of the transcript (a few model calls over
// ~12-minute pieces), folds each onto an existing knowledge key or a new one, and with --write fills the `answer` box of
// every row that has none, with the humanizer rewrite as the proposed line, so they land in "Waiting for your OK" on the
// Knowledge page. Nothing goes live without his approval. Dry run by default.
// Run: npm run qa:transcript -- --event ailg-r [--from 5040] [--max-new 30] [--write]
import { parseArgs } from "node:util";
import { parseVtt } from "../src/lib/captions.ts";
import { db } from "../src/lib/db.ts";
import { tidy } from "../src/lib/humanize.ts";
import { kbKey } from "../src/lib/kaitlyn-kb.ts";
import { rewriteAnswer } from "../src/lib/kaitlyn-rewrite.ts";

const { values } = parseArgs({ options: { event: { type: "string", default: "ailg-r" }, from: { type: "string" }, "max-new": { type: "string", default: "30" }, write: { type: "boolean", default: false } } });
const MODEL = process.env.KAITLYN_MODEL ?? "claude-sonnet-5-5";
const KEY = process.env.ANTHROPIC_API_KEY ?? "";
if (!KEY) throw new Error("ANTHROPIC_API_KEY is required");

type Pair = { minute: number; question: string; answer: string; key: string };
type Row = { key: string; question: string; answer: string | null; handling: string };

const ev = (await db().from("events").select("id, slug, captions_url, chapters").eq("slug", values.event!).maybeSingle()).data;
if (!ev?.captions_url) throw new Error(`${values.event}: no captions_url`);
const chapters = (ev.chapters ?? []) as Array<{ at: number; label: string }>;
const from = values.from ? Number(values.from) : chapters.find((c) => /q&a|q & a|questions/i.test(c.label))?.at ?? 5040;
const cues = parseVtt(await (await fetch(ev.captions_url as string)).text()).filter((c) => c.start >= from);
if (!cues.length) throw new Error(`no cues from second ${from}`);
const rows = ((await db().from("kaitlyn_kb").select("key, question, answer, handling").eq("event_id", ev.id).order("key")).data ?? []) as Row[];
const keysList = rows.map((r) => `${r.key}: ${r.question}`).join("\n");
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

const SYSTEM = `You read the live Q&A part of a recorded real estate webinar ("AI For Agents Masterclass"). William, the host, reads questions from the chat aloud and answers them. Pull out every question he answers about the product, the offer, the process, pricing, leads, the AI caller (Katherine AI), the CRM, markets in general, teams, new agents, compliance, support, the replay, and so on. Skip stories, skip answers that are only a count for one city or state, skip chit-chat.
For each one return the question in plain words (as the room would type it) and William's answer in his own words: trimmed to the substance, one to three sentences, his phrasing kept, nothing added, no filler ("great question"), no names of attendees.
KNOWN QUESTIONS (key: question). Use the key whose meaning matches; only when none does, coin a new lowercase-hyphen slug (3 to 40 chars).
${keysList}
OUTPUT: a JSON array and nothing else: [{"minute": <number, from the timestamp>, "question": "...", "answer": "...", "key": "<existing key or new slug>"}]. Empty array when there is nothing.`;

async function extract(piece: typeof cues): Promise<Pair[]> {
  const text = piece.map((c) => `[${mmss(c.start)}] ${c.text}`).join("\n");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: 16000, output_config: { effort: "low" }, system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }], messages: [{ role: "user", content: `TRANSCRIPT\n${text}` }] }),
    signal: AbortSignal.timeout(180_000),
  });
  if (!res.ok) throw new Error(`model ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = (await res.json()) as { content?: Array<{ type: string; text?: string }>; stop_reason?: string };
  const out = (j.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
  const a = out.indexOf("["), b = out.lastIndexOf("]");
  if (a < 0 || b <= a) { console.error("no JSON array in the answer", { stop: j.stop_reason, head: out.slice(0, 200) }); return []; }
  const arr = JSON.parse(out.slice(a, b + 1)) as Array<Record<string, unknown>>;
  return arr.map((p) => ({ minute: Number(p.minute) || Math.floor(piece[0].start / 60), question: tidy(String(p.question ?? "")).replace(/\s+/g, " ").trim().slice(0, 160), answer: tidy(String(p.answer ?? "")).trim().slice(0, 1200), key: kbKey(p.key) ?? "" })).filter((p) => p.question && p.answer && p.key);
}

// Pieces of about twelve minutes, split at cue boundaries.
const pieces: Array<typeof cues> = [];
let cur: typeof cues = [];
for (const c of cues) { cur.push(c); if (c.end - cur[0].start >= 720) { pieces.push(cur); cur = []; } }
if (cur.length) pieces.push(cur);
console.log(`${values.event}: Q&A from ${mmss(from)}, ${cues.length} cues in ${pieces.length} pieces`);
const pairs: Pair[] = [];
for (const p of pieces) { const got = await extract(p); pairs.push(...got); process.stdout.write(`  ${mmss(p[0].start)} → ${got.length} pairs\n`); }

// One answer per key: the first he gave; an existing row with an answer already is left alone (his words on the page win).
const byKey = new Map<string, Pair>();
for (const p of pairs) if (!byKey.has(p.key)) byKey.set(p.key, p);
const have = new Map(rows.map((r) => [r.key, r]));
let newCount = 0;
const plan: Array<{ what: "fill" | "new" | "skip"; why?: string; p: Pair }> = [];
for (const p of byKey.values()) {
  const r = have.get(p.key);
  if (r && r.answer) plan.push({ what: "skip", why: "already answered", p });
  else if (r && (r.handling === "me" || r.handling === "ignore")) plan.push({ what: "skip", why: `handling ${r.handling}`, p });
  else if (r) plan.push({ what: "fill", p });
  else if (newCount < Number(values["max-new"])) { plan.push({ what: "new", p }); newCount++; }
  else plan.push({ what: "skip", why: "over --max-new", p });
}
for (const x of plan) console.log(`${x.what.padEnd(4)} ${x.p.key} [min ${x.p.minute}]${x.why ? ` (${x.why})` : ""}\n     Q: ${x.p.question}\n     A: ${x.p.answer.slice(0, 200)}`);
console.log(`\n${plan.filter((x) => x.what === "fill").length} rows to fill, ${plan.filter((x) => x.what === "new").length} new, ${plan.filter((x) => x.what === "skip").length} skipped`);
if (!values.write) { console.log("(dry run: add --write to store them as Waiting for your OK)"); process.exit(0); }

const now = new Date().toISOString();
for (const x of plan) {
  if (x.what === "skip") continue;
  const rw = await rewriteAnswer(x.p.question, x.p.answer);
  const approved = rw?.text ?? x.p.answer;
  const patch = { answer: x.p.answer, approved, approved_at: null, handling: "answer", answered_at: now, updated_at: now };
  const r = x.what === "fill"
    ? await db().from("kaitlyn_kb").update(patch).eq("event_id", ev.id).eq("key", x.p.key)
    : await db().from("kaitlyn_kb").insert({ event_id: ev.id, key: x.p.key, question: x.p.question, asked: 0, ...patch });
  if (r.error) console.error(`${x.p.key}: ${r.error.message}`);
  else process.stdout.write(`${x.what === "fill" ? "filled" : "added"} ${x.p.key}${rw?.lost.length ? ` (rewrite dropped ${rw.lost.join(", ")}; his words are the fallback on the page)` : ""}\n`);
}
console.log("done: they are in Waiting for your OK at /admin/knowledge");
