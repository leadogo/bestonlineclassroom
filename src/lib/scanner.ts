// Email security scanners (SPEC-link-opens.md): Microsoft and Amazon sandboxes open every link in every email within
// minutes of delivery, run the page, play the video for half a minute and leave. The tell is the agent: a Linux desktop
// (real agents on a Linux desktop are rare in this crowd; Android and ChromeOS also say Linux and are people) or a
// Chrome or Edge build three or more above current stable (Oct 20: Chrome 145 to 155 on 299 clicks).
// ponytail: a constant for stable; bump it when Chrome does. Address lists only if the audit shows misses (decision 2).
export const CHROME_STABLE = 142;

export function isScannerAgent(ua: string | null | undefined): boolean {
  if (!ua) return false;
  if (/Linux/.test(ua) && !/Android|CrOS/.test(ua)) return true;
  const m = /(?:Chrome|Edg)\/(\d+)/.exec(ua);
  return Boolean(m && Number(m[1]) >= CHROME_STABLE + 3);
}
