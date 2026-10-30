import { loadFunnel, socialGate } from "@/lib/social";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/social/funnel?weeks=4 (Bearer SOCIAL_LOOKUP_SECRET): Stacy's weekly numbers. Registrants whose link said
 * utm_source=social, by session week (Monday start) and utm_medium (ig_dm, fb_dm, ig_comment, fb_comment), and how many
 * of them attended (15+ live minutes) and booked a call. Counts only.
 */
export async function GET(request: Request) {
  const denied = socialGate(request);
  if (denied) return denied;
  const weeks = Math.min(26, Math.max(1, Number(new URL(request.url).searchParams.get("weeks")) || 4));
  const since = new Date(Date.now() - weeks * 7 * 86_400_000).toISOString().slice(0, 10);
  try {
    return Response.json({ since, weeks: await loadFunnel(since) }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error("[social-funnel] failed", e);
    return Response.json({ error: "Read failed" }, { status: 500 });
  }
}
