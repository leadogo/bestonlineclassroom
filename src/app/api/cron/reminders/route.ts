import { currentOrNextSession, scheduleOf } from "@/lib/daily-schedule";
import { db } from "@/lib/db";
import type { EventRow } from "@/lib/events";
import { sendReminder } from "@/lib/mailer";
import { postmarkConfigured } from "@/lib/postmark";
import { dueRules } from "@/lib/reminders";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Every 5 minutes (vercel.json): for each event's running or next session, the reminder rules due in the last ten
 * minutes go to every registrant of that session with an email, once each (`reminder_sends`). A rule with negative
 * minutes fires after the start and skips anyone already in the room. `?dry=1` counts only.
 */
export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const dry = new URL(request.url).searchParams.get("dry") === "1";
  if (!postmarkConfigured() && !dry) return Response.json({ error: "Postmark not configured" }, { status: 503 });
  const now = new Date();
  const windowStart = new Date(now.getTime() - 10 * 60_000);
  const { data: events } = await db().from("events").select("*");
  let sent = 0;
  let failed = 0;
  const planned: string[] = [];
  for (const e of (events ?? []) as EventRow[]) {
    const session = currentOrNextSession(scheduleOf(e), now);
    const due = dueRules(e.reminder_rules ?? [], session.start, windowStart, now);
    if (due.length === 0) continue;
    const { data: regs } = await db().from("registrants").select("id, first_name, email, token").eq("event_id", e.id).eq("session_date", session.date).not("email", "is", null).eq("no_email", false).neq("source", "test");
    const ids = (regs ?? []).map((r) => r.id);
    const { data: done } = ids.length ? await db().from("reminder_sends").select("registrant_id, rule_key").in("registrant_id", ids) : { data: [] };
    const have = new Set((done ?? []).map((d) => `${d.registrant_id}:${d.rule_key}`));
    const joined = new Set<string>();
    if (due.some((r) => r.minutes_before < 0)) {
      for (let i = 0; i < ids.length; i += 200) {
        const { data } = await db().from("attendance").select("registrant_id").in("registrant_id", ids.slice(i, i + 200)).eq("session_date", session.date).eq("kind", "live");
        for (const a of data ?? []) joined.add(String(a.registrant_id));
      }
    }
    for (const rule of due) {
      for (const r of regs ?? []) {
        if (have.has(`${r.id}:${rule.key}`)) continue;
        if (rule.minutes_before < 0 && joined.has(r.id)) continue;
        if (dry) {
          planned.push(`${rule.key} → ${r.email}`);
          continue;
        }
        const res = await sendReminder(rule, { id: r.id, first_name: r.first_name, email: r.email as string, token: r.token }, e, session);
        if (res.ok) {
          await db().from("reminder_sends").insert({ registrant_id: r.id, rule_key: rule.key });
          sent += 1;
        } else {
          failed += 1;
          console.error("[reminders] send failed", { rule: rule.key, error: res.error });
        }
      }
    }
  }
  return Response.json(dry ? { planned } : { sent, failed });
}
