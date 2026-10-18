// Fill the Skool composer with today's (or --day sunday|wednesday) broadcast and press Cancel. Screenshot to /tmp.
//   doppler run --config prd -- node scripts/skool-dry-run.ts [--day wednesday] [--group <slug>] [--post]
import { writeFile } from "node:fs/promises";
import { BROADCASTS, CATEGORY, SKOOL_GROUP, pickBroadcast } from "../src/lib/skool-broadcast.ts";
import { postToSkool } from "../src/lib/skool-post.ts";
const args = process.argv.slice(2);
const opt = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const day = opt("--day") as "sunday" | "wednesday" | undefined;
const b = day ? BROADCASTS[day] : (pickBroadcast(new Date()) ?? BROADCASTS.sunday);
const group = opt("--group") ?? SKOOL_GROUP;
const dryRun = !args.includes("--post");
postToSkool({ groupSlug: group, title: b.title, body: b.body, category: CATEGORY, emailAll: true, dryRun }).then(async (r) => {
  const shot = `/private/tmp/claude-501/-Users-willkabrall-orca-leadogo-app/5b135350-b53d-4e48-93ad-356d6c5917fa/scratchpad/skool-${dryRun ? "dry" : "post"}-${group}.png`;
  if (r.screenshot) await writeFile(shot, r.screenshot);
  console.log(JSON.stringify({ ok: r.ok, emailToggle: r.emailToggle, postUrl: r.postUrl, error: r.error, session: r.sessionId, screenshot: r.screenshot ? shot : null }));
  process.exit(r.ok ? 0 : 1);
});
