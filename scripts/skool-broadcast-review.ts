// Print the Jeremy brief for the scored Skool broadcasts (paste it to his MCP after four sends of a title).
//   doppler run --config prd -- node scripts/skool-broadcast-review.ts [--days 30]
import { createClient } from "@supabase/supabase-js";
import { reviewBrief, type BroadcastResult } from "../src/lib/skool-broadcast-results.ts";
const i = process.argv.indexOf("--days"); const days = i >= 0 ? Number(process.argv[i + 1]) : 30;
const db = createClient(process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "");
const since = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
const { data, error } = await db.from("skool_broadcasts").select("broadcast_date, weekday, title, result").eq("status", "posted").not("result", "is", null).gte("broadcast_date", since).order("broadcast_date");
if (error) throw new Error(error.message);
console.log(reviewBrief((data ?? []).map((r) => ({ date: r.broadcast_date as string, weekday: r.weekday as string, title: r.title as string, result: r.result as BroadcastResult }))));
