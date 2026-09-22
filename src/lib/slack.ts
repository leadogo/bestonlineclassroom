// Real chat messages reach #autoweb-chat through the same persona bridge the site uses (bms-dashboard's
// persona-post, Bearer LARRY_BRIDGE_SECRET). Best-effort: never throws, never blocks a viewer.
const BASE = process.env.BMS_OPS_URL ?? "";
const SECRET = process.env.LARRY_BRIDGE_SECRET ?? "";
const PERSONA = process.env.SLACK_PERSONA ?? "brandon";
const CHANNEL = process.env.SLACK_CHAT_CHANNEL_ID ?? "";
/** #autoweb-intel (offer clicks as they happen, phase 5.1 intel-feed); the id leadogo's Brandon posts to. */
const INTEL_CHANNEL = process.env.SLACK_INTEL_CHANNEL_ID ?? "C0BNUAWDURL";

export function slackConfigured(): boolean {
  return Boolean(BASE && SECRET && CHANNEL);
}

export async function postToChatChannel(text: string): Promise<{ ok: boolean; error?: string }> {
  if (!slackConfigured()) return { ok: false, error: "not_configured" };
  return post(CHANNEL, text);
}

export async function postToIntel(text: string): Promise<{ ok: boolean; error?: string }> {
  if (!BASE || !SECRET) return { ok: false, error: "not_configured" };
  return post(INTEL_CHANNEL, text);
}

async function post(channel: string, text: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${BASE.replace(/\/$/, "")}/api/internal/persona-post`, {
      method: "POST",
      headers: { authorization: `Bearer ${SECRET}`, "content-type": "application/json" },
      body: JSON.stringify({ persona: PERSONA, channel, text: text.slice(0, 4000), strict: true }),
      signal: AbortSignal.timeout(8000),
    });
    const j = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (!res.ok || j?.ok !== true) {
      console.error("[slack] persona post failed", { status: res.status, error: j?.error });
      return { ok: false, error: j?.error ?? `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    console.error("[slack] persona post threw", { err: String(err) });
    return { ok: false, error: String(err) };
  }
}
