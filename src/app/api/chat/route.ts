import { after } from "next/server";
import { MAX_BODY, POST_GAP_MS, slackLine } from "@/lib/chat";
import { checkMessage } from "@/lib/chat-filter";
import { db } from "@/lib/db";
import { clientIp, ipBlocked } from "@/lib/ip";
import { mine } from "@/lib/reactions";
import { TOKEN_RE } from "@/lib/registrants";
import { postToChatChannel } from "@/lib/slack";
import { tagNow } from "@/lib/tagging";

export const dynamic = "force-dynamic";

const HISTORY = 300;
const SELECT = "id, registrant_id, team_member_id, author_name, role, body, offset_seconds, reactions, mentions, created_at";

async function registrant(token: string) {
  if (!TOKEN_RE.test(token)) return null;
  const { data } = await db().from("registrants").select("id, event_id, session_date, first_name, email, blocked_at, ghosted_at, ip, source").eq("token", token).maybeSingle();
  return data;
}

/** GET ?token=&after=<id>&since=<iso>: new real messages after `after`, and deletes/reactions since `since`. */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const r = await registrant(q.get("token") ?? "");
  if (!r) return Response.json({ error: "Not found" }, { status: 404 });
  const after_ = Number(q.get("after") ?? 0) || 0;
  const since = q.get("since") ?? "";
  // Ghosted people see their own rows; nobody else does.
  const scope = () => db().from("chat_messages").select(SELECT).eq("event_id", r.event_id).eq("session_date", r.session_date).or(`visibility.eq.all,registrant_id.eq.${r.id}`);

  const fresh = after_ === 0
    ? await scope().is("deleted_at", null).order("id", { ascending: false }).limit(HISTORY)
    : await scope().is("deleted_at", null).gt("id", after_).order("id").limit(HISTORY);
  if (fresh.error) return Response.json({ error: "Lookup failed" }, { status: 500 });
  const news = after_ === 0 ? (fresh.data ?? []).reverse() : (fresh.data ?? []);

  let updated: Array<{ id: number; reactions: Record<string, number>; deleted: boolean }> = [];
  if (since && after_ > 0) {
    const u = await db().from("chat_messages").select("id, reactions, deleted_at").eq("event_id", r.event_id).eq("session_date", r.session_date).lte("id", after_).gt("updated_at", since).limit(200);
    updated = (u.data ?? []).map((m) => ({ id: m.id, reactions: (m.reactions as Record<string, number>) ?? {}, deleted: Boolean(m.deleted_at) }));
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
  if (wanted.length) {
    const rids = wanted.filter((m) => /^[0-9a-f-]{36}$/i.test(m));
    const mids = wanted.filter((m) => /^m:[0-9a-f-]{36}$/i.test(m)).map((m) => m.slice(2));
    if (rids.length) mentions.push(...((await db().from("registrants").select("id").eq("event_id", r.event_id).eq("session_date", r.session_date).in("id", rids)).data ?? []).map((x) => x.id as string));
    if (mids.length) mentions.push(...((await db().from("team_members").select("id").in("id", mids)).data ?? []).map((x) => `m:${x.id}`));
  }
  const ins = await db()
    .from("chat_messages")
    .insert({ event_id: r.event_id, session_date: r.session_date, registrant_id: r.id, author_name: r.first_name, role: "attendee", body, offset_seconds: offset, visibility: r.ghosted_at ? "author" : "all", mentions })
    .select(SELECT)
    .single();
  if (ins.error) {
    console.error("[chat] insert failed", { code: ins.error.code });
    return Response.json({ error: "Please try again." }, { status: 500 });
  }
  if (r.source !== "test" && !r.ghosted_at) after(() => postToChatChannel(slackLine(r.first_name, r.email, body)));
  after(() => tagNow(r.id, "asked_question"));
  return Response.json({ message: ins.data });
}
