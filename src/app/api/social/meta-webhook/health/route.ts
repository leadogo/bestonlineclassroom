import { relayHealth } from "@/lib/meta-relay";
import { socialGate } from "@/lib/social";

export const dynamic = "force-dynamic";

/** GET (Bearer SOCIAL_LOOKUP_SECRET): the relay's last event time and its last 24 h of forwards and failures, for Stacy to watch. */
export async function GET(request: Request) {
  const denied = socialGate(request);
  if (denied) return denied;
  try {
    return Response.json(await relayHealth(), { headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error("[meta-relay] health failed", e);
    return Response.json({ error: "Read failed" }, { status: 500 });
  }
}
