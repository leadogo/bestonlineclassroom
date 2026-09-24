import { canModerate, getTeamMember } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { currentOrNextSession, scheduleOf, sessionFor } from "@/lib/daily-schedule";
import { db } from "@/lib/db";
import { getEvent } from "@/lib/events";

export const dynamic = "force-dynamic";

/** GET ?kind=sessions|registrants|chat&days=30&date=YYYY-MM-DD: a CSV download for the team. */
export async function GET(request: Request, ctx: { params: Promise<{ slug: string }> }) {
  const me = await getTeamMember().catch(() => null);
  if (!me) return new Response("Sign in", { status: 401 });
  const { slug } = await ctx.params;
  const event = await getEvent(slug);
  if (!event || !(await canModerate(me, event.id))) return new Response("Not found", { status: 404 });
  const q = new URL(request.url).searchParams;
  const kind = q.get("kind") ?? "sessions";
  const days = q.get("days") === "90" ? 90 : 30;
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  let rows: Array<Array<string | number | null>> = [];
  let name = `${slug}-${kind}`;

  if (kind === "questions") {
    const { data } = await db().from("chat_messages").select("session_date, offset_seconds, author_name, body, answered_by, created_at").eq("event_id", event.id).eq("role", "attendee").eq("is_question", true).is("deleted_at", null).gte("session_date", since).order("created_at", { ascending: false }).limit(5000);
    const team = new Map(((await db().from("team_members").select("id, display_name")).data ?? []).map((m) => [m.id as string, m.display_name as string]));
    rows = [["session", "minute", "who", "question", "answered_by", "asked_at"], ...(data ?? []).map((r) => [r.session_date, Math.floor(((r.offset_seconds as number) ?? 0) / 60), r.author_name, r.body, r.answered_by ? (team.get(r.answered_by as string) ?? "") : "", r.created_at])];
  } else if (kind === "sessions") {
    const { data } = await db().from("session_metrics").select("*").eq("event_id", event.id).gte("session_date", since).order("session_date");
    rows = [["date", "registered", "joined", "attended_15min", "missed", "live_at_pitch", "clicked_offer", "saw_offer_no_click", "watched_replay", "stayed_40min", "asked_question", "left_early", "avg_live_minutes"], ...(data ?? []).map((r) => [r.session_date, r.registered, r.joined, r.attended, r.missed, r.live_at_pitch, r.clicked_offer, r.saw_offer_no_click, r.watched_replay, r.stayed_40min, r.asked_question, r.left_early, Math.round(r.avg_live_seconds / 60)])];
  } else if (kind === "registrants") {
    const { data } = await db().from("registrant_outcomes").select("*").eq("event_id", event.id).gte("session_date", since).neq("source", "test").order("session_date").limit(20000);
    const ids = (data ?? []).map((r) => r.registrant_id as string);
    const sent = new Map<string, string[]>();
    for (let i = 0; i < ids.length; i += 500) {
      const { data: t } = await db().from("outcome_tags").select("registrant_id, tag").in("registrant_id", ids.slice(i, i + 500));
      for (const x of t ?? []) sent.set(x.registrant_id, [...(sent.get(x.registrant_id) ?? []), x.tag]);
    }
    rows = [["session_date", "first_name", "email", "source", "joined", "live_minutes", "reached_minute", "replay_minutes", "live_at_pitch", "clicked_offer", "asked_question", "tags_sent"], ...(data ?? []).map((r) => [r.session_date, r.first_name, r.email, r.source, r.joined ? "yes" : "", Math.round(r.live_seconds / 60), Math.round(r.live_max_offset / 60), Math.round(r.replay_seconds / 60), r.live_at_pitch ? "yes" : "", r.clicked_offer ? "yes" : "", r.asked_question ? "yes" : "", (sent.get(r.registrant_id) ?? []).join(" ")])];
  } else {
    const schedule = scheduleOf(event);
    const session = sessionFor(schedule, q.get("date")) ?? currentOrNextSession(schedule);
    name = `${slug}-chat-${session.date}`;
    const past = Date.now() >= session.end.getTime();
    const [real, sim] = await Promise.all([
      db().from("chat_messages").select("offset_seconds, author_name, role, body, deleted_at, visibility, created_at, registrant:registrants(email, source)").neq("visibility", "team").eq("event_id", event.id).eq("session_date", session.date).order("id").limit(5000),
      db().from("simulated_messages").select("offset_seconds, name, body").eq("event_id", event.id).order("offset_seconds").limit(5000),
    ]);
    const all = [
      ...(real.data ?? []).map((m) => ({ at: m.offset_seconds as number, kind: (m.role as string) === "moderator" ? "moderator" : "real", name: m.author_name as string, email: (m.registrant as unknown as { email: string | null } | null)?.email ?? "", body: m.body as string, note: [m.deleted_at ? "deleted" : "", m.visibility === "author" ? "ghosted" : "", (m.registrant as unknown as { source: string } | null)?.source === "test" ? "test" : ""].filter(Boolean).join(" "), when: m.created_at as string })),
      ...(sim.data ?? []).map((m) => ({ at: m.offset_seconds as number, kind: "simulated", name: m.name as string, email: "", body: m.body as string, note: "", when: "" })),
    ].sort((x, y) => x.at - y.at);
    const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    rows = [...(past ? [[`recorded: ${event.title} session ${session.date}, exported ${new Date().toISOString()}`]] : []), ["offset", "kind", "name", "email", "message", "note", "sent_at"], ...all.map((m) => [mmss(m.at), m.kind, m.name, m.email, m.body, m.note, m.when])];
  }
  return new Response(toCsv(rows), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${name}.csv"`, "cache-control": "no-store" } });
}
