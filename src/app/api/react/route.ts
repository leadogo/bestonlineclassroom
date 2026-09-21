import { db } from "@/lib/db";
import { toggleReaction } from "@/lib/reactions";
import { TOKEN_RE } from "@/lib/registrants";

export const dynamic = "force-dynamic";

/** POST { token, id, emoji }: toggles the caller's reaction on a real message in their session. */
export async function POST(request: Request) {
  let b: { token?: string; id?: number; emoji?: string };
  try {
    b = (await request.json()) as typeof b;
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const token = String(b.token ?? "");
  if (!TOKEN_RE.test(token)) return Response.json({ error: "Not found" }, { status: 404 });
  const { data: r } = await db().from("registrants").select("id, event_id, session_date, blocked_at").eq("token", token).maybeSingle();
  if (!r || r.blocked_at) return Response.json({ error: "Not found" }, { status: 404 });
  const id = Number(b.id);
  const msg = await db().from("chat_messages").select("id").eq("id", id).eq("event_id", r.event_id).eq("session_date", r.session_date).is("deleted_at", null).maybeSingle();
  if (!msg.data) return Response.json({ error: "Which message?" }, { status: 422 });
  const res = await toggleReaction(id, r.id, String(b.emoji ?? ""));
  if (!res) return Response.json({ error: "Not one of the reactions." }, { status: 422 });
  return Response.json(res);
}
