import { canModerate, getTeamMember } from "@/lib/auth";
import { currentOrNextSession, scheduleOf, sessionFor } from "@/lib/daily-schedule";
import { db } from "@/lib/db";
import { getEvent } from "@/lib/events";
import { blockAtEdge, edgeConfigured, unblockAtEdge } from "@/lib/edge-block";
import { forgetBlockedIps } from "@/lib/ip";
import { toggleReaction } from "@/lib/reactions";
import { withQuery } from "@/lib/params";
import { peakConcurrent } from "@/lib/outcomes";

export const dynamic = "force-dynamic";

const SELECT = "id, registrant_id, author_name, role, body, offset_seconds, reactions, deleted_at, created_at, visibility, mentions, mention_names";

/** The event's booking link with `src=chat` (and, per person, their first name and id so the form greets them). Null when the link is not a URL. */
function bookingLink(base: string | null, person?: { first_name: string; registrant_id: string }): string | null {
  if (!base) return null;
  try {
    return withQuery(base, { src: "chat", ...(person ? { iclosedName: person.first_name, rid: person.registrant_id } : {}) });
  } catch {
    return null;
  }
}

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
  const tab = (q.get("tab") ?? "").slice(0, 20) || null;
  const replyingTo = (q.get("to") ?? "").slice(0, 60) || null;
  await db().from("team_presence").upsert({ member_id: member.id, event_id: s.event.id, session_date: s.session.date, last_seen_at: new Date().toISOString(), tab, replying_to: replyingTo }, { onConflict: "member_id,event_id,session_date" });
  const base = () => db().from("chat_messages").select(SELECT).eq("event_id", s.event.id).eq("session_date", s.session.date).gte("created_at", s.session.start.toISOString());
  const fresh = after_ === 0 ? await base().order("id", { ascending: false }).limit(400) : await base().gt("id", after_).order("id").limit(400);
  const news = after_ === 0 ? (fresh.data ?? []).reverse() : (fresh.data ?? []);
  let updated: Array<{ id: number; reactions: Record<string, number>; deleted: boolean }> = [];
  if (since && after_ > 0) {
    const u = await db().from("chat_messages").select("id, reactions, deleted_at, author_name").eq("event_id", s.event.id).eq("session_date", s.session.date).lte("id", after_).gt("updated_at", since).limit(300);
    updated = (u.data ?? []).map((m) => ({ id: m.id, reactions: (m.reactions as Record<string, number>) ?? {}, deleted: Boolean(m.deleted_at), name: m.author_name as string }));
  }
  // Everyone who joined this session, with what they did: the People, Engagement and Stats tabs read this list.
  const nowMs = Date.now();
  const pitchAt = s.event.cta_at_seconds !== null ? s.session.start.getTime() + s.event.cta_at_seconds * 1000 : null;
  const ppl = await db()
    .from("attendance")
    .select("last_seen_at, joined_at, seconds_watched, cta_clicked_at, registrant_id, registrant:registrants!inner(first_name, email, source, event_id, ghosted_at, ip)")
    .eq("session_date", s.session.date)
    .eq("kind", "live")
    .eq("registrant.event_id", s.event.id)
    .order("last_seen_at", { ascending: false })
    .limit(600);
  const blocked = new Set(((await db().from("blocked_ips").select("ip")).data ?? []).map((b) => String(b.ip)));
  const rows = (ppl.data ?? []).filter((row) => (row.registrant as unknown as { source: string }).source !== "test" || true);
  const people = rows.map((row) => {
    const r = row.registrant as unknown as { first_name: string; email: string | null; source: string; ghosted_at: string | null; ip: string | null };
    const masked = r.email ? r.email.replace(/^(.{3}).*(@.*)$/, "$1…$2") : "guest";
    const joinedMs = new Date(row.joined_at as string).getTime();
    const seenMs = new Date(row.last_seen_at as string).getTime();
    return {
      first_name: r.first_name, source: r.source, last_seen_at: row.last_seen_at, joined_at: row.joined_at, registrant_id: row.registrant_id,
      in_room: nowMs - seenMs < 120_000, minutes: Math.round(((row.seconds_watched as number) ?? 0) / 60), clicked_offer: Boolean(row.cta_clicked_at),
      at_pitch: pitchAt !== null && pitchAt <= nowMs && joinedMs <= pitchAt && seenMs >= pitchAt,
      ghosted: Boolean(r.ghosted_at), has_ip: Boolean(r.ip), ip_blocked: Boolean(r.ip && blocked.has(r.ip)), email_masked: masked,
      booking_href: bookingLink(s.event.cta_href, { first_name: r.first_name, registrant_id: row.registrant_id }),
    };
  });
  const real = people.filter((p) => p.source !== "test");
  const registered = await db().from("registrants").select("id", { count: "exact", head: true }).eq("event_id", s.event.id).eq("session_date", s.session.date).neq("source", "test");
  const stats = {
    registered: registered.count ?? 0,
    joined: real.length,
    in_room: real.filter((p) => p.in_room).length,
    peak: peakConcurrent(rows.map((row) => ({ from: new Date(row.joined_at as string).getTime(), to: new Date(row.last_seen_at as string).getTime() }))),
    pitch_at: pitchAt,
    at_pitch: pitchAt !== null && pitchAt <= nowMs ? real.filter((p) => p.at_pitch).length : null,
    clicked: real.filter((p) => p.clicked_offer).length,
    stayed_15: real.filter((p) => p.minutes >= 15).length,
  };
  const team = ((await db().from("team_members").select("id, display_name")).data ?? []).map((m) => ({ id: `m:${m.id}`, name: m.display_name as string }));
  const presence = await db().from("team_presence").select("member_id, tab, replying_to, last_seen_at").eq("event_id", s.event.id).eq("session_date", s.session.date).gte("last_seen_at", new Date(nowMs - 60_000).toISOString());
  const desk = (presence.data ?? []).map((p) => ({ member_id: p.member_id, name: team.find((t) => t.id === `m:${p.member_id}`)?.name ?? "Team", tab: p.tab, replying_to: p.replying_to, last_seen_at: p.last_seen_at }));
  return Response.json({ new: news, updated, people, team, desk, stats, now: new Date().toISOString(), edge: edgeConfigured(), session_start: s.session.start.getTime(), session_date: s.session.date, booking_href: bookingLink(s.event.cta_href) }, { headers: { "cache-control": "no-store" } });
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
      // The team channel: a moderator row only the desk reads (the attendee feed selects 'all' or the person's own rows).
      if (b.team === true) {
        const { data, error } = await db().from("chat_messages").insert({ event_id: s.event.id, session_date: s.session.date, team_member_id: member.id, author_name: member.display_name, role: "moderator", body, offset_seconds: offset, visibility: "team", mentions: [], mention_names: [] }).select(SELECT).single();
        if (error) return Response.json({ error: "Could not send." }, { status: 500 });
        return Response.json({ message: data });
      }
      const wanted = Array.isArray(b.mentions) ? (b.mentions as unknown[]).map(String).slice(0, 10) : [];
      const mentions: string[] = [];
      const mention_names: string[] = [];
      const rids = wanted.filter((m) => /^[0-9a-f-]{36}$/i.test(m));
      const mids = wanted.filter((m) => /^m:[0-9a-f-]{36}$/i.test(m)).map((m) => m.slice(2));
      if (rids.length) for (const x of (await db().from("registrants").select("id, first_name").eq("event_id", s.event.id).eq("session_date", s.session.date).in("id", rids)).data ?? []) { mentions.push(x.id as string); mention_names.push(x.first_name as string); }
      if (mids.length) for (const x of (await db().from("team_members").select("id, display_name").in("id", mids)).data ?? []) { mentions.push(`m:${x.id}`); mention_names.push(x.display_name as string); }
      const { data, error } = await db().from("chat_messages").insert({ event_id: s.event.id, session_date: s.session.date, team_member_id: member.id, author_name: member.display_name, role: "moderator", body, offset_seconds: offset, mentions, mention_names }).select(SELECT).single();
      if (error) return Response.json({ error: "Could not send." }, { status: 500 });
      return Response.json({ message: data });
    }
    case "rename": {
      // Your own display name, everywhere: the team row and every message you ever sent (they reach open rooms through the update stream).
      const name = String(b.name ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
      if (!/^[\p{L}\p{N}][\p{L}\p{N} .'’-]{0,39}$/u.test(name)) return Response.json({ error: "Letters, numbers, spaces and .'- only, up to 40 characters." }, { status: 422 });
      const r1 = await db().from("team_members").update({ display_name: name }).eq("id", member.id);
      if (r1.error) return Response.json({ error: "Could not rename." }, { status: 500 });
      await db().from("chat_messages").update({ author_name: name, updated_at: now }).eq("team_member_id", member.id);
      return Response.json({ ok: true, display_name: name });
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
      const cur = await db().from("chat_messages").select("id").eq("id", id).eq("event_id", s.event.id).maybeSingle();
      if (!cur.data) return Response.json({ error: "Which message?" }, { status: 422 });
      const res = await toggleReaction(id, `m:${member.id}`, String(b.emoji ?? ""));
      if (!res) return Response.json({ error: "Not one of the reactions." }, { status: 422 });
      return Response.json(res);
    }
    case "ghost":
    case "unghost": {
      const rid = String(b.registrant_id ?? "");
      if (!/^[0-9a-f-]{36}$/i.test(rid)) return Response.json({ error: "Which person?" }, { status: 422 });
      const { error } = await db().from("registrants").update({ ghosted_at: b.action === "ghost" ? now : null }).eq("id", rid).eq("event_id", s.event.id);
      if (error) return Response.json({ error: "Could not change that." }, { status: 500 });
      return Response.json({ ok: true });
    }
    case "block_ip": {
      const rid = String(b.registrant_id ?? "");
      const r = await db().from("registrants").select("ip, first_name").eq("id", rid).eq("event_id", s.event.id).maybeSingle();
      const ip = r.data?.ip ? String(r.data.ip) : null;
      if (!ip) return Response.json({ error: "No IP on record for them yet." }, { status: 422 });
      const edge_id = await blockAtEdge(ip, `${r.data?.first_name} blocked by ${member.display_name} ${now.slice(0, 10)}`);
      const { error } = await db().from("blocked_ips").upsert({ ip, reason: `chat, ${r.data?.first_name}`, by: member.id, edge_id }, { onConflict: "ip" });
      if (error) return Response.json({ error: "Could not block the IP." }, { status: 500 });
      forgetBlockedIps();
      await db().from("registrants").update({ blocked_at: now }).eq("ip", ip).is("blocked_at", null);
      await db().from("chat_messages").update({ deleted_at: now, updated_at: now }).eq("registrant_id", rid).is("deleted_at", null);
      return Response.json({ ok: true, edge: Boolean(edge_id) });
    }
    case "unblock_ip": {
      const rid = String(b.registrant_id ?? "");
      const r = await db().from("registrants").select("ip").eq("id", rid).eq("event_id", s.event.id).maybeSingle();
      const ip = r.data?.ip ? String(r.data.ip) : null;
      if (!ip) return Response.json({ error: "No IP on record." }, { status: 422 });
      const row = await db().from("blocked_ips").select("edge_id").eq("ip", ip).maybeSingle();
      if (row.data?.edge_id) await unblockAtEdge(row.data.edge_id as string);
      await db().from("blocked_ips").delete().eq("ip", ip);
      forgetBlockedIps();
      await db().from("registrants").update({ blocked_at: null }).eq("id", rid);
      return Response.json({ ok: true });
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
