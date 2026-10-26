// The link sweep by hand (SPEC-friday-unattended.md, E2): the same code as /api/cron/ac-links, with a budget the cron does
// not have, for the first run and for a check. Run: doppler run -p bestonlineclassroom -c prd -- node --no-warnings scripts/ac-links-sweep.ts [--apply] [--full] [--budget-min 30]
import { parseArgs } from "node:util";
import { sweepLinks, sweepNotice } from "../src/lib/ac-links.ts";
import { renderNotice } from "../src/lib/slack.ts";

const { values } = parseArgs({ options: { apply: { type: "boolean", default: false }, full: { type: "boolean", default: false }, "budget-min": { type: "string", default: "30" } } });
const t0 = Date.now();
const result = await sweepLinks({ apply: values.apply, full: values.full, budgetMs: Number(values["budget-min"]) * 60_000 });
console.log(JSON.stringify({ ...result, seconds: Math.round((Date.now() - t0) / 1000) }, null, 1));
const notice = sweepNotice(result, values.apply ? "by hand" : "dry run");
console.log(notice ? renderNotice(notice) : `Links OK: every one of ${result.scanned} contacts has a personal link (${result.scope}).`);
if (!values.apply) console.log("dry run; pass --apply to write");
