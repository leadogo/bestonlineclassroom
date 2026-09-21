// Applies every file in supabase/migrations/ that is not yet recorded, through Supabase's Management API
// (a personal access token in Doppler as SUPABASE_ACCESS_TOKEN). Run: npm run db:migrate
// ponytail: no Supabase CLI link tonight; the CLI (`supabase db push`) is the upgrade when the admin phase lands.
import { readdirSync, readFileSync } from "node:fs";

const ref = process.env.SUPABASE_PROJECT_REF;
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!ref || !token) throw new Error("SUPABASE_PROJECT_REF and SUPABASE_ACCESS_TOKEN are required");

async function query(sql: string): Promise<unknown> {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Management API ${res.status}: ${body.slice(0, 500)}`);
  return body ? JSON.parse(body) : null;
}

await query("create table if not exists public._migrations (name text primary key, applied_at timestamptz not null default now())");
const applied = new Set(((await query("select name from public._migrations")) as Array<{ name: string }>).map((r) => r.name));
const files = readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort();
for (const f of files) {
  if (applied.has(f)) { console.log("skip", f); continue; }
  const sql = readFileSync(`supabase/migrations/${f}`, "utf8");
  await query(`begin;\n${sql}\ninsert into public._migrations (name) values ('${f.replace(/'/g, "''")}');\ncommit;`);
  console.log("applied", f);
}
console.log(`${files.length} migration(s) on record`);
