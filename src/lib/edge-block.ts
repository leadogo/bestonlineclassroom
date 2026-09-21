// IP blocking at Vercel's edge (Firewall "IP Blocking" rules) so a blocked address never reaches a function.
// Needs VERCEL_TOKEN in Doppler; without it only our own check in ip.ts applies.
const TOKEN = process.env.VERCEL_TOKEN ?? "";
const PROJECT = process.env.VERCEL_PROJECT_ID ?? "prj_jJUPN2PWs1MwkfKZNnMCBuNTHA7c";
const TEAM = process.env.VERCEL_TEAM_ID ?? "team_fv7EDFSwrZqvjlv4mSOxBlJJ";
const URL = `https://api.vercel.com/v1/security/firewall/config?projectId=${PROJECT}&teamId=${TEAM}`;

export const edgeConfigured = () => Boolean(TOKEN);

async function patch(body: object): Promise<Record<string, unknown> | null> {
  if (!TOKEN) return null;
  const res = await fetch(URL, { method: "PATCH", headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(8000) }).catch(() => null);
  if (!res?.ok) return null;
  return (await res.json().catch(() => null)) as Record<string, unknown> | null;
}

/** Adds a deny rule for the IP on every hostname; returns the rule id to remove it later, or null. */
export async function blockAtEdge(ip: string, notes: string): Promise<string | null> {
  const j = await patch({ action: "ip.insert", id: null, value: { hostname: "*", ip, notes: notes.slice(0, 200), action: "deny" } });
  const ips = ((j?.active as { ips?: Array<{ id: string; ip: string }> } | undefined)?.ips ?? []).filter((r) => r.ip === ip);
  return ips[ips.length - 1]?.id ?? null;
}

export async function unblockAtEdge(id: string): Promise<boolean> {
  return Boolean(await patch({ action: "ip.remove", id, value: null }));
}
