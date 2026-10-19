// Replays real room questions through Kaitlyn's prompt offline and scores her (SPEC-kaitlyn-autopilot.md, E). The set is
// docs/kaitlyn-eval-set.json (the month's 494 lines, folded by meaning, with what should happen). Nothing posts; each
// line is one model call with an empty room, the live fact sheet and the live knowledge table for ailg-r.
// Run: doppler run -p bestonlineclassroom -c prd -- node --no-warnings scripts/kaitlyn-eval.ts [--n 160] [--seed 7] [--no-screen] [--out docs/kaitlyn-eval.md]
// --no-screen leaves out what William is saying on screen (SPEC-kaitlyn-transcript.md, E), for the before/after comparison.
import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { db } from "../src/lib/db.ts";
import { tells } from "../src/lib/humanize.ts";
import { decide, marketLine, systemPrompt, userTurn, type Context } from "../src/lib/kaitlyn.ts";
import type { Correction, KbRow } from "../src/lib/kaitlyn-kb.ts";
import { cuesFor, onScreen } from "../src/lib/transcript.ts";

type Item = { key: string; expected: "answer" | "market" | "skip"; body: string; minute: number };
const { values } = parseArgs({ options: { n: { type: "string" }, seed: { type: "string", default: "7" }, concurrency: { type: "string", default: "4" }, "no-screen": { type: "boolean", default: false }, out: { type: "string", default: "docs/kaitlyn-eval.md" } } });
const set = JSON.parse(readFileSync(new URL("../docs/kaitlyn-eval-set.json", import.meta.url), "utf8")) as { items: Item[] };

// A stable sample: every key gets at least two lines, the rest by a seeded shuffle, so a run compares with the last one.
let s = Number(values.seed) || 7;
const rand = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const want = values.n ? Number(values.n) : set.items.length;
const byKey = new Map<string, Item[]>();
for (const i of set.items) byKey.set(i.key, [...(byKey.get(i.key) ?? []), i]);
let items: Item[] = [];
for (const list of byKey.values()) items.push(...list.slice(0, 2));
const rest = set.items.filter((i) => !items.includes(i)).sort(() => rand() - 0.5);
items = [...items, ...rest].slice(0, want);

const ev = (await db().from("events").select("id, kaitlyn_facts, cta_at_seconds, captions_url, captions_offset_seconds, chapters, video_seconds, outline").eq("slug", "ailg-r").maybeSingle()).data!;
const kb = ((await db().from("kaitlyn_kb").select("key, question, answer, approved, approved_at, handling, asked").eq("event_id", ev.id).order("key")).data ?? []) as KbRow[];
const fixes = ((await db().from("kaitlyn_corrections").select("asked, said, fixed").eq("event_id", ev.id).order("id", { ascending: false }).limit(40)).data ?? []) as Correction[];
const markets = (await db().from("market_counts").select("name, clients, live")).data ?? [];
// The same prompt the room uses: facts, knowledge, corrections and tonight's class; the screen per item unless --no-screen.
const system = systemPrompt(ev.kaitlyn_facts, kb, fixes, ev.outline as string | null);
const cues = values["no-screen"] ? [] : await cuesFor(ev.captions_url as string | null);
const chapters = (ev.chapters ?? []) as Array<{ at: number; label: string }>;
const shift = Number(ev.captions_offset_seconds ?? 0) || 0;
const pitch = ev.cta_at_seconds === null ? null : Math.floor(ev.cta_at_seconds / 60);

type Result = Item & { action: string; kb: string | null; text: string; why: string; tells: string[]; ms: number; ok: boolean };
const results: Result[] = [];
const run = async (i: Item): Promise<void> => {
  const ctx: Context = { minute: i.minute, pitchMinute: pitch, name: "Sam", body: i.body, priorOwn: [], modReplies: [], said: [], recent: [], market: marketLine(i.body, markets as never), katherine: false, onScreen: onScreen(cues, chapters, i.minute * 60 + 30, (ev.video_seconds as number | null) ?? null, shift) };
  const out = await decide(system, userTurn(ctx));
  const d = out?.decision;
  const action = d?.action ?? "no-answer";
  // A bare place before the pitch is skipped by design (they are answering William's where-are-you-from), so that counts as expected.
  const ok = i.expected === "skip" ? action === "skip" || action === "ghost" : i.expected === "market" ? action === "reply" || action === "ask_william" || (action === "skip" && pitch !== null && i.minute < pitch) : action === "reply" && d?.kb?.key === i.key;
  results.push({ ...i, action, kb: d?.kb?.key ?? null, text: d?.text ?? "", why: d?.why ?? "", tells: d?.text ? tells(d.text) : [], ms: out?.ms ?? 0, ok });
  process.stdout.write(ok ? "." : "x");
};
const queue = [...items];
await Promise.all(Array.from({ length: Number(values.concurrency) || 4 }, async () => { while (queue.length) await run(queue.shift()!); }));
console.log();

const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : "—");
const groups = ["answer", "market", "skip"] as const;
const lines: string[] = [`# Kaitlyn eval, ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`, "", `${results.length} of ${set.items.length} lines from docs/kaitlyn-eval-set.json, seed ${values.seed}, against the live fact sheet, ${kb.length} knowledge rows, ${fixes.length} corrections, ${ev.outline ? "the class outline" : "no outline"}, and ${cues.length ? "what William is saying on screen at each line's minute" : "no transcript (--no-screen)"}.`, "", "| expected | lines | as expected | replied | asked William | skipped | ghosted | median ms |", "|---|---|---|---|---|---|---|---|"];
for (const g of groups) {
  const r = results.filter((x) => x.expected === g);
  const med = r.map((x) => x.ms).sort((a, b) => a - b)[Math.floor(r.length / 2)] ?? 0;
  lines.push(`| ${g} | ${r.length} | ${pct(r.filter((x) => x.ok).length, r.length)} | ${r.filter((x) => x.action === "reply").length} | ${r.filter((x) => x.action === "ask_william").length} | ${r.filter((x) => x.action === "skip").length} | ${r.filter((x) => x.action === "ghost").length} | ${med} |`);
}
const withTells = results.filter((x) => x.tells.length);
const wrongKey = results.filter((x) => x.expected === "answer" && x.action === "reply" && x.kb !== x.key);
lines.push("", `Drafts with a bot tell left after tidy: ${withTells.length} of ${results.filter((x) => x.text).length}.`, `Replies filed under a different key than the set expects: ${wrongKey.length}.`, "", "## Misses (first 40)", "");
for (const x of results.filter((x) => !x.ok).slice(0, 40)) lines.push(`- [${x.expected} → ${x.action}${x.kb ? ` / ${x.kb}` : ""}] "${x.body.slice(0, 90)}"${x.text ? ` → "${x.text.slice(0, 90)}"` : ""} (${x.why})`);
lines.push("", "## Tells", "", ...withTells.slice(0, 20).map((x) => `- ${x.tells.join(", ")}: "${x.text}"`));
writeFileSync(values.out!, lines.join("\n") + "\n");
console.log(lines.slice(4, 10).join("\n"));
console.log(`misses ${results.filter((x) => !x.ok).length}, tells ${withTells.length}; written to ${values.out}`);
