// Tonight's class by minute (SPEC-kaitlyn-transcript.md, B): one model call over the event's transcript (the room's
// captions VTT) that writes 10 to 15 lines of "minute N: what he covers", printed and, with --write, stored in
// events.outline for Kaitlyn's prompt. Edit the result on the event's Settings page.
// Run: doppler run -p bestonlineclassroom -c prd -- node --no-warnings scripts/outline.ts --event ailg-r [--write]
import { parseArgs } from "node:util";
import { parseVtt } from "../src/lib/captions.ts";
import { db } from "../src/lib/db.ts";
import { tidy } from "../src/lib/humanize.ts";

const { values } = parseArgs({ options: { event: { type: "string", default: "ailg-r" }, write: { type: "boolean", default: false } } });
const MODEL = process.env.KAITLYN_MODEL ?? "claude-sonnet-5-5";
const KEY = process.env.ANTHROPIC_API_KEY ?? "";
if (!KEY) throw new Error("ANTHROPIC_API_KEY is required");

const ev = (await db().from("events").select("id, slug, captions_url, video_seconds").eq("slug", values.event!).maybeSingle()).data;
if (!ev?.captions_url) throw new Error(`${values.event}: no captions_url`);
const cues = parseVtt(await (await fetch(ev.captions_url as string)).text());
if (!cues.length) throw new Error("the transcript is empty");
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const transcript = cues.map((c) => `[${mmss(c.start)}] ${c.text}`).join("\n");
const total = Math.floor(Number(ev.video_seconds ?? cues[cues.length - 1].end) / 60);

const SYSTEM = `You outline a recorded real estate webinar ("AI For Agents Masterclass", William presenting) for Kaitlyn, the chat moderator, so she can tell someone "he gets to that around minute N". Write 10 to 15 lines, in order, covering the whole ${total}-minute class. Each line: "minute N: " then what he covers in that stretch, plain words, the specific things (tools, steps, examples, questions he answers), no marketing words, no dashes, under 160 characters. Mark where he asks the room to type something, where the offer starts, and where live Q&A starts. Nothing but the lines.`;
const res = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
  body: JSON.stringify({ model: MODEL, max_tokens: 1500, system: SYSTEM, messages: [{ role: "user", content: `TRANSCRIPT (minute:second then the words)\n${transcript}` }] }),
  signal: AbortSignal.timeout(180_000),
});
if (!res.ok) throw new Error(`model ${res.status}: ${(await res.text()).slice(0, 300)}`);
const j = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
const outline = tidy((j.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("")).split("\n").map((l) => l.trim()).filter((l) => /^minute \d+:/i.test(l)).join("\n");
if (!outline) throw new Error("no outline lines in the answer");
console.log(outline);
if (values.write) {
  const { error } = await db().from("events").update({ outline }).eq("id", ev.id);
  if (error) throw error;
  console.log(`\nwritten to events.outline for ${ev.slug} (${outline.split("\n").length} lines)`);
} else console.log("\n(dry run: add --write to store it)");
