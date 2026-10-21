import { activeCampaignConfigured } from "@/lib/activecampaign";
import { db } from "@/lib/db";
import { planOutcomeTags, pushOutcomeTags } from "@/lib/outcome-push";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Every 15 minutes (vercel.json): for every session in the last 8 days, tag each registrant in ActiveCampaign with what
 * they did (SPEC-analytics.md). Session-end outcomes wait until 30 minutes after the recording ends; replay, question
 * and click go as soon as they happen. `outcome_tags` remembers what was sent. The push is planned newest session first
 * and runs under a time budget, so a big night clears over a few runs instead of timing out (SPEC-post-session.md, A).
 * `?dry=1` lists the plan instead; the response carries `owed`, what the next runs still have to push.
 */
export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const dry = new URL(request.url).searchParams.get("dry") === "1";
  if (!activeCampaignConfigured() && !dry) return Response.json({ error: "ActiveCampaign not configured" }, { status: 503 });
  if (dry) {
    const plan = await planOutcomeTags();
    return Response.json({ owed: plan.length, planned: plan.map((p) => ({ email: p.email, tag: p.tag, session_date: p.session_date })) });
  }
  // IPs are kept 30 days for blocking, then dropped (SPEC-phase4 chat-moderation).
  await db().from("registrants").update({ ip: null, ip_seen_at: null }).lt("ip_seen_at", new Date(Date.now() - 30 * 86_400_000).toISOString());
  return Response.json(await pushOutcomeTags());
}
