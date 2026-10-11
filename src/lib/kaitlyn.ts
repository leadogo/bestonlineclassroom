// Kaitlyn from William's Team (William, Oct 11 2026): the room's AI moderator. One Claude call per attendee message
// decides reply / skip / ghost / ask William in a warm customer-service voice, with the event's fact sheet as the only
// source of product claims and Kevin's real replies as examples. Modes per event: off | shadow (drafts on the desk, a
// moderator sends) | assisted (the routine categories post themselves) | auto (every reply posts itself).
// Best-effort everywhere: a model outage or a bad answer is silence, never an error in the room.
import { KAITLYN, KAITLYN_MODES, type KaitlynMode } from "./chat.ts";
import { db } from "./db.ts";
import { EXAMPLES } from "./kaitlyn-examples.ts";
import { asksForReplay } from "./katherine.ts";
import { asksMarket, findMarkets, findStates, onlyStates, placeOf, rollup, type MarketCount } from "./market-answer.ts";
import { EMOJIS, isEmoji } from "./moderation.ts";
import { toggleReaction } from "./reactions.ts";
import { postToChatChannel } from "./slack.ts";

export { KAITLYN };
export const MODES = KAITLYN_MODES;
export type Mode = KaitlynMode;
export const ACTIONS = ["reply", "skip", "ghost", "ask_william"] as const;
export type Action = (typeof ACTIONS)[number];
export const CATEGORIES = ["market", "booking", "price", "product", "integration", "compliance", "replay", "tech", "greeting", "thanks", "chatter", "negative", "support", "other"] as const;
export type Category = (typeof CATEGORIES)[number];
export type Decision = { action: Action; category: Category; text: string; react: string; why: string };
/** In assisted mode these post without a moderator: the categories Kevin's history shows are routine. */
export const ASSISTED = new Set<Category>(["market", "booking", "replay", "tech", "greeting", "thanks"]);
export const MAX_TEXT = 300;
/** No second Kaitlyn reply to the same person inside this window. */
export const PER_PERSON_MS = 120_000;
const MODEL = process.env.KAITLYN_MODEL ?? "claude-sonnet-5-5";
const KEY = process.env.ANTHROPIC_API_KEY ?? "";

export const asMode = (v: unknown): Mode => (MODES as readonly string[]).includes(String(v)) ? (v as Mode) : "off";

const PERSONA = `You are Kaitlyn, a moderator in the live chat of William's "AI For Agents Masterclass" (Book More Showings, Edmonton). You post as "${KAITLYN}". Real estate agents are watching William present on screen; you help them the way a warm, upbeat customer-service teammate would.

VOICE
- Bubbly, warm, short: one or two sentences, under 160 characters when you can. Use their first name sometimes, not every time.
- At most one exclamation mark per reply, an emoji in about one reply in three (🙌 💛 🔥 😊 ✨), casual punctuation like the team. Never sarcastic, never argue, never lecture, never apologise for the product.
- Speak for the team ("we", "our team"), never for William ("William says…"). "William goes over that shortly" is fine when the fact sheet says the presentation covers it.
- Never claim to be a bot or an AI, never claim to be human. If asked, skip.

HARD RULES
- Product facts come only from FACTS below. Not there → say the call covers it ("great question, that's exactly what the call is for") and use ask_william when it matters to their decision.
- Never a price or dollar figure, never a guarantee, never a date, the weather or the news, never whether this is live or a recording. Questions about live/recorded/replay: skip (Katherine AI answers replay questions).
- Never promise that William will see or answer something.
- Do not repeat what a moderator already told this person tonight, and do not answer what a moderator just answered.

ACTIONS
- reply: a question about the product, the call, booking, markets, integrations, compliance, the replay email, tech trouble, where the link is; "booked" (celebrate, the team confirms by text and email); a market, city or state (use MARKET DATA exactly; nothing in the directory → "none in X yet, you'd be the first!"; no place named → ask which market); a greeting that asks the room something.
- skip: one-word agreement ("yes", "ok", "lol"), chatter between attendees, statements that need no answer, "hi" on its own, anything you would only answer to look busy. The team answers about one message in nine. A quiet room is better than a robotic one.
- ghost: the line would hurt the room and the person is not asking in good faith: soliciting or recruiting, links to other services, profanity or heckling ("booooo", "scam", "this is BS"), telling the room it is a recording or fake (claims, not questions), repeated spam. Ghosting is invisible to them; they keep chatting and only they see it.
- ask_william: an unhappy existing client or a support issue, a booking problem you cannot fix, a complaint, a legal or compliance question with specifics, anything you are unsure should be ghosted, a question FACTS does not cover that matters to their decision. Put a draft in text if you have one.
- react: on a clearly positive, excited or funny line (a win, "love this", "let's go") pick one of ${EMOJIS.join(" ")}, about one such line in four, with or without a reply. Never on a question, never on a negative line. Otherwise empty.

OUTPUT: one JSON object and nothing else, no prose, no code fence: {"action": "reply" | "skip" | "ghost" | "ask_william", "category": one of ${CATEGORIES.join(" | ")}, "text": the reply to post (empty unless reply; a draft is welcome with ask_william), "react": one emoji or "", "why": ten words for the desk}.`;

/** The system prompt: persona and rules, the event's fact sheet, Kevin's real answers, and the lines the team ghosted. Cached by the API. */
export function systemPrompt(facts: string | null): string {
  const f = facts?.trim() ? facts.trim() : "(No fact sheet for this event: answer only about markets, booking, the replay email and tech trouble; everything else is ask_william.)";
  const qa = EXAMPLES.qa.map((x) => `[${x.m}m] Q: ${x.q}\n   A: ${x.a}`).join("\n");
  return `${PERSONA}\n\nFACTS (the only product claims you may make)\n${f}\n\nHOW THE TEAM HAS ANSWERED (Kevin's real replies, minute into the session first; borrow the substance, not the voice: you are warmer and bubblier)\n${qa}\n\nLINES THE TEAM GHOSTED ON THE SPOT\n${EXAMPLES.ghosts.map((g) => `- ${g}`).join("\n")}`;
}

export type Context = {
  minute: number;
  pitchMinute: number | null;
  name: string;
  body: string;
  /** Their earlier lines tonight, oldest first. */
  priorOwn: string[];
  /** What moderators said to them tonight, oldest first. */
  modReplies: string[];
  /** The room's last lines, oldest first, "[attendee] Name: …" / "[team] Name: …". */
  recent: string[];
  market: string | null;
  katherine: boolean;
};

export function userTurn(c: Context): string {
  const room = c.pitchMinute === null ? `minute ${c.minute} of the session` : c.minute >= c.pitchMinute ? `minute ${c.minute}, the pitch started at minute ${c.pitchMinute} (booking is open)` : `minute ${c.minute}, before the pitch (it starts at minute ${c.pitchMinute})`;
  const lines = [
    `ROOM: ${room}.`,
    `MARKET DATA: ${c.market ?? "none (no place named)"}`,
    `KATHERINE AI: ${c.katherine ? "will answer this one (replay question)" : "not involved"}`,
    `PERSON: ${c.name}${c.priorOwn.length ? `, earlier tonight: ${c.priorOwn.map((s) => JSON.stringify(s)).join(" | ")}` : ", first message tonight"}`,
    `MODERATORS TO THEM TONIGHT: ${c.modReplies.length ? c.modReplies.map((s) => JSON.stringify(s)).join(" | ") : "nothing yet"}`,
    `RECENT ROOM (oldest first):\n${c.recent.length ? c.recent.join("\n") : "(quiet)"}`,
    `MESSAGE TO DECIDE ON: ${c.name}: ${JSON.stringify(c.body)}`,
  ];
  return lines.join("\n");
}

/** The directory's answer for the place they named, worded for the model; null when no place is named. */
export function marketLine(body: string, markets: MarketCount[]): string | null {
  if (!markets.length) return null;
  const hits = findMarkets(body, markets);
  const states = findStates(body);
  if (!hits.length && !states.length && !asksMarket(body)) return null;
  const top = hits[0];
  if (top) return `directory says ${top.clients} client${top.clients === 1 ? "" : "s"} in ${top.name} (${top.live} live)${hits.length > 1 ? `; also ${hits.slice(1, 3).map((h) => `${h.clients} in ${h.name}`).join(", ")}` : ""}`;
  const sums = states.map((c) => rollup(c, markets));
  if (sums.length && onlyStates(body, states)) return sums.map((s) => `directory says ${s.clients} across ${s.name} (${s.markets.filter((m) => m.clients).slice(0, 6).map((m) => `${placeOf(m.name)} ${m.clients}`).join(", ") || "no markets yet"})`).join("; ");
  if (sums.length) return `directory has no market by that name; the state has ${sums.map((s) => `${s.clients} across ${s.name}`).join(", ")}`;
  return "directory has no market by that name (none there yet)";
}

/** What a reply may never contain, whatever the model wrote; the reply becomes ask_william with the draft kept. */
export function guard(text: string): string | null {
  if (/\$|\b\d+\s?(?:cents?|usd|cad|dollars|bucks)\b|\b(?:a|per) month\b/i.test(text)) return "a price";
  if (/\bguarantee/i.test(text)) return "a guarantee";
  if (/\b(?:pre-?)?record(?:ed|ing)?\b|\blive\b/i.test(text)) return "live or recorded";
  if (/\b(?:jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.? \d{1,2}\b|\b20\d\d\b/i.test(text)) return "a date";
  if (/\b(?:i'?m|i am) (?:an? )?(?:ai|bot|human|real person)\b/i.test(text)) return "bot or human";
  return null;
}

/** The model's tool input, checked: unknown actions skip, a reply without words skips, reactions only from the fixed set. */
export function parseDecision(input: unknown): Decision {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const text = String(o.text ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_TEXT);
  let action: Action = (ACTIONS as readonly string[]).includes(String(o.action)) ? (o.action as Action) : "skip";
  const category: Category = (CATEGORIES as readonly string[]).includes(String(o.category)) ? (o.category as Category) : "other";
  const react = isEmoji(String(o.react ?? "")) ? String(o.react) : "";
  let why = String(o.why ?? "").replace(/\s+/g, " ").trim().slice(0, 140);
  if (action === "reply" && !text) action = "skip";
  const bad = action === "reply" ? guard(text) : null;
  if (bad) { action = "ask_william"; why = `draft mentions ${bad}; ${why}`.slice(0, 140); }
  return { action, category, text: action === "skip" || action === "ghost" ? "" : text, react, why };
}

/** Whether this decision posts without a moderator in this mode. */
export function postsItself(mode: Mode, d: Decision): boolean {
  if (d.action !== "reply") return false;
  return mode === "auto" || (mode === "assisted" && ASSISTED.has(d.category));
}

/** A human pause before a reply posts itself (Kevin's median is 36 s); none in shadow, where nothing posts. */
export function delayMs(mode: Mode, pick = Math.random): number {
  return mode === "shadow" || mode === "off" ? 0 : 15_000 + Math.floor(pick() * 25_000);
}

/** The one JSON object in the model's text, code fence or stray words around it ignored; null when there is none. */
export function extractJson(text: string): unknown {
  const a = text.indexOf("{");
  const b = text.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try {
    return JSON.parse(text.slice(a, b + 1));
  } catch {
    return null;
  }
}

/** One Messages API call, the system prompt cached, the answer a JSON object. Null on any failure. */
export async function decide(system: string, turn: string): Promise<{ decision: Decision; ms: number } | null> {
  if (!KEY) return null;
  const t0 = Date.now();
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      // The model thinks before it answers and the thinking counts against max_tokens: 300 cut the JSON off on one line in four.
      body: JSON.stringify({ model: MODEL, max_tokens: 1500, system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }], messages: [{ role: "user", content: turn }] }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) {
      console.error("[kaitlyn] model call failed", { status: res.status, body: (await res.text().catch(() => "")).slice(0, 200) });
      return null;
    }
    const j = (await res.json()) as { content?: Array<{ type: string; text?: string }>; stop_reason?: string };
    const parsed = extractJson((j.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join(""));
    if (!parsed) {
      console.error("[kaitlyn] no JSON in the answer", { stop_reason: j.stop_reason });
      return null;
    }
    return { decision: parseDecision(parsed), ms: Date.now() - t0 };
  } catch (err) {
    console.error("[kaitlyn] model call threw", { err: String(err) });
    return null;
  }
}

type Reg = { id: string; event_id: string; session_date: string; first_name: string; source: string };

/** Kaitlyn's row in the room: a reply to one person (hidden from everyone else when that person is a ghost). Returns the new id. */
export async function postAsKaitlyn(reg: Reg, body: string, offset: number, kind: "kaitlyn" | "text"): Promise<number | null> {
  const g = await db().from("registrants").select("ghosted_at").eq("id", reg.id).maybeSingle();
  const ins = await db().from("chat_messages").insert({ event_id: reg.event_id, session_date: reg.session_date, team_member_id: null, author_name: KAITLYN, role: "moderator", body: body.slice(0, 500), offset_seconds: Math.max(0, Math.floor(offset)), mentions: [reg.id], mention_names: [reg.first_name], kind, visible_to: g.data?.ghosted_at ? reg.id : null }).select("id").single();
  if (ins.error) { console.error("[kaitlyn] post failed", { code: ins.error.code }); return null; }
  return ins.data.id as number;
}

/** Kaitlyn's reaction, as herself; once per message. */
export async function reactAsKaitlyn(messageId: number, emoji: string): Promise<void> {
  const have = await db().from("message_reactions").select("emoji").eq("message_id", messageId).eq("who", "kaitlyn").maybeSingle();
  if (!have.data) await toggleReaction(messageId, "kaitlyn", emoji);
}

/** Called after an attendee message is stored. Decides, records the decision, and in assisted/auto acts on it. */
export async function kaitlynHandle(a: { reg: Reg; event: { kaitlyn_mode: Mode; kaitlyn_facts: string | null; cta_at_seconds: number | null }; message: { id: number; body: string; offset: number }; katherine: boolean }): Promise<void> {
  const mode = a.event.kaitlyn_mode;
  if (mode === "off" || !KEY) return;
  try {
    const { reg, message } = a;
    const [recentQ, toThemQ, marketsQ] = await Promise.all([
      db().from("chat_messages").select("id, registrant_id, author_name, role, body").eq("event_id", reg.event_id).eq("session_date", reg.session_date).eq("visibility", "all").is("deleted_at", null).lt("id", message.id).order("id", { ascending: false }).limit(40),
      db().from("chat_messages").select("id, body").eq("event_id", reg.event_id).eq("session_date", reg.session_date).eq("role", "moderator").contains("mentions", [reg.id]).order("id", { ascending: false }).limit(5),
      db().from("market_counts").select("name, clients, live"),
    ]);
    const recent = (recentQ.data ?? []).reverse();
    const ctx: Context = {
      minute: Math.floor(message.offset / 60),
      pitchMinute: a.event.cta_at_seconds === null ? null : Math.floor(a.event.cta_at_seconds / 60),
      name: reg.first_name,
      body: message.body,
      priorOwn: recent.filter((m) => m.registrant_id === reg.id).map((m) => String(m.body)).slice(-5),
      modReplies: (toThemQ.data ?? []).reverse().map((m) => String(m.body)),
      recent: recent.slice(-25).map((m) => `[${m.role === "attendee" ? "attendee" : m.author_name === KAITLYN ? "Kaitlyn" : "team"}] ${m.author_name}: ${String(m.body).slice(0, 160)}`),
      market: marketLine(message.body, ((marketsQ.data ?? []) as MarketCount[])),
      katherine: a.katherine && asksForReplay(message.body),
    };
    const out = await decide(systemPrompt(a.event.kaitlyn_facts), userTurn(ctx));
    if (!out) return;
    const d = out.decision;
    const itself = postsItself(mode, d);
    // Shadow keeps every actionable decision (a reaction included) for a moderator; the others act on the routine ones here.
    const pending = mode === "shadow" ? d.action !== "skip" || Boolean(d.react) : (d.action === "reply" && !itself) || d.action === "ask_william" || (d.action === "ghost" && mode !== "auto");
    const row = await db().from("kaitlyn_decisions").insert({ event_id: reg.event_id, session_date: reg.session_date, message_id: message.id, registrant_id: reg.id, action: d.action, category: d.category, text: d.text, react: d.react, why: d.why, status: pending ? "pending" : "skipped", decided_at: pending ? null : new Date().toISOString(), model: MODEL, ms: out.ms }).select("id").single();
    if (row.error) { console.error("[kaitlyn] decision insert failed", { code: row.error.code }); return; }
    const did = row.data.id as number;
    if (mode === "shadow") return;
    if (d.react) { await reactAsKaitlyn(message.id, d.react); await db().from("kaitlyn_decisions").update({ reacted_at: new Date().toISOString() }).eq("id", did); }
    if (pending) {
      if (reg.source !== "test") await postToChatChannel(`Kaitlyn needs you · ${reg.first_name}: ${JSON.stringify(message.body.slice(0, 200))} → ${d.action.replace("_", " ")}${d.text ? ` ${JSON.stringify(d.text)}` : ""} (${d.why})`);
      return;
    }
    if (d.action === "ghost") {
      await db().from("registrants").update({ ghosted_at: new Date().toISOString(), auto_ghost_reason: `kaitlyn: ${d.why}`.slice(0, 200) }).eq("id", reg.id).is("ghosted_at", null);
      await db().from("chat_messages").update({ visibility: "author", updated_at: new Date().toISOString() }).eq("id", message.id);
      await db().from("kaitlyn_decisions").update({ status: "ghosted", decided_at: new Date().toISOString() }).eq("id", did);
      return;
    }
    if (!itself) return;
    const t0 = Date.now();
    await new Promise((r) => setTimeout(r, delayMs(mode)));
    // Still hers to answer? A moderator may have replied meanwhile, or she replied to them a moment ago.
    const [human, hers] = await Promise.all([
      db().from("chat_messages").select("id").eq("event_id", reg.event_id).eq("session_date", reg.session_date).eq("role", "moderator").neq("author_name", KAITLYN).contains("mentions", [reg.id]).gt("id", message.id).limit(1),
      db().from("chat_messages").select("id").eq("event_id", reg.event_id).eq("session_date", reg.session_date).eq("author_name", KAITLYN).contains("mentions", [reg.id]).gte("created_at", new Date(Date.now() - PER_PERSON_MS).toISOString()).limit(1),
    ]);
    if (human.data?.length || hers.data?.length) {
      await db().from("kaitlyn_decisions").update({ status: "skipped", why: `${human.data?.length ? "a moderator answered first" : "she replied to them a moment ago"}; ${d.why}`.slice(0, 140), decided_at: new Date().toISOString() }).eq("id", did);
      return;
    }
    const body = `@${reg.first_name} ${d.text}`;
    const mid = await postAsKaitlyn(reg, body, message.offset + (Date.now() - t0) / 1000, "kaitlyn");
    if (mid) await db().from("kaitlyn_decisions").update({ status: "auto", sent_body: body, sent_message_id: mid, decided_at: new Date().toISOString() }).eq("id", did);
  } catch (err) {
    console.error("[kaitlyn] handle threw", { err: String(err) });
  }
}
