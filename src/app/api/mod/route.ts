import { canModerate, getTeamMember } from "@/lib/auth";
import { currentOrNextSession, scheduleOf, sessionFor } from "@/lib/daily-schedule";
import { db } from "@/lib/db";
import { getEvent } from "@/lib/events";
import { applyReaction } from "@/lib/moderation";

export const dynamic = "force-dynamic";

const SELECT = "id, registrant_id, author_name, role, body, offset_seconds, reactions, deleted_at, created_at";

async function scope(sp: { event?: string | null; date?: string | null }) {
  const event = await getEvent(sp.event || "ailg-r").catch(() => null);
  if (!event) return null;
  const schedule = scheduleOf(event);
  const session = sessionFor(schedule, sp.date) ?? currentOrNextSession(schedule);
  return { event, session };
}

/** GET ?event=&date=&after=&since=: every real message (deleted ones flagged), changes, and who is in the room. */
export async function GET(request: Request) {
  const member = await getTeamMember().catch(() => null);
  if (!member) return Response.json({ error: "Sign in" }, { status: 401 });
  const q = new URL(request.url).searchParams;
  const s = await scope({ event: q.get("event"), date: q.get("date") });
  if (!s) return Response.json({ error: "Unknown event" }, { status: 404 });
  if (!(await canModerate(member, s.event.id))) return Response.json({ error: "Not your webinar" }, { status: 403 });
  const after_ = Number(q.get("after") ?? 0) || 0;
  const since = q.get("since") ?? "";
  const base = () => db().from("chat_messages").select(SELECT).eq("event_id", s.event.id).eq("session_date", s.session.date);
  const fresh = after_ === 0 ? await base().order("id", { ascending: false }).limit(400) : await base().gt("id", after_).order("id").limit(400);
  const news = after_ === 0 ? (fresh.data ?? []).reverse() : (fresh.data ?? []);
  let updated: Array<{ id: number; reactions: Record<string, number>; deleted: boolean }> = [];
  if (since && after_ > 0) {
    const u = await db().from("chat_messages").select("id, reactions, deleted_at").eq("event_id", s.event.id).eq("session_date", s.session.date).lte("id", after_).gt("updated_at", since).limit(300);
    updated = (u.data ?? []).map((m) => ({ id: m.id, reactions: (m.reactions as Record<string, number>) ?? {}, deleted: Boolean(m.deleted_at) }));
  }
  const ppl = await db()
    .from("attendance")
    .select("last_seen_at, registrant_id, registrant:registrants!inner(first_name, source, event_id)")
    .eq("session_date", s.session.date)
    .eq("kind", "live")
    .eq("registrant.event_id", s.event.id)
    .gte("last_seen_at", new Date(Date.now() - 120_000).toISOString())
    .order("last_seen_at", { ascending: false })
    .limit(300);
  const people = (ppl.data ?? []).map((row) => {
    const r = row.registrant as unknown as { first_name: string; source: string };
    return { first_name: r.first_name, source: r.source, last_seen_at: row.last_seen_at, registrant_id: row.registrant_id };
  });
  return Response.json({ new: news, updated, people, now: new Date().toISOString() }, { headers: { "cache-control": "no-store" } });
}

/** POST { event, date, action: reply | delete | block | react, ... } */
export async function POST(request: Request) {
  const member = await getTeamMember().catch(() => null);
  if (!member) return Response.json({ error: "Sign in" }, { status: 401 });
  let b: Record<string, unknown>;
  try {
    b = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const s = await scope({ event: String(b.event ?? ""), date: typeof b.date === "string" ? b.date : null });
  if (!s) return Response.json({ error: "Unknown event" }, { status: 404 });
  if (!(await canModerate(member, s.event.id))) return Response.json({ error: "Not your webinar" }, { status: 403 });
  const now = new Date().toISOString();

  switch (b.action) {
    case "reply": {
      const body = String(b.body ?? "").trim().slice(0, 500);
      if (!body) return Response.json({ error: "Type a reply first." }, { status: 422 });
      const offset = Math.max(0, Math.floor((Date.now() - s.session.start.getTime()) / 1000));
      const { data, error } = await db().from("chat_messages").insert({ event_id: s.event.id, session_date: s.session.date, team_member_id: member.id, author_name: member.display_name, role: "moderator", body, offset_seconds: offset }).select(SELECT).single();
      if (error) return Response.json({ error: "Could not send." }, { status: 500 });
      return Response.json({ message: data });
    }
    case "delete": {
      const id = Number(b.id);
      if (!id) return Response.json({ error: "Which message?" }, { status: 422 });
      const { error } = await db().from("chat_messages").update({ deleted_at: now, updated_at: now }).eq("id", id).eq("event_id", s.event.id);
      if (error) return Response.json({ error: "Could not delete." }, { status: 500 });
      return Response.json({ ok: true });
    }
    case "react": {
      const id = Number(b.id);
      const emoji = String(b.emoji ?? "");
      const cur = await db().from("chat_messages").select("reactions").eq("id", id).eq("event_id", s.event.id).maybeSingle();
      if (!cur.data) return Response.json({ error: "Which message?" }, { status: 422 });
      const next = applyReaction(cur.data.reactions as Record<string, number>, emoji);
      if (!next) return Response.json({ error: "Not one of the reactions." }, { status: 422 });
      const { error } = await db().from("chat_messages").update({ reactions: next, updated_at: now }).eq("id", id);
      if (error) return Response.json({ error: "Could not react." }, { status: 500 });
      return Response.json({ reactions: next });
    }
    case "block": {
      const rid = String(b.registrant_id ?? "");
      if (!/^[0-9a-f-]{36}$/i.test(rid)) return Response.json({ error: "Which person?" }, { status: 422 });
      const r1 = await db().from("registrants").update({ blocked_at: now }).eq("id", rid).eq("event_id", s.event.id);
      if (r1.error) return Response.json({ error: "Could not block." }, { status: 500 });
      await db().from("chat_messages").update({ deleted_at: now, updated_at: now }).eq("registrant_id", rid).is("deleted_at", null);
      return Response.json({ ok: true });
    }
    default:
      return Response.json({ error: "Unknown action." }, { status: 422 });
  }
}
