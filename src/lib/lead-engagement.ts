// One person's webinar story (phase 6.3): what the closer's sitrep, the PAR board and the setters' list read. Keyed by
// email across every session they ever held a seat for; the latest session they joined is "tonight's watch".
import { db } from "./db.ts";
import { scheduleOf, sessionFor } from "./daily-schedule.ts";
import { PRESENCE_GRACE_MS } from "./outcomes.ts";
import { engagementScore } from "./engagement.ts";
import type { EventRow } from "./events.ts";

export type LeadStory = {
  email: string;
  sessions_registered: number;
  sessions_attended: number;
  source: string | null;
  ad: string | null;
  campaign: string | null;
  first_optin_days_ago: number | null;
  latest: null | {
    session_date: string;
    joined_at: string;
    minutes: number;
    at_pitch: boolean;
    testimonials_pct: number | null;
    messages: number;
    belief: number;
    quotes: string[];
    clicked_at: string | null;
    booked_at: string | null;
    booked_minutes_after_pitch: number | null;
    score: number;
  };
};

export function testimonialsPct(minutesSeen: number[], fromSeconds: number | null, videoSeconds: number | null): number | null {
  if (fromSeconds === null || !videoSeconds || videoSeconds <= fromSeconds) return null;
  const from = Math.floor(fromSeconds / 60), to = Math.ceil(videoSeconds / 60);
  const span = Math.max(1, to - from);
  const seen = minutesSeen.filter((m) => m >= from && m < to).length;
  return Math.round(Math.min(1, seen / span) * 100);
}

export async function leadStories(event: EventRow, emails: string[]): Promise<LeadStory[]> {
  const wanted = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))].slice(0, 200);
  if (wanted.length === 0) return [];
  const schedule = scheduleOf(event);
  const pitchMin = event.cta_at_seconds !== null ? event.cta_at_seconds / 60 : 75;
  const { data: regs } = await db().from("registrants").select("id, email, source, attribution, created_at, session_date").eq("event_id", event.id).in("email", wanted).limit(2000);
  const byEmail = new Map<string, typeof regs>();
  for (const r of regs ?? []) { const k = (r.email as string).toLowerCase(); byEmail.set(k, [...(byEmail.get(k) ?? []), r]); }
  const ids = (regs ?? []).map((r) => r.id as string);
  const att: Array<{ registrant_id: string; session_date: string; joined_at: string; last_seen_at: string; seconds_watched: number; cta_clicked_at: string | null; minutes_seen: number[] }> = [];
  for (let i = 0; i < ids.length; i += 200) { const { data } = await db().from("attendance").select("registrant_id, session_date, joined_at, last_seen_at, seconds_watched, cta_clicked_at, minutes_seen").in("registrant_id", ids.slice(i, i + 200)).eq("kind", "live"); att.push(...((data ?? []) as typeof att)); }
  const { data: bk } = ids.length ? await db().from("bookings").select("registrant_id, email, booked_at, session_date").eq("event_id", event.id).eq("status", "scheduled").or(`registrant_id.in.(${ids.join(",")}),email.in.(${wanted.map((e) => `"${e}"`).join(",")})`) : { data: [] };
  const out: LeadStory[] = [];
  for (const email of wanted) {
    const mine = byEmail.get(email) ?? [];
    const myAtt = att.filter((a) => mine.some((r) => r.id === a.registrant_id)).sort((a, b) => b.session_date.localeCompare(a.session_date));
    const withAttr = mine.find((r) => r.attribution && (r.attribution as Record<string, string>).utm_source) ?? mine[0];
    const a = (withAttr?.attribution ?? {}) as Record<string, string>;
    const first = mine.map((r) => new Date(r.created_at as string).getTime()).sort()[0];
    const latestAtt = myAtt[0];
    let latest: LeadStory["latest"] = null;
    if (latestAtt) {
      const s = sessionFor(schedule, latestAtt.session_date);
      const pitchAt = s && event.cta_at_seconds !== null ? s.start.getTime() + event.cta_at_seconds * 1000 : null;
      const { data: msgs } = await db().from("chat_messages").select("body, belief").eq("registrant_id", latestAtt.registrant_id).eq("session_date", latestAtt.session_date).eq("role", "attendee").is("deleted_at", null).limit(200);
      const belief = (msgs ?? []).filter((m) => m.belief);
      const booking = (bk ?? []).find((b) => b.registrant_id === latestAtt.registrant_id || (b.email ?? "").toLowerCase() === email);
      const minutes = Math.round((latestAtt.seconds_watched ?? 0) / 60);
      const at_pitch = Boolean(pitchAt !== null && new Date(latestAtt.joined_at).getTime() <= pitchAt && new Date(latestAtt.last_seen_at).getTime() + PRESENCE_GRACE_MS >= pitchAt);
      latest = {
        session_date: latestAtt.session_date, joined_at: latestAtt.joined_at, minutes, at_pitch,
        testimonials_pct: testimonialsPct(latestAtt.minutes_seen ?? [], (event as EventRow & { testimonials_from_seconds?: number | null }).testimonials_from_seconds ?? null, event.video_seconds),
        messages: (msgs ?? []).length, belief: belief.length, quotes: belief.slice(0, 2).map((m) => String(m.body).slice(0, 80)),
        clicked_at: latestAtt.cta_clicked_at, booked_at: booking?.booked_at ?? null,
        booked_minutes_after_pitch: booking && pitchAt !== null ? Math.round((new Date(booking.booked_at as string).getTime() - pitchAt) / 60_000) : null,
        score: engagementScore({ minutes, atPitch: at_pitch, messages: (msgs ?? []).length, belief: belief.length, clicked: Boolean(latestAtt.cta_clicked_at) }, pitchMin),
      };
    }
    out.push({ email, sessions_registered: mine.length, sessions_attended: new Set(myAtt.map((x) => x.session_date)).size, source: withAttr?.source ?? null, ad: a.utm_content ?? null, campaign: a.utm_campaign ?? null, first_optin_days_ago: first ? Math.floor((Date.now() - first) / 86_400_000) : null, latest });
  }
  return out;
}
