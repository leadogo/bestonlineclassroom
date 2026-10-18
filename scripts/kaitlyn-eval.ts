// Replays real room questions through Kaitlyn's prompt offline and scores her (SPEC-kaitlyn-autopilot.md, E). The set is
// docs/kaitlyn-eval-set.json (the month's 494 lines, folded by meaning, with what should happen). Nothing posts; each
// line is one model call with an empty room, the live fact sheet and the live knowledge table for ailg-r.
// Run: doppler run -p bestonlineclassroom -c prd -- node --no-warnings scripts/kaitlyn-eval.ts [--n 160] [--seed 7]
import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { db } from "../src/lib/db.ts";
import { tells } from "../src/lib/humanize.ts";
import { decide, systemPrompt, userTurn, type Context } from "../src/lib/kaitlyn.ts";
import type { KbRow } from "../src/lib/kaitlyn-kb.ts";

type Item = { key: string; expected: "answer" | "market" | "skip"; body: string; minute: number };
const { values } = parseArgs({ options: { n: { type: "string" }, seed: { type: "string", default: "7" }, concurrency: { type: "string", default: "4" } } });
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

const ev = (await db().from("events").select("id, kaitlyn_facts, cta_at_seconds").eq("slug", "ailg-r").maybeSingle()).data!;
const kb = ((await db().from("kaitlyn_kb").select("key, question, answer, approved, handling, asked").eq("event_id", ev.id)).data ?? []) as KbRow[];
const markets = (await db().from("market_counts").select("name, clients, live")).data ?? [];
const { marketLine } = await import("../src/lib/kaitlyn.ts");
const system = systemPrompt(ev.kaitlyn_facts, kb);
const pitch = ev.cta_at_seconds === null ? null : Math.floor(ev.cta_at_seconds / 60);

type Result = Item & { action: string; kb: string | null; text: string; why: string; tells: string[]; ms: number; ok: boolean };
const results: Result[] = [];
const run = async (i: Item): Promise<void> => {
  const ctx: Context = { minute: i.minute, pitchMinute: pitch, name: "Sam", body: i.body, priorOwn: [], modReplies: [], said: [], recent: [], market: marketLine(i.body, markets as never), katherine: false };
  const out = await decide(system, userTurn(ctx));
  const d = out?.decision;
  const action = d?.action ?? "no-answer";
  const ok = i.expected === "skip" ? action === "skip" || action === "ghost" : i.expected === "market" ? action === "reply" || action === "ask_william" : action === "reply" && d?.kb?.key === i.key;
  results.push({ ...i, action, kb: d?.kb?.key ?? null, text: d?.text ?? "", why: d?.why ?? "", tells: d?.text ? tells(d.text) : [], ms: out?.ms ?? 0, ok });
  process.stdout.write(ok ? "." : "x");
};
const queue = [...items];
await Promise.all(Array.from({ length: Number(values.concurrency) || 4 }, async () => { while (queue.length) await run(queue.shift()!); }));
console.log();

const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : "—");
const groups = ["answer", "market", "skip"] as const;
const lines: string[] = [`# Kaitlyn eval, ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`, "", `${results.length} of ${set.items.length} lines from docs/kaitlyn-eval-set.json, seed ${values.seed}, against the live fact sheet and ${kb.length} knowledge rows.`, "", "| expected | lines | as expected | replied | asked William | skipped | ghosted | median ms |", "|---|---|---|---|---|---|---|---|"];
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
writeFileSync(new URL("../docs/kaitlyn-eval.md", import.meta.url), lines.join("\n") + "\n");
console.log(lines.slice(4, 10).join("\n"));
console.log(`misses ${results.filter((x) => !x.ok).length}, tells ${withTells.length}; written to docs/kaitlyn-eval.md`);
