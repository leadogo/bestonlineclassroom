// Every post reaches Slack through bms-dashboard's persona bridge (POST /api/internal/persona-post, Bearer
// LARRY_BRIDGE_SECRET), as Brandon. Since Oct 26 2026 (SPEC-slack-notifications in leadogo-app) a post is sent as SLOTS
// (`notice`: kind · headline · ask · numbers · note · detail) and the bridge renders them on the one schema every repo
// shares; `text` stays only for the chat relay, which reads as a transcript. Best-effort: never throws, never blocks a
// viewer. `renderNotice` / `noticeIssues` mirror the bridge's renderer and lint for dry runs and the tests.
/** The bridge, read when a post is made (so a test can set the env). */
const bridge = () => ({ base: process.env.BMS_OPS_URL ?? "", secret: process.env.LARRY_BRIDGE_SECRET ?? "", persona: process.env.SLACK_PERSONA ?? "brandon" });
/** #autoweb-chat: the chat relay and Kaitlyn's desk lines. */
export const CHAT_CHANNEL = process.env.SLACK_CHAT_CHANNEL_ID ?? "";
/** #autoweb-intel (offer clicks as they happen, phase 5.1 intel-feed); the id leadogo's Brandon posts to. */
export const INTEL_CHANNEL = process.env.SLACK_INTEL_CHANNEL_ID ?? "C0BNUAWDURL";

import { escapeMrkdwn, prettyPhone } from "./chat.ts";

export { escapeMrkdwn, prettyPhone };
/** William's mention for an ask (`SLACK_WILLIAM_USER_ID`, set in production); "Will" as plain text until it is. */
export const williamMention = (): string => (process.env.SLACK_WILLIAM_USER_ID ? `<@${process.env.SLACK_WILLIAM_USER_ID}>` : "Will");

export type NoticeKind = "ask" | "read" | "alert" | "receipt" | "digest";
export type NoticeAsk = { who: string; action: string; by?: string | null; ack?: boolean };
/** `emoji`: a per-event feed William kept carries its own sign (🔔 📱 🚧) in place of the kind's; the bridge honours it once bms deploys `notice.emoji`, and ignores it until then. */
export type Notice = { kind: NoticeKind; headline: string; emoji?: string; ask?: NoticeAsk | null; numbers?: readonly string[]; note?: string | null; detail?: readonly string[] };
export const NOTICE_EMOJI: Record<NoticeKind, string> = { ask: "🎯", read: "📊", alert: "🚨", receipt: "✅", digest: "📋" };
export const HEADLINE_MAX_WORDS = 12;
export const NUMBERS_MAX = 3;
export const CHANNEL_MAX_LINES = 5;

const tidy = (text: string): string => text.replace(/\s+/g, " ").trim().replace(/[.!]+$/, "");

/** The channel text the bridge renders (bms lib/slack/notice.ts): the kind's emoji, the headline bold, the ask line, at most three numbers on one line, the note. */
export function renderNotice(n: Notice): string {
  const lines = [`${n.emoji ?? NOTICE_EMOJI[n.kind]} *${tidy(n.headline)}*`];
  if (n.ask) {
    const who = n.ask.who.startsWith("<@") || n.ask.who.startsWith("@") ? n.ask.who : `@${n.ask.who}`;
    lines.push(`→ ${who} ${tidy(n.ask.action)}${n.ask.by ? ` by ${n.ask.by}` : ""}.${n.ask.ack === false ? "" : " ✅ here when done."}`);
  }
  const numbers = (n.numbers ?? []).map(tidy).filter(Boolean).slice(0, NUMBERS_MAX);
  if (numbers.length) lines.push(numbers.join(" · "));
  if (n.note) lines.push(`${tidy(n.note)}.`);
  return lines.join("\n");
}

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

/** What the bridge's lint would say (it never blocks a post); the tests hold every builder to an empty list. */
export function noticeIssues(n: Notice): string[] {
  const out: string[] = [];
  const words = tidy(n.headline).split(" ").filter(Boolean).length;
  if (words > HEADLINE_MAX_WORDS) out.push(`headline is ${words} words (max ${HEADLINE_MAX_WORDS})`);
  if (EMOJI.test(n.headline)) out.push("headline carries its own emoji");
  if (n.kind === "ask" && !n.ask) out.push("an ask notice needs an ask line");
  if (n.kind !== "ask" && n.ask) out.push(`a ${n.kind} carries an ask`);
  if ((n.numbers ?? []).length > NUMBERS_MAX) out.push(`${n.numbers?.length} numbers (max ${NUMBERS_MAX})`);
  const lines = renderNotice(n).split("\n").length;
  if (lines > CHANNEL_MAX_LINES) out.push(`${lines} lines in the channel post (max ${CHANNEL_MAX_LINES})`);
  return out;
}

/** A note under this many characters: bms caps the slot at 400 without an ellipsis. */
export const NOTE_MAX_CHARS = 390;
export const clipChars = (text: string, max = NOTE_MAX_CHARS): string => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** The first `max` words, with an ellipsis when something was cut. */
export function clipWords(text: string, max: number): string {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  return words.length > max ? `${words.slice(0, max).join(" ")}…` : words.join(" ");
}

export function slackConfigured(): boolean {
  const { base, secret } = bridge();
  return Boolean(base && secret && CHAT_CHANNEL);
}

export type PostResult = { ok: boolean; ts?: string; error?: string };

/** The chat relay's transcript line, posted as is (the one post that is deliberately not a notice). */
export async function postToChatChannel(text: string): Promise<PostResult> {
  if (!slackConfigured()) return { ok: false, error: "not_configured" };
  return send(CHAT_CHANNEL, { text: text.slice(0, 4000) }, {});
}

/** A post on the schema; `ts` edits that post in place instead of posting again, `threadTs` replies in a thread. */
export async function postNotice(channel: string, notice: Notice, opts: { threadTs?: string | null; ts?: string | null } = {}): Promise<PostResult> {
  const { base, secret } = bridge();
  if (!base || !secret || !channel) return { ok: false, error: "not_configured" };
  return send(channel, { notice }, opts);
}

async function send(channel: string, body: { text: string } | { notice: Notice }, opts: { threadTs?: string | null; ts?: string | null }): Promise<PostResult> {
  const { base, secret, persona } = bridge();
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/api/internal/persona-post`, {
      method: "POST",
      headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
      body: JSON.stringify({ persona, channel, ...body, strict: true, ...(opts.threadTs ? { thread_ts: opts.threadTs } : {}), ...(opts.ts ? { ts: opts.ts } : {}) }),
      signal: AbortSignal.timeout(8000),
    });
    const j = (await res.json().catch(() => null)) as { ok?: boolean; ts?: string; error?: string } | null;
    if (!res.ok || j?.ok !== true) {
      console.error("[slack] persona post failed", { status: res.status, error: j?.error });
      return { ok: false, error: j?.error ?? `HTTP ${res.status}` };
    }
    return { ok: true, ts: typeof j.ts === "string" ? j.ts : undefined };
  } catch (err) {
    console.error("[slack] persona post threw", { err: String(err) });
    return { ok: false, error: String(err) };
  }
}
