import { getTeamMember } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** GET: the directory's client count per market for the desk's Answer chips (any signed-in team member). */
export async function GET() {
  const member = await getTeamMember().catch(() => null);
  if (!member) return Response.json({ error: "Sign in" }, { status: 401 });
  const { data, error } = await db().from("market_counts").select("name, clients, live, synced_at").order("name");
  if (error) return Response.json({ error: "Could not load markets." }, { status: 500 });
  const synced_at = (data ?? []).reduce<string | null>((latest, r) => (latest && latest > (r.synced_at as string) ? latest : (r.synced_at as string)), null);
  return Response.json({ markets: (data ?? []).map((r) => ({ name: r.name, clients: r.clients, live: r.live })), synced_at }, { headers: { "cache-control": "private, max-age=600" } });
}
