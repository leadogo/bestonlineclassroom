// Skool's custom webhook: one GET with ?email= and the person receives an instant invite to the group. Once per
// registrant (skool_invited_at). Best-effort.
import { db } from "./db.ts";

const HOOK = process.env.SKOOL_INVITE_WEBHOOK ?? "";

export async function inviteToSkool(registrantId: string, email: string): Promise<void> {
  if (!HOOK) return;
  try {
    const { data } = await db().from("registrants").select("skool_invited_at, source").eq("id", registrantId).maybeSingle();
    if (!data || data.skool_invited_at || data.source === "test") return;
    const res = await fetch(`${HOOK}${HOOK.includes("?") ? "&" : "?"}email=${encodeURIComponent(email)}`, { method: "GET", signal: AbortSignal.timeout(10_000) });
    if (!res.ok) {
      console.error("[skool] invite failed", { status: res.status });
      return;
    }
    await db().from("registrants").update({ skool_invited_at: new Date().toISOString() }).eq("id", registrantId);
  } catch (err) {
    console.error("[skool] invite threw", { err: String(err) });
  }
}
