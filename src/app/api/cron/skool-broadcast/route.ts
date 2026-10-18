import { db } from "@/lib/db";
import { postToIntel } from "@/lib/slack";
import { CATEGORY, SKOOL_GROUP, isBroadcastMinute, mountainParts, pickBroadcast, BROADCASTS } from "@/lib/skool-broadcast";
import { postToSkool } from "@/lib/skool-post";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * The Wednesday/Sunday Skool broadcast (SPEC-show-rate-recovery.md W2): at 4:58 pm Mountain the bot posts Jeremy's
 * announcement to Book More Showings Free with "Send email to all members" on, through a logged-in hosted browser.
 * One posted row per day. `?dry=1` fills and cancels; `?force=1` ignores the day/minute guard; `?day=sunday`
 * picks the copy; `?group=<slug>` posts to another group (a test group). One line to #autoweb-intel either way.
 */
export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const q = new URL(request.url).searchParams;
  const dry = q.get("dry") === "1";
  const force = q.get("force") === "1";
  const now = new Date();
  const group = /^[a-z0-9-]{3,60}$/.test(q.get("group") ?? "") ? (q.get("group") as string) : SKOOL_GROUP;
  const dayParam = q.get("day");
  const broadcast = dayParam === "sunday" || dayParam === "wednesday" ? BROADCASTS[dayParam] : pickBroadcast(now);
  if (!broadcast) return Response.json({ skipped: "not a broadcast day" });
  if (!force && !isBroadcastMinute(now)) return Response.json({ skipped: "not the broadcast minute", mountain: mountainParts(now) });
  const { date } = mountainParts(now);
  if (!dry) {
    const done = await db().from("skool_broadcasts").select("id, post_url").eq("group_slug", group).eq("broadcast_date", date).eq("status", "posted").maybeSingle();
    if (done.data) return Response.json({ skipped: "already posted today", post_url: done.data.post_url });
  }
  const result = await postToSkool({ groupSlug: group, title: broadcast.title, body: broadcast.body, category: CATEGORY, emailAll: true, dryRun: dry });
  const status = dry ? "dry_run" : result.ok ? "posted" : "failed";
  await db().from("skool_broadcasts").insert({ group_slug: group, broadcast_date: date, weekday: broadcast.weekday, title: broadcast.title, body: broadcast.body, status, post_url: result.postUrl ?? null, error: result.error ?? null });
  const line = result.ok
    ? `✅ *Skool ${broadcast.weekday} broadcast ${dry ? "dry run filled and cancelled" : "posted"}* · ${group} · email toggle ${result.emailToggle ?? "unknown"}${result.postUrl ? ` · ${result.postUrl}` : ""}`
    : `🚨 *Skool ${broadcast.weekday} broadcast failed* · ${group} · ${result.error ?? "unknown error"} · Browserbase session ${result.sessionId ?? "?"}`;
  await postToIntel(line).catch(() => {});
  return Response.json({ ok: result.ok, status, emailToggle: result.emailToggle, postUrl: result.postUrl, error: result.error, sessionId: result.sessionId }, { status: result.ok ? 200 : 500 });
}
