import { db } from "@/lib/db";
import { answeredWithin, digestDue, digestText, postedFrom } from "@/lib/kaitlyn-kb";
import { planOutcomeTags } from "@/lib/outcome-push";
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
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const dry = params.get("dry") === "1";
  const force = params.get("force") === "1";
  const now = new Date();
  const { data: events } = await db().from("events").select("id, slug, kaitlyn_mode, kaitlyn_digest_on, timezone").neq("kaitlyn_mode", "off");
  const report: Array<{ event: string; due: boolean; text: string | null }> = [];
  // The outcome push's backlog, once per run (SPEC-post-session.md, B): the plan covers every event.
  let owed: number | undefined;
  for (const e of events ?? []) {
    if (e.slug.startsWith("test")) continue;
    const { due, today } = digestDue(now, e.kaitlyn_digest_on, e.timezone || "America/Edmonton");
    if (!due && !force && !dry) { report.push({ event: e.slug, due: false, text: null }); continue; }
    if (owed === undefined) owed = await planOutcomeTags().then((p) => p.length).catch(() => -1);
    const since = new Date(now.getTime() - DAY_MS).toISOString();
    const [open, waiting] = await Promise.all([
      db().from("kaitlyn_kb").select("key, question").eq("event_id", e.id).eq("handling", "open").gte("last_asked_at", since).order("asked", { ascending: false }).limit(12),
      db().from("kaitlyn_kb").select("key", { count: "exact", head: true }).eq("event_id", e.id).not("answer", "is", null).is("approved_at", null).neq("handling", "ignore"),
    ]);
    const keys = (open.data ?? []).map((r) => r.key as string);
    const asks = keys.length ? ((await db().from("kaitlyn_decisions").select("kb_key, registrant_id").eq("event_id", e.id).in("kb_key", keys).gte("created_at", since)).data ?? []) : [];
    const perKey = new Map<string, number>();
    for (const a of asks) perKey.set(a.kb_key as string, (perKey.get(a.kb_key as string) ?? 0) + 1);
    // Last night's audit in two lines (SPEC-kaitlyn-ghosts.md, E2): who Kaitlyn or the desk never answered (a card still pending and
    // no moderator line to them within 15 minutes), and who the desk ghosted by hand, with the reason chip.
    const [pending, told, ghosts] = await Promise.all([
      db().from("kaitlyn_decisions").select("registrant_id, created_at, sent_message_id").eq("event_id", e.id).in("action", ["reply", "ask_william"]).eq("status", "pending").gte("created_at", since).limit(200),
      db().from("chat_messages").select("id, mentions, created_at").eq("event_id", e.id).eq("role", "moderator").gte("created_at", since).limit(1000),
      db().from("registrants").select("first_name, auto_ghost_reason, source").eq("event_id", e.id).gte("ghosted_at", since).neq("source", "test").limit(50),
    ]);
    // Her hand-off lines sit on the cards as sent_message_id: a promise of an answer, not one.
    const handoffs = new Set((pending.data ?? []).map((d) => d.sent_message_id as number | null).filter((x): x is number => x !== null));
    const lines = (told.data ?? []).map((m) => ({ id: m.id as number, mentions: (m.mentions as string[]) ?? [], created_at: m.created_at as string }));
    const missed = Array.from(new Set((pending.data ?? []).filter((d) => !answeredWithin(new Date(d.created_at as string).getTime(), d.registrant_id as string, lines, handoffs)).map((d) => d.registrant_id as string)));
    const names = missed.length ? ((await db().from("registrants").select("id, first_name").in("id", missed)).data ?? []) : [];
    const byHand = (ghosts.data ?? []).filter((g) => g.auto_ghost_reason === null || String(g.auto_ghost_reason).startsWith("by hand"));
    // The agreement line (SPEC-kaitlyn-solo.md, F): what became of every line she posted or drafted since yesterday; and the staged answers that have waited over a week for his OK (G).
    const [decided, stale] = await Promise.all([
      db().from("kaitlyn_decisions").select("status, skip_reason").eq("event_id", e.id).gte("created_at", since).limit(2000),
      db().from("kaitlyn_kb").select("key").eq("event_id", e.id).not("answer", "is", null).is("approved_at", null).neq("handling", "ignore").lt("answered_at", new Date(now.getTime() - 7 * DAY_MS).toISOString()).order("key").limit(20),
    ]);
    const text = digestText({
      questions: (open.data ?? []).map((r) => ({ question: r.question as string, asked: perKey.get(r.key as string) ?? 1 })),
      people: new Set(asks.map((a) => a.registrant_id as string)).size,
      waiting: waiting.count ?? 0,
      url: `${SITE}/admin/knowledge?event=${e.slug}`,
      unanswered: names.map((r) => r.first_name as string),
      ghosted: byHand.map((g) => ({ name: g.first_name as string, reason: String(g.auto_ghost_reason ?? "").startsWith("by hand: ") ? String(g.auto_ghost_reason).slice(9) : null })),
      posted: postedFrom((decided.data ?? []) as Array<{ status: string; skip_reason?: string | null }>),
      stale: (stale.data ?? []).map((r) => r.key as string),
      owed,
    });
    if (!dry) {
      const sent = text ? await postToIntel(text) : { ok: true };
      // A Slack hiccup leaves the day unrecorded, so the next hourly run tries again.
      if (sent.ok) await db().from("events").update({ kaitlyn_digest_on: today }).eq("id", e.id);
    }
    report.push({ event: e.slug, due, text });
  }
  return Response.json({ now: now.toISOString(), dry, report });
}
