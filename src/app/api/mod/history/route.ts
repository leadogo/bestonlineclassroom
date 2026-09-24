import { canModerate, getTeamMember } from "@/lib/auth";
import { getEvent } from "@/lib/events";
import { loadHistory } from "@/lib/history";

export const dynamic = "force-dynamic";

/** GET ?event=&today=: the last 28 sessions' at-the-pitch count and bookings, with the minute curve for the last ten, for the desk's projection and typical-night tile. */
export async function GET(request: Request) {
  const member = await getTeamMember().catch(() => null);
  if (!member) return Response.json({ error: "Sign in" }, { status: 401 });
  const q = new URL(request.url).searchParams;
  const event = await getEvent(q.get("event") ?? "ailg-r").catch(() => null);
  if (!event) return Response.json({ error: "Unknown event" }, { status: 404 });
  if (!(await canModerate(member, event.id))) return Response.json({ error: "Not your webinar" }, { status: 403 });
  const sessions = await loadHistory(event, q.get("today") || "9999-12-31");
  return Response.json({ sessions }, { headers: { "cache-control": "no-store" } });
}
