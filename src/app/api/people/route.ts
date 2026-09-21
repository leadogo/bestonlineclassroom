import { db } from "@/lib/db";
import { TOKEN_RE } from "@/lib/registrants";

export const dynamic = "force-dynamic";

const WINDOW_MS = 120_000;

/** GET ?token=: first names of real attendees seen in the last two minutes for the caller's session. */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!TOKEN_RE.test(token)) return Response.json({ error: "Bad token" }, { status: 400 });
  const reg = await db().from("registrants").select("event_id, session_date").eq("token", token).maybeSingle();
  if (reg.error || !reg.data) return Response.json({ error: "Not found" }, { status: 404 });
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const { data, error } = await db()
    .from("attendance")
    .select("last_seen_at, joined_at, registrant_id, registrant:registrants!inner(first_name, event_id, source)")
    .eq("session_date", reg.data.session_date)
    .eq("kind", "live")
    .eq("registrant.event_id", reg.data.event_id)
    .gte("last_seen_at", since)
    .order("last_seen_at", { ascending: false })
    .limit(300);
  if (error) return Response.json({ error: "Lookup failed" }, { status: 500 });
  const rows = (data ?? []).map((row) => ({ id: row.registrant_id as string, joined_at: row.joined_at as string, ...(row.registrant as unknown as { first_name: string; source: string }) })).filter((r) => r.source !== "test");
  const names = Array.from(new Set(rows.map((r) => r.first_name)));
  const people = rows.map((r) => ({ id: r.id, name: r.first_name, sub: `joined ${new Date(r.joined_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` }));
  const mods = await db().from("team_presence").select("member_id, member:team_members!inner(display_name)").eq("event_id", reg.data.event_id).eq("session_date", reg.data.session_date).gte("last_seen_at", since);
  const moderators = (mods.data ?? []).map((m) => ({ id: `m:${m.member_id}`, name: (m.member as unknown as { display_name: string }).display_name }));
  return Response.json({ names, people, moderators }, { headers: { "cache-control": "no-store" } });
}
