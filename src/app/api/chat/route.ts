import { after } from "next/server";
import { MAX_BODY, POST_GAP_MS, slackLine } from "@/lib/chat";
import { checkMessage } from "@/lib/chat-filter";
import { db } from "@/lib/db";
import { clientIp, ipBlocked } from "@/lib/ip";
import { mine } from "@/lib/reactions";
import { TOKEN_RE } from "@/lib/registrants";
import { scheduleOf, sessionFor } from "@/lib/daily-schedule";
import { postToChatChannel } from "@/lib/slack";
import { tagNow } from "@/lib/tagging";
import { katherineReply } from "@/lib/katherine";

export const dynamic = "force-dynamic";

const HISTORY = 300;
const SELECT = "id, registrant_id, team_member_id, author_name, role, body, offset_seconds, reactions, mentions, mention_names, created_at";

async function registrant(token: string) {
  if (!TOKEN_RE.test(token)) return null;
  const { data } = await db().from("registrants").select("id, event_id, session_date, first_name, email, blocked_at, ghosted_at, ip, source, event:events(timezone, start_time, video_seconds, days, katherine_enabled)").eq("token", token).maybeSingle();
  if (!data) return null;
  const ev = data.event as unknown as { timezone: string; start_time: string; video_seconds: number | null; days: number[]; katherine_enabled?: boolean } | null;
  const start = ev ? sessionFor(scheduleOf(ev), data.session_date as string)?.start ?? null : null;
  return { ...data, sessionStart: start ? start.toISOString() : null, katherine: Boolean(ev?.katherine_enabled) };
}

/** GET ?token=&after=<id>&since=<iso>: new real messages after `after`, and deletes/reactions since `since`. */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const r = await registrant(q.get("token") ?? "");
  if (!r) return Response.json({ error: "Not found" }, { status: 404 });
  if (r.blocked_at) return Response.json({ error: "Removed" }, { status: 403 });
  const after_ = Number(q.get("after") ?? 0) || 0;
  const since = q.get("since") ?? "";
  // Ghosted people see their own rows; nobody else does.
  const scope = () => {
    const q = db().from("chat_messages").select(SELECT).eq("event_id", r.event_id).eq("session_date", r.session_date).or(`visibility.eq.all,registrant_id.eq.${r.id}`);
    return r.sessionStart ? q.gte("created_at", r.sessionStart) : q;
  };

  const fresh = after_ === 0
    ? await scope().is("deleted_at", null).order("id", { ascending: false }).limit(HISTORY)
    : await scope().is("deleted_at", null).gt("id", after_).order("id").limit(HISTORY);
  if (fresh.error) return Response.json({ error: "Lookup failed" }, { status: 500 });
  const news = after_ === 0 ? (fresh.data ?? []).reverse() : (fresh.data ?? []);

  let updated: Array<{ id: number; reactions: Record<string, number>; deleted: boolean }> = [];
  if (since && after_ > 0) {
    const u = await db().from("chat_messages").select("id, reactions, deleted_at, author_name").eq("event_id", r.event_id).eq("session_date", r.session_date).lte("id", after_).gt("updated_at", since).limit(200);
    updated = (u.data ?? []).map((m) => ({ id: m.id, reactions: (m.reactions as Record<string, number>) ?? {}, deleted: Boolean(m.deleted_at), name: m.author_name as string }));
  }
  const own = after_ === 0 ? await mine(r.id, news.map((m) => m.id)) : [];
  return Response.json({ new: news, updated, now: new Date().toISOString(), you: r.id, mine: own }, { headers: { "cache-control": "no-store" } });
}

/** POST { token, body, offset }: a real attendee message, relayed to Slack in the background. */
export async function POST(request: Request) {
  let b: { token?: string; body?: string; offset?: number; mentions?: string[] };
  try {
    b = (await request.json()) as typeof b;
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const r = await registrant(String(b.token ?? ""));
  if (!r) return Response.json({ error: "Not found" }, { status: 404 });
  const ip = clientIp(request.headers);
  if (r.blocked_at || (await ipBlocked(ip))) return Response.json({ error: "Chat is unavailable." }, { status: 403 });
  if (!r.ip && ip) after(async () => { await db().from("registrants").update({ ip, ip_seen_at: new Date().toISOString() }).eq("id", r.id).is("ip", null); });
  const body = String(b.body ?? "").trim().slice(0, MAX_BODY);
  if (!body) return Response.json({ error: "Type a message first." }, { status: 422 });
  const verdict = checkMessage(body);
  if (!verdict.ok) return Response.json({ error: verdict.reason }, { status: 422 });

  const last = await db().from("chat_messages").select("created_at").eq("registrant_id", r.id).order("id", { ascending: false }).limit(1).maybeSingle();
  if (last.data && Date.now() - new Date(last.data.created_at).getTime() < POST_GAP_MS) {
    return Response.json({ error: "One message at a time." }, { status: 429 });
  }
  const offset = typeof b.offset === "number" && Number.isFinite(b.offset) ? Math.max(0, Math.floor(b.offset)) : 0;
  // Mentions: registrant ids in this session, or m:<team member id>; anything else is dropped.
  const wanted = Array.isArray(b.mentions) ? b.mentions.map(String).slice(0, 10) : [];
  const mentions: string[] = [];
  const mention_names: string[] = [];
  if (wanted.length) {
    const rids = wanted.filter((m) => /^[0-9a-f-]{36}$/i.test(m));
    const mids = wanted.filter((m) => /^m:[0-9a-f-]{36}$/i.test(m)).map((m) => m.slice(2));
    if (rids.length) for (const x of (await db().from("registrants").select("id, first_name").eq("event_id", r.event_id).eq("session_date", r.session_date).in("id", rids)).data ?? []) { mentions.push(x.id as string); mention_names.push(x.first_name as string); }
    if (mids.length) for (const x of (await db().from("team_members").select("id, display_name").in("id", mids)).data ?? []) { mentions.push(`m:${x.id}`); mention_names.push(x.display_name as string); }
  }
  const ins = await db()
    .from("chat_messages")
    .insert({ event_id: r.event_id, session_date: r.session_date, registrant_id: r.id, author_name: r.first_name, role: "attendee", body, offset_seconds: offset, visibility: r.ghosted_at ? "author" : "all", mentions, mention_names })
    .select(SELECT)
    .single();
  if (ins.error) {
    console.error("[chat] insert failed", { code: ins.error.code });
    return Response.json({ error: "Please try again." }, { status: 500 });
  }
  if (r.source !== "test" && !r.ghosted_at) after(() => postToChatChannel(slackLine(r.first_name, r.email, body)));
  after(() => tagNow(r.id, "asked_question"));
  // Katherine answers the replay question (switch per event), a few seconds later, once per person.
  if (r.katherine && !r.ghosted_at) after(() => katherineReply({ id: r.id, event_id: r.event_id, session_date: r.session_date, first_name: r.first_name }, body, offset));
  return Response.json({ message: ins.data });
}
