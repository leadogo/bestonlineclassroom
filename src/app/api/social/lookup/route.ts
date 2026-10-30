import { normalizeEmail } from "@/lib/registrants";
import { lookupPerson, socialGate } from "@/lib/social";
import { createHash } from "node:crypto";

export const dynamic = "force-dynamic";

/**
 * GET /api/social/lookup?email= (Bearer SOCIAL_LOOKUP_SECRET): for Stacy, William's social manager bot. Whether this
 * email ever registered for the free training, attended it (15+ live minutes) or booked a call, and the newest session
 * date. Yes/no only, nothing else about the person. Every call is logged with the email's hash, never the email.
 */
export async function GET(request: Request) {
  const denied = socialGate(request);
  if (denied) return denied;
  const email = normalizeEmail(new URL(request.url).searchParams.get("email"));
  if (!email) return Response.json({ error: "Bad email" }, { status: 400 });
  try {
    const answer = await lookupPerson(email);
    console.log("[social-lookup]", createHash("sha256").update(email).digest("hex").slice(0, 12), JSON.stringify(answer));
    return Response.json(answer, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error("[social-lookup] failed", e);
    return Response.json({ error: "Lookup failed" }, { status: 500 });
  }
}
