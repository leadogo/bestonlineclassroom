// One model call that rewrites William's answer by the humanizer rules for the Knowledge base page
// (SPEC-kaitlyn-knowledge.md): his words in, the line Kaitlyn would say out, with the facts he gave checked. Null on any
// failure, and the page then offers his words as they are.
import { tidy } from "./humanize.ts";
import { HUMANIZER_RULES } from "./humanizer-rules.ts";
import { factsLost } from "./kaitlyn-kb.ts";

const MODEL = process.env.KAITLYN_MODEL ?? "claude-sonnet-5-5";
const KEY = process.env.ANTHROPIC_API_KEY ?? "";

const SYSTEM = `${HUMANIZER_RULES}

---
EMBEDDED MODE, one job. You are given a question that real estate agents asked in a live webinar chat and the answer William (the host) typed fast in his own words. Return only the final rewrite, nothing else: the line his AI moderator Kaitlyn will post in the chat. One or two sentences, under 240 characters unless his answer needs more. His register: contractions, plain, the odd "lol" kept when he wrote it, one emoji at most and only one he used. No greeting, no name (she adds the asker's name herself), no dashes of any kind, straight quotes. Every fact, figure, dollar amount, link and name he gave stays exactly; nothing is added. A stray word that is clearly a name he started typing ("phan", "crocetto") is dropped. No preamble, no quotation marks around the line.`;

export async function rewriteAnswer(question: string, answer: string): Promise<{ text: string; lost: string[] } | null> {
  if (!KEY || !answer.trim()) return null;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 800, system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }], messages: [{ role: "user", content: `Question the room asked: ${question}\n\nWilliam's answer: ${answer}` }] }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) { console.error("[kaitlyn-rewrite] model call failed", { status: res.status }); return null; }
    const j = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = tidy((j.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("").trim().replace(/^["“]|["”]$/g, ""));
    if (!text) return null;
    return { text, lost: factsLost(answer, text) };
  } catch (err) {
    console.error("[kaitlyn-rewrite] threw", { err: String(err) });
    return null;
  }
}
