// Email security scanners (SPEC-link-opens.md): Microsoft and Amazon sandboxes open every link in every email within
// minutes of delivery, run the page, play the video for half a minute and leave. The tell is a Linux desktop agent: real
// agents on a Linux desktop are rare in this crowd (Android and ChromeOS also say Linux and are people). Oct 21 check of
// the last 7 days of clicks: the Linux-desktop agents are Chrome 139 (1,755) and 80 (316); the human agents are Chrome
// 155 (current stable), 153, 154, 142, 143. A Chrome-build tell was tried and dropped the same day: current stable is 155,
// so "Chrome 145 or above" would have called most real people scanners. Address lists only if the audit shows misses.
export function isScannerAgent(ua: string | null | undefined): boolean {
  if (!ua) return false;
  return /Linux/.test(ua) && !/Android|CrOS/.test(ua);
}
