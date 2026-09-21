// The caller's IP (Vercel puts the client first in x-forwarded-for) and the IP block list, cached a minute.
import { db } from "./db.ts";

export function clientIp(h: Headers): string | null {
  const raw = h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0] ?? "";
  const ip = raw.trim();
  return /^[0-9a-f.:]{3,45}$/i.test(ip) ? ip : null;
}

let cache: { at: number; ips: Set<string> } = { at: 0, ips: new Set() };

export async function ipBlocked(ip: string | null): Promise<boolean> {
  if (!ip) return false;
  if (Date.now() - cache.at > 60_000) {
    const { data } = await db().from("blocked_ips").select("ip");
    cache = { at: Date.now(), ips: new Set((data ?? []).map((r) => String(r.ip))) };
  }
  return cache.ips.has(ip);
}

export const forgetBlockedIps = () => (cache = { at: 0, ips: new Set() });
