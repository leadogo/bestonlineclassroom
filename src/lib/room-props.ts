// Everything the room page hands the browser, computed once on the server: the state and the instants (so the
// phone's clock never decides the offset), the video, the finished CTA link, the names for the people panel.
// A preview (`?at=<seconds>` with `key=<PREVIEW_KEY>` or a signed-in team member) forces the live state there.
import { fourZones, roomState, scheduleOf } from "./daily-schedule.ts";
import { ctaHref } from "./cta.ts";
import type { EventRow } from "./events.ts";
import type { Registrant } from "./attendees.ts";
import { cleanParams, toQuery } from "./params.ts";

const PREVIEW_KEY = process.env.PREVIEW_KEY ?? "";

export type RoomProps = {
  token: string;
  registrantId: string;
  firstName: string;
  eventSlug: string;
  title: string;
  hostName: string;
  host: { avatarUrl: string | null; tagline: string | null };
  logoUrl: string | null;
  iconUrl: string | null;
  state: "countdown" | "live";
  /** ms since epoch */
  startsAt: number;
  endsAt: number;
  serverNow: number;
  video: { available: boolean; seconds: number };
  cta: { at: number; hide: number; label: string; href: string; title: string; subtitle: string } | null;
  endUrl: string;
  params: Record<string, string>;
  simulatedNames: string[];
  sessionDate: string;
  preview: boolean;
  zones: Array<[string, string]>;
};

export type RoomOutcome = { kind: "room"; props: RoomProps } | { kind: "ended"; to: string };

export function buildRoom(event: EventRow, r: Registrant, sp: Record<string, string | string[] | undefined>, now = new Date(), opts: { team?: boolean } = {}): RoomOutcome {
  const params = cleanParams(sp);
  const one = (k: string) => (Array.isArray(sp[k]) ? (sp[k] as string[])[0] : (sp[k] as string | undefined)) ?? "";
  const schedule = scheduleOf(event);
  const seconds = event.video_seconds ?? 0;
  const preview = /^\d+$/.test(one("at")) && ((Boolean(PREVIEW_KEY) && one("key") === PREVIEW_KEY) || Boolean(opts.team));

  const rs = roomState(schedule, now, r.session_date);
  let state: "countdown" | "live";
  let startsAt: number;
  if (preview) {
    state = "live";
    startsAt = now.getTime() - Math.min(Number(one("at")), Math.max(seconds - 1, 0)) * 1000;
  } else {
    if (rs.state === "ended") return { kind: "ended", to: withParams(event.end_url, params) };
    state = rs.state;
    startsAt = rs.session.start.getTime();
  }
  const endsAt = startsAt + seconds * 1000;
  const cta =
    event.cta_href && event.cta_at_seconds !== null
      ? { at: event.cta_at_seconds, hide: event.cta_hide_seconds ?? seconds, label: event.cta_label ?? "Book your call", title: event.cta_title || "Ready to take the next step?", subtitle: event.cta_subtitle || `Pick a time with ${event.host_name.split(" ")[0]}’s team. It takes two minutes.`, href: ctaHref(event.cta_href, { first_name: r.first_name, email: r.email, phone: r.phone, rid: r.id }, params) }
      : null;
  return {
    kind: "room",
    props: {
      token: r.token,
      registrantId: r.id,
      firstName: r.first_name,
      eventSlug: event.slug,
      title: event.title,
      hostName: event.host_name,
      host: { avatarUrl: event.host_avatar_url ?? null, tagline: event.host_tagline ?? null },
      logoUrl: event.logo_url,
      iconUrl: event.icon_url,
      state,
      startsAt,
      endsAt,
      serverNow: now.getTime(),
      video: { available: Boolean(event.video_url), seconds },
      cta,
      endUrl: withParams(event.end_url, params),
      params,
      simulatedNames: event.simulated_names ?? [],
      sessionDate: r.session_date,
      preview,
      zones: fourZones(rs.session),
    },
  };
}

function withParams(url: string, params: Record<string, string>): string {
  const q = toQuery(params);
  if (!q) return url;
  return url.includes("?") ? `${url}&${q.slice(1)}` : `${url}${q}`;
}
