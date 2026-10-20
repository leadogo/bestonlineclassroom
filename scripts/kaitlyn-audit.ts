// The Kaitlyn audit as a script (SPEC-kaitlyn-ghosts.md, E1): per night, what was asked, who answered, who was left; the
// by-hand ghosts with the line they came from, the reason chip and the lag; the people who complained of being ignored and
// whether they had already been answered. Read-only SQL through the Management API (SUPABASE_ACCESS_TOKEN in Doppler, as
// scripts/migrate.ts), because the queries need CTEs that supabase-js cannot express. The first run of these numbers is
// docs/kaitlyn-ghost-audit-2026-10-20.md.
// Run: npm run kaitlyn:audit -- [--event ailg-r] [--from 2026-10-11] [--to 2026-12-31] [--out docs/kaitlyn-audit-<date>.md]
import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";

const ref = process.env.SUPABASE_PROJECT_REF;
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!ref || !token) throw new Error("SUPABASE_PROJECT_REF and SUPABASE_ACCESS_TOKEN are required");
const { values } = parseArgs({ options: { event: { type: "string", default: "ailg-r" }, from: { type: "string", default: "2026-10-11" }, to: { type: "string", default: "2099-01-01" }, out: { type: "string" } } });
const slug = values.event!.replace(/[^a-z0-9-]/g, "");
const from = values.from!.replace(/[^0-9-]/g, "");
const to = values.to!.replace(/[^0-9-]/g, "");

async function query<T>(sql: string): Promise<T[]> {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ query: sql, read_only: true }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Management API ${res.status}: ${body.slice(0, 500)}`);
  return body ? (JSON.parse(body) as T[]) : [];
}

// Wanted: a line Kaitlyn judged worth a reply or a hand-off. Unanswered: nobody (Kevin or Kaitlyn) mentioned the person in the next 15 minutes;
// her hand-off line does not count (the same rule as the digest's answeredWithin in src/lib/kaitlyn-kb.ts).
const BASE = `
with q as (
  select m.id, m.event_id, m.session_date, m.registrant_id, m.body, m.offset_seconds, m.created_at, m.visibility, d.action, d.category, d.status
  from chat_messages m join events e on e.id = m.event_id
  left join kaitlyn_decisions d on d.message_id = m.id
  where e.slug = '${slug}' and m.role = 'attendee' and m.deleted_at is null and m.registrant_id is not null and m.session_date between '${from}' and '${to}'
), a as (
  select q.*,
    exists (select 1 from chat_messages x where x.event_id = q.event_id and x.session_date = q.session_date and x.role = 'moderator' and x.author_name <> 'Kaitlyn from William''s Team' and q.registrant_id::text = any(x.mentions) and x.id > q.id and x.created_at < q.created_at + interval '15 min') as human,
    exists (select 1 from chat_messages x where x.event_id = q.event_id and x.session_date = q.session_date and x.role = 'moderator' and x.author_name = 'Kaitlyn from William''s Team' and q.registrant_id::text = any(x.mentions) and x.id > q.id and x.created_at < q.created_at + interval '15 min' and x.deleted_at is null
      and not exists (select 1 from kaitlyn_decisions h where h.sent_message_id = x.id and h.action = 'ask_william' and h.status = 'pending')) as kait
  from q
)`;

type Night = { d: string; lines: number; wanted: number; by_human: number; by_kaitlyn: number; unanswered: number; hidden: number };
type Ghost = { d: string; who: string; reason: string | null; lag_s: number | null; line: string; answered: number };
type Nag = { d: string; min: number; who: string; ghosted: boolean; answered: number; body: string };

const [nights, ghosts, nags] = await Promise.all([
  query<Night>(`${BASE} select to_char(session_date, 'MM-DD') d, count(*)::int lines, count(*) filter (where action in ('reply','ask_william'))::int wanted,
    count(*) filter (where action in ('reply','ask_william') and human)::int by_human, count(*) filter (where action in ('reply','ask_william') and not human and kait)::int by_kaitlyn,
    count(*) filter (where action in ('reply','ask_william') and not human and not kait)::int unanswered, count(*) filter (where visibility = 'author')::int hidden
    from a group by session_date order by session_date`),
  query<Ghost>(`select to_char(g.session_date, 'MM-DD') d, g.first_name who, g.reason, extract(epoch from (g.ghosted_at - m.created_at))::int lag_s, g.line, g.answered
    from kaitlyn_ghosts g join events e on e.id = g.event_id join chat_messages m on m.id = g.line_id
    where e.slug = '${slug}' and g.session_date between '${from}' and '${to}' order by g.ghosted_at`),
  query<Nag>(`select to_char(m.session_date, 'MM-DD') d, floor(m.offset_seconds / 60)::int min, m.author_name who, (r.ghosted_at is not null) ghosted,
    (select count(*) from chat_messages t where t.role = 'moderator' and r.id::text = any(t.mentions) and t.id < m.id)::int answered, m.body
    from chat_messages m join events e on e.id = m.event_id join registrants r on r.id = m.registrant_id
    where e.slug = '${slug}' and m.role = 'attendee' and m.session_date between '${from}' and '${to}'
      and m.body ~* '(asked (multiple|several|three|twice|again)|can you (not )?see m|do you see m|receive my|ignor|skipping me|only speak to some|not answering|nobody (is )?answer|no one (is )?answer|anyone there|are you there|why (do|are) you (keep )?(skip|ignor))'
    order by m.session_date, m.id`),
]);

const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : "—");
const lines = [
  `# Kaitlyn audit, ${slug}, ${from} to ${to === "2099-01-01" ? "now" : to} (${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC)`,
  "",
  "Wanted = a line Kaitlyn judged worth a reply or a hand-off; unanswered = nobody mentioned the person in the next 15 minutes; hidden = lines only their author sees (a ghost).",
  "",
  "| night | lines | wanted | by Kevin | by Kaitlyn | unanswered | hidden |",
  "|---|---|---|---|---|---|---|",
  ...nights.map((n) => `| ${n.d} | ${n.lines} | ${n.wanted} | ${n.by_human} | ${n.by_kaitlyn} | ${n.unanswered} (${pct(n.unanswered, n.wanted)}) | ${n.hidden} |`),
  "",
  `## Ghosted by hand (${ghosts.length})`,
  "",
  "| night | who | reason | lag | answered before | the line |",
  "|---|---|---|---|---|---|",
  ...ghosts.map((g) => `| ${g.d} | ${g.who} | ${g.reason ?? ""} | ${g.lag_s === null ? "" : `${g.lag_s} s`} | ${g.answered} | ${g.line.replace(/\|/g, "/").slice(0, 120)} |`),
  "",
  `## Complained of being ignored (${nags.length})`,
  "",
  "| night | min | who | answered before | ghosted | the line |",
  "|---|---|---|---|---|---|",
  ...nags.map((n) => `| ${n.d} | ${n.min} | ${n.who} | ${n.answered} | ${n.ghosted ? "yes" : ""} | ${n.body.replace(/\|/g, "/").slice(0, 120)} |`),
  "",
];
const text = lines.join("\n");
if (values.out) {
  writeFileSync(values.out, text);
  console.log(`written to ${values.out}`);
}
console.log(lines.slice(4, 6 + nights.length).join("\n"));
console.log(`ghosted by hand ${ghosts.length}, complaints ${nags.length}`);
