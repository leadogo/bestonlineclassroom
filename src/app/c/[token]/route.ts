import { registrantByToken } from "@/lib/attendees";
import { currentOrNextSession, scheduleOf, sessionFor } from "@/lib/daily-schedule";
import { calendarInvite, calendarSession } from "@/lib/ics";
import { joinUrl, TOKEN_RE } from "@/lib/registrants";

export const dynamic = "force-dynamic";
const REPLY_TO = process.env.REPLY_TO ?? "admin@bookmoreshowings.com";

/**
 * GET /c/<token>: the registrant's calendar invite as a file, the link Katherine texts beside the join link
 * (watch.bookmoreshowings.com/c/<token> redirects here). Their own session until it ends, then the running-or-next
 * one, since their join link moves them into tonight's room. The entry opens their own link (?src=calendar).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!TOKEN_RE.test(token)) return new Response("Not found", { status: 404 });
  const r = await registrantByToken(token).catch(() => null);
  if (!r?.event) return new Response("Not found", { status: 404 });
  const schedule = scheduleOf(r.event);
  const session = calendarSession(sessionFor(schedule, r.session_date), currentOrNextSession(schedule));
  const ics = calendarInvite({ token: r.token, first_name: r.first_name ?? "", email: r.email ?? null }, r.event, session, `${joinUrl(r.token)}?src=calendar`, REPLY_TO);
  return new Response(ics, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'attachment; filename="ai-leads-masterclass.ics"',
      "cache-control": "no-store",
    },
  });
}
