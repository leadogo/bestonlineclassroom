import { after } from "next/server";
import { logClick } from "@/lib/clicks";
import { getEvent } from "@/lib/events";
import { withQuery } from "@/lib/params";
import { postToIntel } from "@/lib/slack";
import { currentOrNextSession, scheduleOf } from "@/lib/daily-schedule";

export const dynamic = "force-dynamic";

/**
 * The QR code on the pitch slide points here (William, Sep 23): the scan is logged, the intel channel hears about it,
 * and the phone is forwarded to the booking form with the QR marked as the source. Nobody is identified: a scan has
 * no seat. `?event=` picks the webinar, default ailg-r.
 */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const event = await getEvent(q.get("event") ?? "ailg-r").catch(() => null);
  if (!event?.cta_href) return new Response("No booking link for this webinar.", { status: 404 });
  const session = currentOrNextSession(scheduleOf(event));
  const secs = Math.max(0, Math.floor((Date.now() - session.start.getTime()) / 1000));
  const at = `${Math.floor(secs / 3600)}:${String(Math.floor((secs % 3600) / 60)).padStart(2, "0")}`;
  const ua = request.headers.get("user-agent");
  after(async () => {
    await logClick({ path: "qr", outcome: "scan", eventId: event.id, sessionDate: session.date, src: "qr", userAgent: ua });
    await postToIntel(`📱 QR scanned at ${at} into the session (${new Date().toLocaleTimeString("en-US", { timeZone: event.timezone, hour: "numeric", minute: "2-digit" })})`);
  });
  return Response.redirect(withQuery(event.cta_href, { utm_source: "qr", utm_medium: "video", utm_campaign: "ailgr-pitch", src: "qr" }), 302);
}
