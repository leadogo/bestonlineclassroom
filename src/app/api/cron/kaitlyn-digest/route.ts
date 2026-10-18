import { db } from "@/lib/db";
import { digestDue, digestText } from "@/lib/kaitlyn-kb";
import { postToIntel } from "@/lib/slack";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SITE = (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.bestonlineclassroom.com").replace(/\/$/, "");
const DAY_MS = 24 * 3600 * 1000;

/**
 * The 9 AM knowledge digest (SPEC-kaitlyn-knowledge.md): once a day, at 9 in the webinar's zone, one line to
 * #autoweb-intel per webinar with Kaitlyn on, listing the questions she could not answer since yesterday's 9 AM and how
 * many answers wait for William's OK. Nothing posts on a quiet night. The cron runs hourly (vercel.json) so the clock
 * change never moves it; `?dry=1` returns the text without posting or recording; `?force=1` ignores the clock.
 */
export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const dry = params.get("dry") === "1";
  const force = params.get("force") === "1";
  const now = new Date();
  const { data: events } = await db().from("events").select("id, slug, kaitlyn_mode, kaitlyn_digest_on, timezone").neq("kaitlyn_mode", "off");
  const report: Array<{ event: string; due: boolean; text: string | null }> = [];
  for (const e of events ?? []) {
    if (e.slug.startsWith("test")) continue;
    const { due, today } = digestDue(now, e.kaitlyn_digest_on, e.timezone || "America/Edmonton");
    if (!due && !force && !dry) { report.push({ event: e.slug, due: false, text: null }); continue; }
    const since = new Date(now.getTime() - DAY_MS).toISOString();
    const [open, waiting] = await Promise.all([
      db().from("kaitlyn_kb").select("key, question").eq("event_id", e.id).eq("handling", "open").gte("last_asked_at", since).order("asked", { ascending: false }).limit(12),
      db().from("kaitlyn_kb").select("key", { count: "exact", head: true }).eq("event_id", e.id).not("answer", "is", null).is("approved_at", null).neq("handling", "ignore"),
    ]);
    const keys = (open.data ?? []).map((r) => r.key as string);
    const asks = keys.length ? ((await db().from("kaitlyn_decisions").select("kb_key, registrant_id").eq("event_id", e.id).in("kb_key", keys).gte("created_at", since)).data ?? []) : [];
    const perKey = new Map<string, number>();
    for (const a of asks) perKey.set(a.kb_key as string, (perKey.get(a.kb_key as string) ?? 0) + 1);
    const text = digestText({
      questions: (open.data ?? []).map((r) => ({ question: r.question as string, asked: perKey.get(r.key as string) ?? 1 })),
      people: new Set(asks.map((a) => a.registrant_id as string)).size,
      waiting: waiting.count ?? 0,
      url: `${SITE}/admin/knowledge?event=${e.slug}`,
    });
    if (!dry) {
      if (text) await postToIntel(text);
      await db().from("events").update({ kaitlyn_digest_on: today }).eq("id", e.id);
    }
    report.push({ event: e.slug, due, text });
  }
  return Response.json({ now: now.toISOString(), dry, report });
}
