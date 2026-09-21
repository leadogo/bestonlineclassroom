// The three emails (SPEC-reminders.md): the confirmation with its calendar invite the moment someone registers,
// and the reminders the cron sends. Builds the variables once from the registrant, the event and the session.
import { ordinal, partsInTz } from "./tz.ts";
import { db } from "./db.ts";
import type { EventRow } from "./events.ts";
import { CONFIRMATION_BODY, CONFIRMATION_SUBJECT, TRANSPARENCY_FOOTER, fill } from "./email-templates.ts";
import { buildInvite } from "./ics.ts";
import { sendEmail } from "./postmark.ts";
import { joinUrl, replayUrl } from "./registrants.ts";
import { toHtml } from "./reminders.ts";
import type { Session } from "./daily-schedule.ts";

const APP = (process.env.NEXT_PUBLIC_APP_URL ?? "https://bestonlineclassroom.com").replace(/\/$/, "");
const SKOOL = process.env.SKOOL_URL ?? "";
const REPLY_TO = process.env.REPLY_TO ?? "admin@bookmoreshowings.com";

export type Person = { id: string; first_name: string; email: string; token: string };

/** "7:00 PM ET / 5:00 PM MT" and "Monday, September 21st", the way the site's emails already say it. */
export function sessionWords(session: Session, timezone: string): { time: string; date: string } {
  const t = (tz: string, label: string) => `${new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(session.start)} ${label}`;
  const p = partsInTz(session.start, timezone);
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "long" }).format(session.start);
  const month = new Intl.DateTimeFormat("en-US", { timeZone: timezone, month: "long" }).format(session.start);
  return { time: `${t("America/New_York", "ET")} / ${t("America/Denver", "MT")}`, date: `${weekday}, ${month} ${ordinal(p.day)}` };
}

export function emailVars(p: Person, e: EventRow, session: Session): Record<string, string> {
  const w = sessionWords(session, e.timezone);
  return {
    first_name: p.first_name,
    title: e.title,
    host_name: e.host_name,
    join_url: joinUrl(p.token),
    event_link: joinUrl(p.token),
    replay_url: replayUrl(p.token),
    replay_link: replayUrl(p.token),
    webinar_time: w.time,
    webinar_date: w.date,
    start_local: w.time,
    skool_link: SKOOL,
  };
}

function withFooter(text: string, footer: boolean, token: string): string {
  return `${text}\n\n${footer ? `${TRANSPARENCY_FOOTER}\n\n` : ""}To stop these emails: ${APP}/u/${token}`;
}

/** The confirmation: subject and body from the event (defaults otherwise), the invite attached, once per registrant. */
export async function sendConfirmation(p: Person, e: EventRow, session: Session): Promise<{ ok: boolean; error?: string }> {
  const vars = emailVars(p, e, session);
  const subject = fill(e.confirmation?.subject || CONFIRMATION_SUBJECT, vars);
  const body = fill(e.confirmation?.body || CONFIRMATION_BODY, vars);
  const text = withFooter(body, e.confirmation?.footer !== false, p.token);
  // Jeremy (2026-09-20): a real invite, 1h15 on the calendar, "full replay available after" in the description.
  const ics = buildInvite({
    uid: `${p.token}-${session.date}@bestonlineclassroom.com`,
    start: session.start,
    end: new Date(session.start.getTime() + 75 * 60_000),
    title: e.title,
    description: `Your private link to join: ${vars.join_url}\nOpen it a few minutes early and turn the sound on when it starts.\nFull replay available after.`,
    url: vars.join_url,
    organizerName: e.host_name,
    organizerEmail: REPLY_TO,
    attendeeName: p.first_name,
    attendeeEmail: p.email,
  });
  const res = await sendEmail({ to: p.email, subject, text, html: toHtml(text), tag: "confirmation", attachments: [{ name: "invite.ics", content: Buffer.from(ics, "utf8").toString("base64"), contentType: "text/calendar; method=REQUEST" }] });
  if (res.ok) await db().from("registrants").update({ confirmation_sent_at: new Date().toISOString() }).eq("id", p.id);
  else console.error("[mailer] confirmation failed", { registrant: p.id, error: res.error });
  return res;
}

/** A reminder rule for one registrant. */
export async function sendReminder(rule: { key: string; subject: string; body: string }, p: Person, e: EventRow, session: Session, footer = false): Promise<{ ok: boolean; error?: string }> {
  const vars = emailVars(p, e, session);
  const text = withFooter(fill(rule.body, vars), footer, p.token);
  return sendEmail({ to: p.email, subject: fill(rule.subject, vars), text, html: toHtml(text), tag: rule.key });
}
