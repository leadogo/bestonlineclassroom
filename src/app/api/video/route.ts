import { registrantByToken } from "@/lib/attendees";
import { TOKEN_RE } from "@/lib/registrants";

export const dynamic = "force-dynamic";

/**
 * GET ?token=: the recording's URL for a valid registrant, fetched by the player after the page has loaded so the
 * address never sits in the page source (William, 2026-09-20). Replay tokens past their window get nothing.
 */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const token = q.get("token") ?? "";
  if (!TOKEN_RE.test(token)) return Response.json({ error: "Bad token" }, { status: 400 });
  const r = await registrantByToken(token).catch(() => null);
  if (!r || !r.event.video_url) return Response.json({ error: "Not found" }, { status: 404 });
  if (q.get("kind") === "replay" && r.replay_opened_at && r.event.replay_hours > 0) {
    const expiresAt = new Date(r.replay_opened_at).getTime() + r.event.replay_hours * 3_600_000;
    if (Date.now() >= expiresAt) return Response.json({ error: "Expired" }, { status: 410 });
  }
  return Response.json({ url: r.event.video_url }, { headers: { "cache-control": "private, no-store" } });
}
