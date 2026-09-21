// One transactional email through Postmark (SPEC-reminders.md). Nothing here throws; the cron logs and moves on.
const TOKEN = process.env.POSTMARK_SERVER_TOKEN ?? "";
const FROM = process.env.REMINDER_FROM ?? "";

export function postmarkConfigured(): boolean {
  return Boolean(TOKEN && FROM);
}

export async function sendEmail(input: { to: string; subject: string; text: string; html: string; tag?: string }): Promise<{ ok: boolean; error?: string }> {
  if (!postmarkConfigured()) return { ok: false, error: "not_configured" };
  try {
    const res = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: { "X-Postmark-Server-Token": TOKEN, accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ From: FROM, To: input.to, Subject: input.subject, TextBody: input.text, HtmlBody: input.html, MessageStream: "outbound", Tag: input.tag ?? "reminder" }),
      signal: AbortSignal.timeout(10_000),
    });
    const j = (await res.json().catch(() => ({}))) as { ErrorCode?: number; Message?: string };
    if (!res.ok || (j.ErrorCode ?? 0) !== 0) return { ok: false, error: j.Message ?? `HTTP ${res.status}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
