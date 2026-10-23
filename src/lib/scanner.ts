// Email security scanners (SPEC-link-opens.md): Microsoft and Amazon sandboxes open every link in every email within
// minutes of delivery, run the page, play the video for half a minute and leave. The tell is a Linux desktop agent: real
// agents on a Linux desktop are rare in this crowd. Android, ChromeOS and the smart-TV browsers also say Linux and are
// people. Oct 21 check of the last 7 days of clicks: the Linux-desktop agents are Chrome 139 (1,755) and 80 (316); the
// human agents are Chrome 155 (current stable), 153, 154, 142, 143. A Chrome-build tell was tried and dropped the same
// day: current stable is 155, so "Chrome 145 or above" would have called most real people scanners. Oct 13 to 20: no
// real person appeared only through a Linux-desktop agent (0 of 415). Re-run that check monthly (the spec's audit query);
// address lists only if it shows misses.
import { db } from "./db.ts";

const PEOPLE_ON_LINUX = /Android|CrOS|SMART-TV|SmartTV|Tizen|Web0S|webOS|CrKey|Roku|PlayStation|Xbox|Nintendo/i;

export function isScannerAgent(ua: string | null | undefined): boolean {
  if (!ua) return false;
  return /Linux/.test(ua) && !PEOPLE_ON_LINUX.test(ua);
}

/** The Oct 22 wave (SPEC-friday-unattended.md, D): Windows Chrome agents, 112 rows from 60 addresses, three addresses alone 32 rows at 4 to 10 s each. An address that opened this many *different* personal links inside the window is a fleet. A brokerage office watching together is one or two laptops on one address, not four in ten minutes. */
export const SCANNER_ADDRESS_TOKENS = 4;
export const SCANNER_ADDRESS_WINDOW_MS = 10 * 60_000;

/** Pure: whether the distinct tokens an address opened (this one included) reach the fleet threshold. */
export function isScannerAddressRows(tokens: Array<string | null>, thisToken: string): boolean {
  return new Set([...tokens.filter((t): t is string => Boolean(t)), thisToken]).size >= SCANNER_ADDRESS_TOKENS;
}

/** The lookup behind the render and the heartbeat: the join opens of real tokens from this address, with this agent string, in the last ten minutes (`link_clicks.ip`, migration 044). Real tokens and the same agent (security pass, Oct 22): four garbage paths from one address, or four people behind one carrier address on different phones, are not a fleet. Best-effort: a read error means not a scanner. */
export async function isScannerAddress(ip: string, thisToken: string, ua?: string | null): Promise<boolean> {
  const since = new Date(Date.now() - SCANNER_ADDRESS_WINDOW_MS).toISOString();
  let q = db().from("link_clicks").select("token").eq("ip", ip).eq("path", "j").not("registrant_id", "is", null).gte("at", since).limit(50);
  if (ua) q = q.eq("user_agent", ua.slice(0, 300));
  const { data, error } = await q;
  if (error || !data) return false;
  return isScannerAddressRows(data.map((r) => r.token as string | null), thisToken);
}
