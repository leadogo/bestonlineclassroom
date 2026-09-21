// Reminder emails, the pure part (SPEC-reminders.md): which rule is due in a five-minute cron window, and the
// message a rule renders for a registrant. Sending lives in postmark.ts; the cron route glues them.

export type ReminderRule = { key: string; minutes_before: number; subject: string; body: string };

export type Vars = { first_name: string; title: string; host_name: string; join_url: string; replay_url: string; start_local: string };

/** {{first_name}} etc. Unknown names stay as written so a typo is visible in the email, not silent. */
export function render(template: string, vars: Vars): string {
  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (m, k: string) => (k in vars ? String(vars[k as keyof Vars]) : m));
}

/**
 * The rules whose send moment (start − minutes_before) falls inside [windowStart, windowEnd). A cron that runs
 * every five minutes passes its own tick and the previous one, so a slow tick never skips a rule.
 */
export function dueRules(rules: ReminderRule[], sessionStart: Date, windowStart: Date, windowEnd: Date): ReminderRule[] {
  return rules.filter((r) => {
    const at = sessionStart.getTime() - r.minutes_before * 60_000;
    return at >= windowStart.getTime() && at < windowEnd.getTime();
  });
}

/** Plain text → the simplest readable HTML: paragraphs, line breaks, links clickable. */
export function toHtml(text: string): string {
  const esc = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const linked = esc.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>');
  return linked
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px;font:16px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;color:#17202a">${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
}
