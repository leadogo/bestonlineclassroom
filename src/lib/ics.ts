// A calendar invite as an attachment (SPEC-reminders.md): METHOD:REQUEST so Gmail and Apple Mail show it as an
// invitation with the registrant's own link in the description and the location. Pure; times in UTC.

export type Invite = {
  uid: string;
  start: Date;
  end: Date;
  title: string;
  description: string;
  url: string;
  organizerName: string;
  organizerEmail: string;
  attendeeName: string;
  /** Empty: no ATTENDEE line (a calendar file fetched from a text may be for someone with no email on file). */
  attendeeEmail: string;
};

function stamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Lines folded at 75 octets per RFC 5545. */
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (Buffer.byteLength(rest, "utf8") > 75) {
    let cut = 75;
    while (Buffer.byteLength(rest.slice(0, cut), "utf8") > 75) cut -= 1;
    out.push(rest.slice(0, cut));
    rest = " " + rest.slice(cut);
  }
  out.push(rest);
  return out.join("\r\n");
}

export function buildInvite(i: Invite): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BestOnlineClassroom//Webinar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${i.uid}`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(i.start)}`,
    `DTEND:${stamp(i.end)}`,
    `SUMMARY:${esc(i.title)}`,
    `DESCRIPTION:${esc(i.description)}`,
    `LOCATION:${esc(i.url)}`,
    `URL:${i.url}`,
    `ORGANIZER;CN=${esc(i.organizerName)}:mailto:${i.organizerEmail}`,
    ...(i.attendeeEmail ? [`ATTENDEE;CN=${esc(i.attendeeName)};ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;RSVP=FALSE:mailto:${i.attendeeEmail}`] : []),
    "STATUS:CONFIRMED",
    "SEQUENCE:0",
    "BEGIN:VALARM",
    "TRIGGER:-PT15M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc(i.title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

type SessionLike = { date: string; start: Date; end: Date };

/** The registrant's invite, the one the confirmation email attaches (Jeremy, 2026-09-20: 1h15 on the calendar, the replay noted). */
export function calendarInvite(p: { token: string; first_name: string; email: string | null }, e: { title: string; host_name: string }, session: SessionLike, joinLink: string, organizerEmail: string): string {
  return buildInvite({
    uid: `${p.token}-${session.date}@bestonlineclassroom.com`,
    start: session.start,
    end: new Date(session.start.getTime() + 75 * 60_000),
    title: e.title,
    description: `Your private link to join: ${joinLink}\nOpen it a few minutes early and turn the sound on when it starts.\nFull replay available after.`,
    url: joinLink,
    organizerName: e.host_name,
    organizerEmail,
    attendeeName: p.first_name,
    attendeeEmail: p.email ?? "",
  });
}

/** Which session a calendar link adds: the registrant's own until it ends, then the running-or-next one (their link moves them in). */
export function calendarSession<S extends SessionLike>(own: S | null, next: S, now: Date = new Date()): S {
  return own && own.end.getTime() > now.getTime() ? own : next;
}
