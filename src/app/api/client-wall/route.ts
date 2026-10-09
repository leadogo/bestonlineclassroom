import { db } from "@/lib/db";
import { FLAG_CAP, MIN_SNAPSHOT, normalizeClients } from "@/lib/client-wall";
import { MIN_MARKETS, normalizeMarkets } from "@/lib/market-answer";
import { postToIntel } from "@/lib/slack";

export const dynamic = "force-dynamic";

const SECRET = process.env.REGISTER_SECRET ?? "";

/**
 * The Markets page's client count per market, for the desk's Answer chips. A snapshot under MIN_MARKETS is ignored
 * (the directory has ~350); markets missing from a full snapshot were merged or deleted and are dropped. Never fails
 * the wall: returns how many were stored, or the error text.
 */
async function storeMarkets(raw: unknown, now: string): Promise<number | string> {
  const markets = normalizeMarkets(raw);
  if (markets.length < MIN_MARKETS) return 0;
  const { error } = await db().from("market_counts").upsert(markets.map((m) => ({ ...m, synced_at: now })), { onConflict: "name" });
  if (error) return error.message;
  await db().from("market_counts").delete().lt("synced_at", now);
  return markets.length;
}

/**
 * POST { clients: [{ id, name, status, emails: [], phones: [], since }], markets?: [{ name, clients, live }] }
 * (Bearer REGISTER_SECRET), the whole BMS directory every time (SPEC-phase7.md): upserts the wall, releases clients
 * that left the directory, then walls and releases registrants in the database; stores the market counts when sent.
 * Returns { clients, kept, released_clients, flagged, released, markets }.
 */
export async function POST(request: Request) {
  if (!SECRET || request.headers.get("authorization") !== `Bearer ${SECRET}`) return Response.json({ error: "Unauthorized" }, { status: 401 });
  let body: { clients?: unknown; markets?: unknown };
  try {
    body = (await request.json()) as { clients?: unknown; markets?: unknown };
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const rows = normalizeClients(body.clients);
  if (rows.length < MIN_SNAPSHOT) return Response.json({ error: `Snapshot too small (${rows.length} usable clients; ${MIN_SNAPSHOT} is the floor)` }, { status: 422 });
  const now = new Date().toISOString();
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db().from("client_wall").upsert(rows.slice(i, i + 500).map((r) => ({ ...r, seen_at: now, released_at: null })), { onConflict: "client_id" });
    if (error) return Response.json({ error: `Upsert failed: ${error.message}` }, { status: 500 });
  }
  // Anyone not in this snapshot has left the directory; test rows (seeded by hand for a walk) stay.
  const gone = await db().from("client_wall").update({ released_at: now }).lt("seen_at", now).is("released_at", null).neq("status", "test").select("client_id");
  const applied = await db().rpc("client_wall_apply", { cap: FLAG_CAP });
  if (applied.error) return Response.json({ error: `Apply failed: ${applied.error.message}` }, { status: 500 });
  const result = (applied.data ?? {}) as { error?: string; would_flag?: number; flagged?: number; released?: number };
  if (result.error === "cap") {
    await postToIntel(`🔴 Client wall: a sync would have walled ${result.would_flag} people at once (cap ${FLAG_CAP}); nobody was walled. Check the snapshot bms-dashboard sent.`).catch(() => {});
    return Response.json({ error: "cap", ...result }, { status: 409 });
  }
  const markets = body.markets === undefined ? undefined : await storeMarkets(body.markets, now).catch((e: unknown) => String(e));
  return Response.json({ clients: rows.length, released_clients: gone.data?.length ?? 0, flagged: result.flagged ?? 0, released: result.released ?? 0, markets }, { headers: { "cache-control": "no-store" } });
}
