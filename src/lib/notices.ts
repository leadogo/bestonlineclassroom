// The room's posts as notice slots (SPEC-slack-notifications, William's decisions of Oct 26 2026: every kept per-event
// post has ONE shape, the canary reads as a health check, the 8:50 readout is one 📊). Pure; the routes read and post.
import { clipChars, clipWords, escapeMrkdwn, HEADLINE_MAX_WORDS, prettyPhone, williamMention, type Notice } from "./slack.ts";
import type { Funnel } from "./open-link.ts";
import { openLinkLine } from "./open-link.ts";
import { JOIN_SOURCES, type JoinSourcesResult } from "./join-sources.ts";
import { resultLine, type BroadcastResult } from "./skool-broadcast-results.ts";

const withPhone = (headline: string, phone: string | null | undefined): string => (phone ? `${headline} · ${prettyPhone(phone)}` : headline);

/** 🔔 → ✅ one line per registrant who clicked the offer: who, when, their phone, which click of the night. */
export function joinClickNotice(o: { name: string; phone: string | null; label: string | null; at: string; replay: boolean; nth: number }): Notice {
  return {
    kind: "receipt",
    emoji: "🔔",
    headline: withPhone(`${escapeMrkdwn(o.name)} clicked ${o.label ?? "the offer"} ${o.replay ? "on the replay" : `at ${o.at}`}`, o.phone),
    numbers: o.nth ? [`click #${o.nth} tonight`] : [],
  };
}

/** 📱 → ✅ one line per QR scan, counting the night's scans. */
export function qrScanNotice(o: { at: string; clock: string; nth: number }): Notice {
  return { kind: "receipt", emoji: "📱", headline: `QR scanned at ${o.at} · ${o.clock} · scan #${o.nth} tonight` };
}

/** 🚧 → ✅ a paying client opened a join link and got the 404 wall. */
export function clientWallNotice(o: { name: string; email: string | null; path: "join" | "replay"; eventTitle: string; date: string }): Notice {
  return { kind: "receipt", emoji: "🚧", headline: `Client wall: ${escapeMrkdwn(o.name)} hit the 404 on the ${o.path} link`, numbers: [o.email ? escapeMrkdwn(o.email) : "no email", `${o.eventTitle} ${o.date}`] };
}

/** A sync that would have walled too many people at once was refused. */
export function wallCapNotice(wouldFlag: number, cap: number): Notice {
  return { kind: "alert", headline: `Client wall: a sync would have walled ${wouldFlag} people, nobody was walled`, note: `cap ${cap}; check the snapshot bms-dashboard sent` };
}

export type CanaryCheck = { name: string; ok: boolean; detail: string; /** the words of its tick on the number line ("753 simulated messages") */ short: string };

/**
 * The room's health check (William, Oct 26: "make it look easier to read and more to understand that it's a health
 * check"): ✅ with a tick per check when everything passed; when something failed, the ask to Will naming the failed
 * check, every check in the thread.
 */
export function canaryNotice(o: { title: string; at: string; checks: CanaryCheck[] }): Notice {
  const bad = o.checks.filter((c) => !c.ok);
  if (bad.length === 0) return { kind: "receipt", headline: `Room health check: ${o.title} is ready (${o.at})`, numbers: [o.checks.map((c) => `${c.short} ✓`).join(" · ")] };
  return {
    kind: "ask",
    emoji: "🚨",
    headline: `Room health check failed: ${bad.map((c) => c.name).join(", ")}`,
    ask: { who: williamMention(), action: `fix before ${o.at}` },
    numbers: bad.map((c) => `${c.name}: ${c.detail}`),
    detail: o.checks.map((c) => `${c.ok ? "✓" : "✗"} ${c.name}: ${c.detail}`),
  };
}

/** The 8:50 readout (lo-joins-by-source): joins by source on the headline and number line, the open-link funnel and the client wall beside them, the link clicks and the Skool broadcast's result in the thread. */
export function nightlyNotice(o: { label: string; joins: JoinSourcesResult; openLink: { title: string; date: string; tonight: Funnel; baseline: Funnel; nights: number } | null; wall: { held: number; hit: number }; broadcast: { weekday: string; date: string; title: string; result: BroadcastResult } | null }): Notice {
  const joined = JOIN_SOURCES.reduce((n, s) => n + o.joins[s].joined, 0);
  const booked = JOIN_SOURCES.reduce((n, s) => n + o.joins[s].booked, 0);
  const sources = JOIN_SOURCES.filter((s) => o.joins[s].joined > 0).map((s) => `${s} ${o.joins[s].joined}${o.joins[s].booked ? ` (${o.joins[s].booked} booked)` : ""}`);
  const numbers = [sources.length ? sources.join(" · ") : "nobody joined"];
  if (o.openLink) numbers.push(`open-link cards ${o.openLink.tonight.cards} → ${o.openLink.tonight.submitted} emails → ${o.openLink.tonight.joined} joined`);
  numbers.push(`client wall ${o.wall.held} held, ${o.wall.hit} hit`);
  const detail = [`link clicks: ${JOIN_SOURCES.filter((s) => s !== "direct").map((s) => `${s} ${o.joins[s].clicked}`).join(" · ")}`];
  if (o.openLink) detail.push(openLinkLine(o.openLink.title, o.openLink.date, o.openLink.tonight, o.openLink.baseline, o.openLink.nights));
  if (o.broadcast) detail.push(resultLine(o.broadcast.weekday, o.broadcast.date, o.broadcast.title, o.broadcast.result));
  return { kind: "read", headline: `Joins by source, ${o.label}: ${joined} joined, ${booked} booked`, numbers, detail };
}

/** ✅ the Skool broadcast went out (or 🚨 it did not). */
export function broadcastNotice(o: { weekday: string; dry: boolean; ok: boolean; group: string; emailToggle?: string | null; postUrl?: string | null; error?: string | null; sessionId?: string | null }): Notice {
  if (o.ok) return { kind: "receipt", headline: `Skool ${o.weekday} broadcast ${o.dry ? "dry run filled and cancelled" : "posted"}`, numbers: [o.group, `email toggle ${o.emailToggle ?? "unknown"}`, ...(o.postUrl ? [o.postUrl] : [])] };
  return { kind: "alert", headline: `Skool ${o.weekday} broadcast failed`, numbers: [o.group, o.error ?? "unknown error", `Browserbase session ${o.sessionId ?? "?"}`] };
}

// ---- Kaitlyn's desk lines (#autoweb-chat) ----

export function autopilotNotice(o: { on: true; by: "switch" | "empty_desk" } | { on: false; name: string }): Notice {
  if (!o.on) return { kind: "receipt", headline: `Autopilot off: ${o.name} is back on the desk` };
  return { kind: "receipt", headline: o.by === "switch" ? "Autopilot on: Kaitlyn is answering on her own tonight" : "Autopilot on: nobody on the desk for 3 min, Kaitlyn is answering" };
}

/** 🎯 one per question Kaitlyn could not answer; a repeat edits the first post with `asked` (lo-kaitlyn-needs-you). */
export function needsYouNotice(o: { name: string; ghosted: boolean; question: string; action: string; draft: string; asked: number }): Notice {
  // "Kaitlyn needs you —" is four tokens and the name its own; the question takes what is left of the twelve (a two-word name leaves six).
  const name = escapeMrkdwn(o.name.replace(/\s+/g, " ").trim());
  const clipped = clipWords(o.question, Math.max(3, HEADLINE_MAX_WORDS - 4 - name.split(" ").length));
  const note = [
    ...(o.ghosted ? ["ghosted"] : []),
    ...(clipped !== o.question ? [`"${escapeMrkdwn(o.question)}"`] : []),
    o.draft ? `her draft: "${escapeMrkdwn(o.draft)}"` : `she would ${o.action.replace("_", " ")}`,
    ...(o.asked > 1 ? [`asked ${o.asked === 2 ? "twice" : `${o.asked}×`}`] : []),
  ].join(" · ");
  return { kind: "ask", headline: `Kaitlyn needs you — ${name}: "${escapeMrkdwn(clipped)}"`, ask: { who: williamMention(), action: "answer on the desk or reply here" }, note: clipChars(note) };
}

export function ghostNotice(o: { name: string; message: string; why: string }): Notice {
  return { kind: "receipt", headline: `Kaitlyn ghosted ${escapeMrkdwn(o.name)}: ${clipWords(o.why, 6)}`, note: clipChars(`"${escapeMrkdwn(clipWords(o.message, 25))}" · unghost on the desk if that was wrong`) };
}

export function deskPassedNotice(o: { name: string; text: string }): Notice {
  return { kind: "receipt", headline: `Kaitlyn posted after 90 s on the desk: ${escapeMrkdwn(o.name)}`, note: clipChars(`"${escapeMrkdwn(o.text)}"`) };
}

export function learnedNotice(o: { name: string; fact: string }): Notice {
  return { kind: "receipt", headline: `Kaitlyn learned a fact from ${escapeMrkdwn(o.name)}`, note: clipChars(escapeMrkdwn(o.fact)) };
}

/** A client's complaint in the room, hidden and answered privately: the team follows up tomorrow. */
export function complaintNotice(o: { name: string; email: string | null; message: string }): Notice {
  return { kind: "alert", headline: `A client complaint in the room, answered privately: ${escapeMrkdwn(o.name)}`, numbers: [o.email ? escapeMrkdwn(o.email) : "no email"], note: clipChars(`"${escapeMrkdwn(clipWords(o.message, 40))}" · someone should follow up tomorrow`) };
}

/** The levels at which a run of IP blocks is worth a look (William, Oct 28: the desk's Block now blocks the IP too). */
export const IP_SURGE_LEVELS = [5, 10, 20, 50, 100];
export function ipSurgeLevel(blockedLast24h: number): number | null {
  return IP_SURGE_LEVELS.includes(blockedLast24h) ? blockedLast24h : null;
}
export function ipSurgeNotice(o: { count: number; latest: string }): Notice {
  return { kind: "ask", emoji: "🚨", headline: `${o.count} IPs blocked in the last 24 hours`, ask: { who: williamMention(), action: "check Admin › Blocked" }, note: clipChars(`latest: ${escapeMrkdwn(o.latest)} · a run of blocks can mean a shared office or phone-carrier address is shutting out real people`) };
}
