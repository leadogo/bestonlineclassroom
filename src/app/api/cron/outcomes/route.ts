import { tagContact, activeCampaignConfigured } from "@/lib/activecampaign";
import { scheduleOf, sessionFor } from "@/lib/daily-schedule";
import { db } from "@/lib/db";
import type { EventRow } from "@/lib/events";
import { tagsFor, type Outcome, type TagNames } from "@/lib/outcomes";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Hourly (vercel.json): for every session in the last 8 days, tag each registrant in ActiveCampaign with what
 * they did (SPEC-analytics.md). Session-end outcomes wait until 30 minutes after the recording ends; replay,
 * question and click go as soon as they happen. `outcome_tags` remembers what was sent. `?dry=1` lists instead.
 */
export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const dry = new URL(request.url).searchParams.get("dry") === "1";
  if (!activeCampaignConfigured() && !dry) return Response.json({ error: "ActiveCampaign not configured" }, { status: 503 });
  const since = new Date(Date.now() - 8 * 86_400_000).toISOString().slice(0, 10);
  const { data: events } = await db().from("events").select("*");
  const now = Date.now();
  let sent = 0;
  const planned: Array<{ email: string; tag: string }> = [];
  for (const e of (events ?? []) as EventRow[]) {
    const names = (e as unknown as { tags: TagNames }).tags ?? {};
    const { data: rows } = await db().from("registrant_outcomes").select("*").eq("event_id", e.id).gte("session_date", since).neq("source", "test").not("email", "is", null);
    const ids = (rows ?? []).map((r) => r.registrant_id as string);
    const { data: done } = ids.length ? await db().from("outcome_tags").select("registrant_id, tag").in("registrant_id", ids) : { data: [] };
    const have = new Set((done ?? []).map((d) => `${d.registrant_id}:${d.tag}`));
    for (const r of rows ?? []) {
      const session = sessionFor(scheduleOf(e), r.session_date as string);
      const over = Boolean(session && now >= session.end.getTime() + 30 * 60_000);
      for (const tag of tagsFor(r as unknown as Outcome, names, over)) {
        if (have.has(`${r.registrant_id}:${tag}`)) continue;
        if (dry) {
          planned.push({ email: r.email as string, tag });
          continue;
        }
        const ok = await tagContact(r.email as string, tag);
        if (ok) {
          await db().from("outcome_tags").insert({ registrant_id: r.registrant_id, tag });
          sent += 1;
        }
      }
    }
  }
  return Response.json(dry ? { planned } : { sent });
}
