// Seeds kaitlyn_kb from docs/kaitlyn-answers-2026-10-17.md (SPEC-kaitlyn-knowledge.md): one row per "## key" block, for
// every slug given on the command line. Upserts on (event_id, key), so it is safe to run again; it never lowers a count
// or overwrites an answer William changed on the page after the seed (rows with approved_at later than the file win).
// Run: doppler run -p bestonlineclassroom -c prd -- node scripts/seed-kaitlyn-kb.mjs ailg-r test-run
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const slugs = process.argv.slice(2);
if (!slugs.length) throw new Error("Which webinars? e.g. ailg-r test-run");
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const SEEDED_AT = "2026-10-18T05:30:00Z";

const text = readFileSync(new URL("../docs/kaitlyn-answers-2026-10-17.md", import.meta.url), "utf8");
const rows = [];
for (const block of text.split(/^## /m).slice(1)) {
  const [key, ...lines] = block.split("\n");
  const get = (name) => (lines.find((l) => l.startsWith(`${name}: `)) ?? "").slice(name.length + 2).trim();
  const handling = get("handling") || "answer";
  rows.push({ key: key.trim(), question: get("question"), asked: Number(get("asked")) || 0, handling, answer: get("answer") || null, approved: handling === "answer" ? get("approved") || null : null });
}
if (rows.length < 40) throw new Error(`Only ${rows.length} blocks parsed`);

for (const slug of slugs) {
  const ev = await sb.from("events").select("id").eq("slug", slug).maybeSingle();
  if (!ev.data) { console.log("no such webinar", slug); continue; }
  const have = await sb.from("kaitlyn_kb").select("key, asked, approved_at").eq("event_id", ev.data.id);
  const prior = new Map((have.data ?? []).map((r) => [r.key, r]));
  let written = 0;
  for (const r of rows) {
    const p = prior.get(r.key);
    if (p?.approved_at && new Date(p.approved_at) > new Date(SEEDED_AT)) continue; // William changed it on the page since; his wins
    const row = { event_id: ev.data.id, key: r.key, question: r.question, answer: r.answer, approved: r.approved, handling: r.handling, asked: Math.max(r.asked, p?.asked ?? 0), last_asked_at: "2026-10-17T23:59:00Z", answered_at: r.answer ? SEEDED_AT : null, approved_at: r.approved || r.handling === "ignore" ? SEEDED_AT : null, updated_at: new Date().toISOString() };
    const { error } = await sb.from("kaitlyn_kb").upsert(row, { onConflict: "event_id,key" });
    if (error) throw new Error(`${slug} ${r.key}: ${error.message}`);
    written++;
  }
  console.log(slug, "rows written", written, "of", rows.length);
}
