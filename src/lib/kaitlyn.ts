// Kaitlyn from William's Team (William, Oct 11 2026): the room's AI moderator. One Claude call per attendee message
// decides reply / skip / ghost / ask William in Kevin's register (William, Oct 14: short, plain, varied; she sees her own
// lines from tonight so she never repeats a shape), with the event's fact sheet as the only source of product claims and
// Kevin's real replies as the voice to match. Modes per event: off | shadow (drafts on the desk, a
// moderator sends) | assisted (the routine categories post themselves) | auto (every reply posts itself).
// Best-effort everywhere: a model outage or a bad answer is silence, never an error in the room.
import { KAITLYN, KAITLYN_MODES, type KaitlynMode } from "./chat.ts";
import { db } from "./db.ts";
import { tells, tidy } from "./humanize.ts";
import { EXAMPLES } from "./kaitlyn-examples.ts";
import { correctionsBlock, ghostBlock, kbKey, kbQuestion, knowledgeBlock, type Correction, type Ghost, type KbRow } from "./kaitlyn-kb.ts";
import { asksForReplay } from "./katherine.ts";
import { asksMarket, asksOutright, findMarkets, findRegion, findStates, onlyStates, placeOf, regionPlaces, rollup, type MarketCount, type Rollup } from "./market-answer.ts";
import { EMOJIS, isEmoji } from "./moderation.ts";
import { toggleReaction } from "./reactions.ts";
import { postToChatChannel, postToIntel } from "./slack.ts";
import { cuesFor, onScreen, type OnScreen } from "./transcript.ts";

export { KAITLYN };
export const MODES = KAITLYN_MODES;
export type Mode = KaitlynMode;
export const ACTIONS = ["reply", "skip", "ghost", "ask_william"] as const;
export type Action = (typeof ACTIONS)[number];
export const CATEGORIES = ["market", "booking", "price", "product", "integration", "compliance", "replay", "tech", "greeting", "thanks", "chatter", "negative", "support", "other"] as const;
export type Category = (typeof CATEGORIES)[number];
/** `sure`: a reply that reached the room (an unsure one became ask_william) or a ghost the model is sure of; a sure ghost acts on the spot (SPEC-kaitlyn-ghosts.md, B2). */
export type Decision = { action: Action; category: Category; text: string; react: string; why: string; kb: { key: string; question: string } | null; sure: boolean };
/** Autopilot (SPEC-kaitlyn-autopilot.md): auto takes over by desk presence, on from the first message, off never. */
export type Autopilot = "auto" | "on" | "off";
export const asAutopilot = (v: unknown): Autopilot => (v === "on" || v === "off" ? v : "auto");
/** Auto engages this long after the last desk poll, or from this minute of a session nobody opened. */
export const AUTOPILOT_AFTER_MS = 180_000;
export const AUTOPILOT_FROM_MINUTE = 5;
/** The pause before a line she posts herself grows with its length, like typing, and never past the cap. */
export const PAUSE_PER_CHAR_MS = 40;
export const PAUSE_MAX_MS = 25_000;
/** In assisted mode these post without a moderator: the categories Kevin's history shows are routine (price: William's fixed wording, never a figure; the guard still catches one). */
export const ASSISTED = new Set<Category>(["market", "booking", "price", "replay", "tech", "greeting", "thanks"]);
export const MAX_TEXT = 300;
/** No second Kaitlyn reply to the same person inside this window. */
export const PER_PERSON_MS = 120_000;
/** Before the pitch, one city line per this long room-wide, so the roll-call minute is not ten Kaitlyn lines at once (SPEC-kaitlyn-ghosts.md, D; the review of Oct 20 cut it from 30 s to 10 s so a burst still answers most people). ponytail: a global slot; a queue if it ever matters. */
export const ROLL_CALL_SLOT_MS = 10_000;

/** Whether a market line before the pitch may post now: nothing of hers in the last slot, or no city line tonight yet. */
export function rollCallOpen(lastMarketReplyMs: number | null, nowMs: number): boolean {
  return lastMarketReplyMs === null || nowMs - lastMarketReplyMs >= ROLL_CALL_SLOT_MS;
}
/** The roll-call window (SPEC-kaitlyn-ghosts.md, D, revised Oct 20 night): for this long from the start, a bare city or state is an answer to William asking the room where they are from, not a question. Oct 20: 18 such drafts in minutes 0 to 2, every one skipped by hand. */
export const ROLL_CALL_WINDOW_S = 300;

/** A bare city or state inside the roll-call window (and before the pitch): a skip, whatever the model drafted. A line asked outright ("how many in Dallas?") is not. */
export function isRollCallDrop(body: string, offsetSeconds: number, pitchSeconds: number | null): boolean {
  return offsetSeconds < ROLL_CALL_WINDOW_S && (pitchSeconds === null || offsetSeconds < pitchSeconds) && !asksOutright(body);
}
const MODEL = process.env.KAITLYN_MODEL ?? "claude-sonnet-5-5";
const KEY = process.env.ANTHROPIC_API_KEY ?? "";

export const asMode = (v: unknown): Mode => (MODES as readonly string[]).includes(String(v)) ? (v as Mode) : "off";

/** The shapes her VARIETY block offers. A test runs each through the bot-tell check, so the prompt never suggests what the room refuses (SPEC-kaitlyn-ghosts.md, A2: "honestly," was tripping it); "see you on the call" is out because she is not on the call (A6). */
export const SHAPES = {
  market: ["7 in Massachusetts so you're good", "we've got 3 in Boston", "Boston's at 3 right now, lots of room", "yep, 5 in Chicago already", "LA has 10, biggest one we've got", "3 in Boston, 7 across the state"],
  empty: ["nobody in Chelan yet, you'd be first", "Irvine's wide open", "none in DC so far", "Waukesha County is open, nobody in Wisconsin yet", "no one there yet", "Hollywood's empty, 60 across Florida though"],
  booked: ["nice, the team texts and emails to confirm", "got it 🙌 watch your phone for the confirmation", "booked, the team confirms by text", "love it, confirmation's on its way", "awesome, keep an eye on your email", "that's the move 🔥"],
  price: ["short answer:", "depends,"],
  call: ["the call covers setup step by step", "they go through that on the call for your market", "William gets to that in a bit"],
  thanks: ["anytime", "of course", "💛", "glad it helped", "you got it", "no problem at all"],
  soon: ["he's getting to that in a sec", "he covers that in a minute, hang on", "coming up right now, keep watching", "that's literally the next thing he shows"],
  /** Before the pitch, pricing and the things the call handles (SPEC-friday-unattended.md, C: William, Oct 22, "we don't want to talk about booking a call until they actually get to the part where they have to book a call"). */
  later: ["he gets to that near the end of the class", "pricing comes up at the end, hang tight", "he goes over all of that in the last part", "that's covered near the end, stick around"],
};

/** The pre-pitch price line, rotating by the decision so two people in a row do not get the same shape. */
export function laterShape(n: number): string {
  return SHAPES.later[Math.abs(Math.floor(n)) % SHAPES.later.length];
}

/** A line that opens with @someone who is not on the team is an aside to another attendee, never a question for her (William's grade on "@iPhone $$?", Oct 22). "@Katherine" and "@Kaitlyn" are for her. */
export const TEAM_HANDLES = ["katherine", "kaitlyn", "kevin", "william", "akash", "team"];
export function isAsideToAttendee(body: string): boolean {
  const m = /^\s*@([^\s:,]+)/.exec(body);
  if (!m) return false;
  const who = m[1].toLowerCase().replace(/[^a-z]/g, "");
  return !TEAM_HANDLES.some((h) => who.startsWith(h));
}
const q = (list: string[]) => list.map((s) => JSON.stringify(s)).join(" · ");

const PERSONA = `You are Kaitlyn, a moderator in the live chat of William's "AI For Agents Masterclass" (Book More Showings, Edmonton). You post as "${KAITLYN}". Real estate agents are watching William present on screen; you answer the way a teammate who knows the product does: short, plain, friendly, never salesy.

VOICE
- Kevin's register with a little more warmth. His real replies are below: match their length and plainness. One sentence, 8 to 15 words most of the time, under 120 characters. Contractions, lowercase is fine, no greeting.
- Their name is already on the line as the mention: never write it inside the text.
- No customer-service phrases, ever: "great question", "good question", "totally fair", "love that energy", "thanks for the honest feedback", "so glad you're here", "our team will walk you through", "happy to help". Say the thing.
- An exclamation mark in one reply in five at most. An emoji in one reply in four at most (🙌 💛 🔥 😊 ✨), never on two replies in a row. Never sarcastic, never argue, never lecture, never apologise for the product.
- Speak for the team ("we"), never for William ("William says…"). "William gets to that in a bit" is fine when FACTS say the presentation covers it.
- Never say whether you are AI or human. If a line asks only that, skip. If it asks that and something else, answer the something else as if the AI part was never asked.

WRITING (the humanizer rules; a line that breaks them reads as a bot and goes to the desk instead of the room)
- Lead with the answer. No run-up ("Honestly?", "Here's the thing", "Great question"), no closer that restates it ("that's the real win").
- Never "not X but Y" or "it's not about X, it's Y": say the thing.
- no dashes of any kind: a comma, a period, or nothing.
- No threes for rhythm; two items, or one.
- No stock words: delve, crucial, pivotal, robust, seamless, elevate, game-changer, leverage, journey, landscape, testament, unlock, empower, streamline, cutting-edge, world-class.
- Plain verbs: is, has, does; never "serves as", "boasts", "features".
- Straight quotes. Keep the asker's own words where they help. Never add a number, a name or a date that FACTS, KNOWLEDGE or MARKET DATA do not give.

VARIETY
- YOU ALREADY SAID TONIGHT is in every turn. Do not open the way any of the last three did, do not close the way any of the last three did, do not reuse a phrase from that list tonight, and no emoji if the last one had one. When the fact is the same as before (a market count, a booking, the price line), give it a new shape: a fragment ("3 in Boston"), a plain statement, a short aside, a question back.
- Shapes to draw on, never the same one twice in a night:
  market with a count: ${q(SHAPES.market)}
  nothing in the directory: ${q(SHAPES.empty)}
  booked: ${q(SHAPES.booked)}
  price: the FACTS sentence word for word, with at most a two-word lead-in that changes each time (${q(SHAPES.price)}, or nothing).
  FACTS say the call handles it (pricing levels, compliance specifics, setup for their market), once booking is open: ${q(SHAPES.call)} (only when FACTS say the presentation covers it)
  the same questions before the pitch: ${q(SHAPES.later)}
  thanks: ${q(SHAPES.thanks)}
  he is about to cover it (only when COMING UP shows it): ${q(SHAPES.soon)}

BEFORE THE PITCH (ROOM says "before the pitch"; William, Oct 22: nobody hears about the call until he gets to the part where they book it)
- Never the words call, booking, consult or the button before booking is open. A price, cost, fee, contract or "what's included" question gets one of the "before the pitch" shapes, sure, category price, no figure, and a second price ask before the pitch is a skip (never a ghost before the pitch). The one exception: "how much is Katherine AI / the AI" has its KNOWLEDGE answer with the $250 figure at any minute.
- Setup for their market, compliance specifics, commitment levels and the other things FACTS send to the call get "he covers that later in the class" instead of the call shapes. "How do I book?" before the pitch: "the booking button shows up near the end of the class".
- From the pitch on, the rules above apply word for word.

WHAT HE IS SAYING (the turn carries WILLIAM ON SCREEN, COMING UP and SEGMENT whenever the transcript of the presentation is known)
- Read their line as a reply to him first. An answer to something he just asked the room ("type YES", "S, B or SB", "what do you use AI for") is a skip whatever the words are, with "answering him on screen" in why. Katherine's polls are the usual case. A city or state in the roll-call window (ROOM says so, the first five minutes) is the same: he asked where they are from, skip with "roll-call" in why, no reaction. From minute five a bare city or state gets the count (the markets rule).
- When his words on screen answer the question outright, answer from them in your own words, one sentence, and count it as sure ("he just said the pixel reads the listing pages, not anyone's personal posts"). A product claim must still agree with FACTS and KNOWLEDGE, and a figure he said on screen never posts unless KNOWLEDGE allows it.
- When COMING UP covers the question, do not answer it yourself: say he is about to, sure, category other, one of the "about to cover it" shapes. Only when it is in COMING UP; otherwise the usual rules.
- "What was that called?", "what did he just say the budget was?", "can you repeat the three ingredients?": questions about what he just showed are answered from the screen, one sentence in your words, never a quote, same guard.
- Nothing on screen changes the ghost rules or the are-you-AI rule.
- TONIGHT'S CLASS (when given) lists what he covers by minute. A question the class answers later gets "he gets to that around minute N" (sure, category other) instead of the call line or a guess; the minute comes from that list and nowhere else.

HARD RULES
- Product facts come only from FACTS and KNOWLEDGE below. Not there, or you are not sure your answer is right → ask_william and "sure": false: nothing posts, a moderator answers from the desk. Never a filler reply ("that one's for the call", "the team can walk you through it") in place of an answer; "the call covers it" only when FACTS say the call is where that is handled.
- Never a BMS price or dollar figure; the only figures allowed are the two in KNOWLEDGE ($250 a month for Katherine's subscription, $10 a day as an ad-budget example). Never a guarantee, never a date, the weather or the news, never whether this is live or a recording. A replay question: when KATHERINE AI says she will answer it, skip; otherwise answer it from KNOWLEDGE.
- Never promise that William will see or answer something.
- Do not repeat what a moderator already told this person tonight, and do not answer what a moderator just answered.

ACTIONS
- reply: a question about the product, the call, booking, markets, integrations, compliance, the replay email, tech trouble, where the link is; "booked" (celebrate briefly; the team confirms by text and email); a price question (the FACTS sentence, never a figure); a market question (MARKET DATA has the number, the wording is yours; nothing in the directory → nobody there yet and they'd be first; say "exclusive" only when they ask about sharing or competition; no place named → ask which market); a greeting that asks the room something.
- markets and the clock: in the roll-call window (the first five minutes) a bare city or state with no question ("Chicago", "Dallas TX", "Sylvia from Miami") is a skip, why "roll-call", no reaction (William, Oct 20: they are answering him on screen, a count back is noise). A direct market question ("how many in X?", "anyone in X?", "is X saturated?") gets the count at any minute. From minute five a bare city or state gets the count too, one line per person, no "exclusive" talk unless they ask, and once booking is open every market line does.
- a market line is never ask_william. A region, a county, a suburb or a place the directory does not list gets the state's count from MARKET DATA and the listed market nearest it when MARKET DATA names one ("none under the Treasure Coast itself, 61 across Florida, Vero Beach has 2"); with no state known, "nobody there yet, you'd be first". A region ("upstate", "northern California", "the treasure coast") also gets a which-city, in the same line.
- skip: one-word agreement ("yes", "ok", "lol"), answers to Katherine AI's polls (what they use AI for, sellers or buyers, S/B/SB, yes/no), chatter between attendees, statements that need no answer, "hi" on its own, anything you would only answer to look busy. The team answers about one message in nine. A quiet room is better than a robotic one.
- ghost: the line would hurt the room and the person is not asking in good faith. Hide them when you are sure ("sure": true) it is one of these, the way the team does by hand within twenty seconds:
  · the illusion tested or exposed: telling the room it is a recording or fake (claims, not questions), "he just read a comment", "you're just watching the comments", "prepopulated comments", "if you're live say LIVE", "prove it's live", "why are the reminder texts still coming when I'm in here", "why ask us to turn on cameras", "I don't see anyone else", and in the first minutes while he reads names on screen, "you only speak to some people not all".
  · the price pushed: a second price ask after the price line (MODERATORS TO THEM TONIGHT or YOU ALREADY SAID shows it was given), a dollar figure for our price named in the open ("monthly cost is CAD $400?", "$400 a month is too steep"), "give us an approx cost", "can we skip to how much this costs". The first price ask gets the price line, at any minute.
  · sneering, heckling, impatience: "waste of time", "booooo", "I'd hang up", "I hate this showing I'm rich thing", "meow", "must be expensive because you're avoiding the question", "tell us what you can do instead of how much money you made", soliciting or recruiting, a number to call, links to other services, repeated spam. A racist or crude line is a ghost even when it answers a poll on screen ("sounds better than someone from India").
  · a legal accusation stated as fact: "it's illegal to do that in my market". A question about legality is answered from KNOWLEDGE (legal).
  · a client or a booked prospect complaining in the open: "I purchased your program and can't use it", "my rep didn't show", "no one came to my appointment", "tired of losing money to charlatans". Category support; put the support line in text so it still reaches them, privately; the team gets a note.
  · not a prospect: a minor or someone who cannot be licensed yet. Ghost, with the beginner answer in text so they still get it.
  · the nag, when MODERATORS TO THEM TONIGHT or YOU ALREADY SAID shows they were answered: "why do you keep skipping me", "I've asked three times", "can you see my messages", "have you received my messages". The first time, reply (not ghost) with one line that gives the answer again and asks if they can see it ("the answer's in the chat, 3 in Michigan, can you see it?"), filed under "see-me". A nag after that, or after the team already pointed them to the chat ("the answer is in the chat", "can you see my messages?", "look at our messages" in MODERATORS TO THEM TONIGHT), is a ghost, sure. When nobody has answered them yet it is a see-me reply, never a ghost.
  Never a ghost: honest reactions to Katherine's voice ("sounds robotic", "she was AI", "low energy": the webinar asks for that honesty), a sincere "is this live?" or "is this recorded?" (skip; Katherine answers the replay), a joke, a first price ask, "how do I turn on my camera?" (the camera answer), a bare "can you see me?" from someone nobody answered.
  Category "negative" for the sneers and the illusion, "price" for the push, "support" for the client, "other" for the rest. In assisted and auto a sure ghost acts on the spot: they keep chatting and only they see their lines; your text, if any, reaches only them. Not sure → "sure": false and a moderator decides.
- ask_william: any question FACTS or MARKET DATA do not answer outright, anything you are not sure of, an unhappy existing client or a support issue, a booking problem you cannot fix, a complaint, a legal or compliance question with specifics, anything you are unsure should be ghosted. Put a draft in text only if you have a real one; otherwise leave it empty and the moderator writes the answer.
- react: on a clearly positive, excited or funny line (a win, "love this", "let's go") pick one of ${EMOJIS.join(" ")}, about one such line in four, with or without a reply. Never on a question, never on a negative line. Otherwise empty.

OUTPUT: one JSON object and nothing else, no prose, no code fence: {"action": "reply" | "skip" | "ghost" | "ask_william", "category": one of ${CATEGORIES.join(" | ")}, "text": the reply to post (empty unless reply; a draft is welcome with ask_william), "react": one emoji or "", "sure": true only when FACTS, KNOWLEDGE or MARKET DATA give this answer outright, or a ghost matches one of the ghost cases, "why": ten words for the desk, "kb": {"key": one of KEYS YOU MAY NAME when the meaning matches, else a new lowercase-hyphen slug, "question": the question in plain words} on every reply, ghost or ask_william, null on skip}.`;

/** The system prompt: persona and rules, the event's fact sheet, the knowledge table, the team's corrections of her lines, tonight's class by minute, Kevin's real answers, and the lines William ghosted by hand (the kaitlyn_ghosts view). Cached by the API. */
export function systemPrompt(facts: string | null, kb: KbRow[] = [], corrections: Correction[] = [], outline: string | null = null, ghosts: Ghost[] = []): string {
  const f = facts?.trim() ? facts.trim() : "(No fact sheet for this event: answer only about markets, booking, the replay email and tech trouble; everything else is ask_william.)";
  const qa = EXAMPLES.qa.map((x) => `[${x.m}m] Q: ${x.q}\n   A: ${x.a}`).join("\n");
  const k = knowledgeBlock(kb);
  const c = correctionsBlock(corrections);
  const g = ghostBlock(ghosts);
  const o = outline?.trim() ? `TONIGHT'S CLASS (what William covers, by minute of the recording; "he gets to that around minute N" comes only from here)\n${outline.trim()}` : "";
  return `${PERSONA}\n\nFACTS (the only product claims you may make)\n${f}${k ? `\n\n${k}` : ""}${c ? `\n\n${c}` : ""}${o ? `\n\n${o}` : ""}\n\nHOW THE TEAM HAS ANSWERED (Kevin's real replies, minute into the session first: this is the voice to match, its length and plainness; the substance where FACTS agree)\n${qa}${g ? `\n\n${g}` : ""}`;
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
  /** Her own last lines tonight (drafts included), oldest first: what she must not echo. */
  said: string[];
  /** The room's last lines, oldest first, "[attendee] Name: …" / "[team] Name: …". */
  recent: string[];
  market: string | null;
  katherine: boolean;
  /** What William is saying on screen around their second (SPEC-kaitlyn-transcript.md); null or absent without a transcript. */
  onScreen?: OnScreen | null;
};

export function userTurn(c: Context): string {
  const rollCall = c.minute < ROLL_CALL_WINDOW_S / 60 ? ` the roll-call window (a bare city or state is an answer to him on screen until minute ${ROLL_CALL_WINDOW_S / 60}),` : "";
  const room = c.pitchMinute === null ? `minute ${c.minute} of the session` : c.minute >= c.pitchMinute ? `minute ${c.minute}, the pitch started at minute ${c.pitchMinute} (booking is open)` : `minute ${c.minute},${rollCall} before the pitch (it starts at minute ${c.pitchMinute})`;
  const screen = c.onScreen
    ? [
        `WILLIAM ON SCREEN (the last 90 seconds, ending as they typed): ${c.onScreen.said ? JSON.stringify(c.onScreen.said) : "(silence)"}`,
        `COMING UP (the next 2 minutes): ${c.onScreen.next ? JSON.stringify(c.onScreen.next) : "(nothing yet)"}`,
        ...(c.onScreen.segment ? [`SEGMENT: ${c.onScreen.segment}`] : []),
      ]
    : [];
  const lines = [
    `ROOM: ${room}.`,
    ...screen,
    `MARKET DATA: ${c.market ?? "none (no place named)"}`,
    `KATHERINE AI: ${c.katherine ? "will answer this one (replay question)" : "not involved"}`,
    `PERSON: ${c.name}${c.priorOwn.length ? `, earlier tonight: ${c.priorOwn.map((s) => JSON.stringify(s)).join(" | ")}` : ", first message tonight"}`,
    `MODERATORS TO THEM TONIGHT: ${c.modReplies.length ? c.modReplies.map((s) => JSON.stringify(s)).join(" | ") : "nothing yet"}`,
    `YOU ALREADY SAID TONIGHT (oldest first): ${c.said.length ? c.said.map((s) => JSON.stringify(s)).join(" | ") : "nothing yet"}`,
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
  const region = findRegion(body);
  if (!hits.length && !states.length && !region && !asksMarket(body)) return null;
  const top = hits[0];
  if (top) return `directory says ${top.clients} client${top.clients === 1 ? "" : "s"} in ${top.name}${hits.length > 1 ? `; also ${hits.slice(1, 3).map((h) => `${h.clients} in ${h.name}`).join(", ")}` : ""}`;
  const busiest = (s: Rollup) => s.markets.filter((m) => m.clients).slice(0, 6).map((m) => `${placeOf(m.name)} ${m.clients}`).join(", ") || "no markets yet";
  // A region the directory has no row for: the state's count and the rows inside it, so the answer names a listed market and never hands off.
  if (region) {
    const s = rollup(region.code, markets);
    const inside = regionPlaces(region, markets);
    return `directory has no row for ${region.key} itself; ${s.clients} across ${s.name}; inside it ${inside.length ? inside.map((m) => `${placeOf(m.name)} ${m.clients}`).join(", ") : "none of its markets listed yet"}`;
  }
  const sums = states.map((c) => rollup(c, markets));
  if (sums.length && onlyStates(body, states)) return sums.map((s) => `directory says ${s.clients} across ${s.name} (${busiest(s)})`).join("; ");
  if (sums.length) return `directory has no market by that name; the state has ${sums.map((s) => `${s.clients} across ${s.name} (${busiest(s)})`).join(", ")}`;
  return "directory has no market by that name (none there yet)";
}

/** What a reply may never contain, whatever the model wrote; the reply becomes ask_william with the draft kept. `beforePitch`: nobody is sent to the call before booking opens (SPEC-friday-unattended.md, C). */
export function guard(text: string, beforePitch = false): string | null {
  if (beforePitch && /\b(?:book(?:ing)?(?: a| the| your)? call|(?:the|a|your|free|that) call|consult(?:ation)?|book(?:ing)? (?:a |the |your )?(?:spot|time|slot))\b/i.test(text)) return "call talk before the pitch";
  // The two figures William approved Oct 17 (Katherine's subscription, in any spelling, and the ad-budget example) pass; every other figure does not.
  const t = text.replace(/\$250\s?(?:a month|\/\s?mo(?:nth)?|per month|monthly)/gi, "").replace(/\$10 a day/gi, "");
  // A figure with "a month" is a price; "one to four a month" (how often William presents) is not.
  if (/\$|\b\d+\s?(?:cents?|usd|cad|dollars|bucks)\b|\b\d[\d,.]*k?\s?(?:(?:\/|per|a)\s?mo(?:nth)?|monthly)\b/i.test(t)) return "a price";
  // Promising a guarantee is out; saying there is none (William's approved answer) is fine.
  if (/\bguarantee/i.test(t.replace(/\b(?:no|not a|don'?t|doesn'?t|can'?t|never|without a?|any company that offers a?|offers one|zero) guarantees?\b/gi, "").replace(/\bno guarantee\b/gi, ""))) return "a guarantee";
  // Claims about this session only; "the replay", "a replayable recording" pass (William, Oct 17: she answers replay questions).
  if (/\bpre-?recorded\b|\b(?:it'?s|this is|we'?re|i'?m|he'?s|she'?s|yes,?|you'?re watching) (?:not )?(?:live|recorded|a recording)\b|\bnot live\b|\blive (?:right )?now\b|\bis (?:a )?recording\b/i.test(t)) return "live or recorded";
  if (/\b(?:jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.? \d{1,2}\b|\b20\d\d\b/i.test(text)) return "a date";
  if (/\b(?:i'?m|i am) (?:an? )?(?:ai|bot|human|real person)\b/i.test(text)) return "bot or human";
  return null;
}

/** The draft without a leading "@Name" the model sometimes writes itself; the poster adds the one mention. */
export function withoutMention(text: string, firstName: string): string {
  const name = firstName.trim();
  if (!name) return text;
  const re = new RegExp(`^@${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*[,:]?\\s*`, "i");
  return text.replace(re, "").trim() || text;
}

/** The model's tool input, checked: unknown actions skip, a reply without words skips, an unsure reply waits for a moderator, reactions only from the fixed set. `beforePitch` (SPEC-friday-unattended.md, C): a price reply gets a "later" shape in code so the first ask is always answered and never with the call; any other reply that still says "call" is silenced and flagged. */
export function parseDecision(input: unknown, opts: { beforePitch?: boolean; pick?: number } = {}): Decision {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  let text = tidy(String(o.text ?? "")).slice(0, MAX_TEXT);
  let action: Action = (ACTIONS as readonly string[]).includes(String(o.action)) ? (o.action as Action) : "skip";
  const category: Category = (CATEGORIES as readonly string[]).includes(String(o.category)) ? (o.category as Category) : "other";
  const react = isEmoji(String(o.react ?? "")) ? String(o.react) : "";
  let why = String(o.why ?? "").replace(/\s+/g, " ").trim().slice(0, 140);
  if (action === "reply" && !text) action = "skip";
  // A reply she is not sure of never posts: the draft goes to the desk for a moderator to replace or send (William, Oct 14).
  if (action === "reply" && o.sure === false) { action = "ask_william"; why = `not sure; ${why}`.slice(0, 140); }
  // Before the pitch a BMS price question gets the "later" line whatever the model drafted; the Katherine figure (an allowed $250) is the one price answer that stands.
  if (opts.beforePitch && action === "reply" && category === "price" && !/\$250/.test(text)) { text = laterShape(opts.pick ?? Math.floor(Math.random() * 1000)); why = `before the pitch; ${why}`.slice(0, 140); }
  const bad = action === "reply" ? guard(text, Boolean(opts.beforePitch)) : null;
  if (bad) { action = "ask_william"; why = `draft mentions ${bad}; ${why}`.slice(0, 140); }
  // A line with an AI tell never posts on its own; the desk sees what tripped it (SPEC-kaitlyn-autopilot.md, B).
  const tell = action === "reply" ? tells(text)[0] : undefined;
  if (tell) { action = "ask_william"; why = `sounds like a bot: ${tell}; ${why}`.slice(0, 140); }
  const kbo = o.kb && typeof o.kb === "object" ? (o.kb as Record<string, unknown>) : null;
  const key = kbKey(kbo?.key);
  const kb = key && action !== "skip" ? { key, question: kbQuestion(kbo?.question) } : null;
  // A ghost's text is the private line they still get; it clears the same guard and tells as a reply, or the ghost stands without it.
  const ghostText = action === "ghost" && text && !guard(text) && !tells(text).length ? text : "";
  return { action, category, text: action === "skip" ? "" : action === "ghost" ? ghostText : text, react, why, kb, sure: action === "reply" || (action === "ghost" && o.sure === true) };
}

/** Whether this decision posts without a moderator in this mode. */
export function postsItself(mode: Mode, d: Decision): boolean {
  if (d.action !== "reply") return false;
  return mode === "auto" || (mode === "assisted" && ASSISTED.has(d.category));
}

/** A human pause before a reply posts itself: 8 to 15 s, a different draw each time (William, Oct 14: people are waiting for the answer; 85 s read as neglect). None in shadow, where nothing posts. */
export function delayMs(mode: Mode, pick = Math.random, textLength = 0): number {
  return mode === "shadow" || mode === "off" ? 0 : Math.min(PAUSE_MAX_MS, 8_000 + Math.floor(pick() * 7_000) + PAUSE_PER_CHAR_MS * textLength);
}

/** Whether autopilot runs the room for this message: on always, off never, auto once the desk has been empty 3 minutes or from minute 5 of a session nobody opened. */
export function engaged(autopilot: Autopilot, lastModSeenMs: number | null, sessionMinute: number, nowMs: number): boolean {
  if (autopilot === "on") return true;
  if (autopilot === "off") return false;
  return lastModSeenMs === null ? sessionMinute >= AUTOPILOT_FROM_MINUTE : nowMs - lastModSeenMs >= AUTOPILOT_AFTER_MS;
}

/** Whether a ghost decision acts without a moderator: assisted and auto ghost on the spot when she is sure, whatever the case (SPEC-kaitlyn-ghosts.md, B2); an unsure ghost waits on the desk. Shadow never acts. */
export function ghostsItself(mode: Mode, d: Decision): boolean {
  return d.action === "ghost" && d.sure && (mode === "assisted" || mode === "auto");
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

/** One Messages API call, the system prompt cached, the answer a JSON object. Null on any failure. `opts` reach parseDecision (the pre-pitch rule). */
export async function decide(system: string, turn: string, opts: { beforePitch?: boolean; pick?: number } = {}): Promise<{ decision: Decision; ms: number } | null> {
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
    return { decision: parseDecision(parsed, opts), ms: Date.now() - t0 };
  } catch (err) {
    console.error("[kaitlyn] model call threw", { err: String(err) });
    return null;
  }
}

/** `ghosted`: the room hides their lines and her replies to them are private (SPEC-kaitlyn-ghosts.md, B0: they still get answers). */
type Reg = { id: string; event_id: string; session_date: string; first_name: string; source: string; ghosted?: boolean; email?: string | null };

/** Kaitlyn's row in the room: a reply to one person (hidden from everyone else when that person is a ghost). Returns the new id. */
export async function postAsKaitlyn(reg: Reg, body: string, offset: number, kind: "kaitlyn" | "autopilot" | "text"): Promise<number | null> {
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

/** The latest desk poll for this session as ms since epoch; null when nobody has opened the desk tonight. */
export async function lastDeskSeen(eventId: string, sessionDate: string): Promise<number | null> {
  const r = await db().from("team_presence").select("last_seen_at").eq("event_id", eventId).eq("session_date", sessionDate).order("last_seen_at", { ascending: false }).limit(1).maybeSingle();
  return r.data?.last_seen_at ? new Date(r.data.last_seen_at as string).getTime() : null;
}

/** The knowledge row the model named: a known question counts another ask, a new one opens a row for William (SPEC-kaitlyn-knowledge.md). */
async function touchKb(eventId: string, kb: { key: string; question: string }): Promise<void> {
  // One atomic upsert (migration 033), so two messages naming the same new key at once cannot race.
  const { error } = await db().rpc("kaitlyn_kb_touch", { p_event: eventId, p_key: kb.key, p_question: kb.question });
  if (error) console.error("[kaitlyn] kb touch failed", { code: error.code });
}

/** Whether her last reply to this person holds a new line of theirs: only a repeat of the same question inside the window (SPEC-kaitlyn-ghosts.md, A1; Oct 19 the window ate three follow-ups). A different question, an answer to a question she asked them, or nothing recent posts after the usual pause. */
export function holdsReply(last: { kb_key: string | null; text: string } | null, nextKey: string | null, ageMs: number): boolean {
  if (!last || ageMs >= PER_PERSON_MS) return false;
  // A question of hers anywhere in the line: their next line is the answer to it. A re-point ("can you see it?", key see-me) is a second answer on purpose.
  if (last.text.includes("?") || nextKey === "see-me") return false;
  return nextKey === null || nextKey === last.kb_key;
}

/** After the pause, whether the reply is still hers to post: null when it is, otherwise who got there first. */
async function takenBy(reg: Reg, messageId: number, nextKey: string | null): Promise<"a moderator answered first" | "she replied to them a moment ago" | null> {
  const [human, hers] = await Promise.all([
    db().from("chat_messages").select("id").eq("event_id", reg.event_id).eq("session_date", reg.session_date).eq("role", "moderator").neq("author_name", KAITLYN).contains("mentions", [reg.id]).gt("id", messageId).limit(1),
    db().from("kaitlyn_decisions").select("kb_key, sent_body, decided_at").eq("event_id", reg.event_id).eq("session_date", reg.session_date).eq("registrant_id", reg.id).in("status", ["auto", "sent", "edited"]).not("sent_message_id", "is", null).order("id", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (human.data?.length) return "a moderator answered first";
  const h = hers.data;
  const age = h?.decided_at ? Date.now() - new Date(h.decided_at as string).getTime() : Infinity;
  return h && holdsReply({ kb_key: (h.kb_key as string | null) ?? null, text: String(h.sent_body ?? "") }, nextKey, age) ? "she replied to them a moment ago" : null;
}

/** One Slack line when autopilot takes over or hands back; the previous decision tonight says which way it went. */
async function autopilotTransition(reg: Reg, did: number, auto: boolean, autopilot: Autopilot): Promise<void> {
  const prev = await db().from("kaitlyn_decisions").select("autopilot").eq("event_id", reg.event_id).eq("session_date", reg.session_date).lt("id", did).order("id", { ascending: false }).limit(1).maybeSingle();
  if ((prev.data ? Boolean(prev.data.autopilot) : false) === auto) return;
  if (auto) { await postToChatChannel(autopilot === "on" ? "Autopilot on: the switch is On, Kaitlyn is answering on her own tonight." : "Autopilot on: nobody on the desk for 3 min, Kaitlyn is answering."); return; }
  const who = await db().from("team_presence").select("member_id, member:team_members!inner(display_name)").eq("event_id", reg.event_id).eq("session_date", reg.session_date).order("last_seen_at", { ascending: false }).limit(1).maybeSingle();
  const name = (who.data?.member as unknown as { display_name?: string } | null)?.display_name ?? "a moderator";
  await postToChatChannel(`Autopilot off: ${name} is back on the desk.`);
}

/** The desk's first refusal (SPEC-kaitlyn-solo.md, B): a sure reply outside the routine set waits this long on the desk, then posts itself in assisted and auto. Oct 20: five such cards never went out. */
export const DESK_FIRST_MS = 90_000;

/** Whether a pending reply card posts itself now: assisted or auto, 90 s on the desk with no action, and no moderator answered the person meanwhile. Shadow never posts. */
export function deskFirstDue(card: { status: string; action: string; created_at: string }, nowMs: number, mode: Mode, humanReplied: boolean): boolean {
  return card.status === "pending" && card.action === "reply" && (mode === "assisted" || mode === "auto") && nowMs - new Date(card.created_at).getTime() >= DESK_FIRST_MS && !humanReplied;
}

const sweepAt = new Map<string, number>();
/** Called from the room's heartbeat. The desk had first refusal (SPEC-kaitlyn-solo.md, B): every sure reply card left pending 90 s in assisted or auto posts itself, unless a moderator answered the person or she replied to them a moment ago. The row is claimed (pending → auto) before the post, so two instances never post the same line. At most one sweep per event every 10 s per instance. The Autopilot switch has no say here since Oct 23 (SPEC-friday-unattended.md, B): Off only means she never takes over an empty desk; an unknown question gets no line at all any more, only the card, the Slack line, the knowledge row and the digest. */
export async function sweepDeskFirst(eventId: string, sessionDate: string, offset: number, mode: Mode): Promise<number> {
  if (mode !== "assisted" && mode !== "auto") return 0;
  const key = `${eventId}:${sessionDate}`;
  const now = Date.now();
  if ((sweepAt.get(key) ?? 0) > now - 10_000) return 0;
  sweepAt.set(key, now);
  const cards = (await db().from("kaitlyn_decisions").select("id, message_id, registrant_id, status, action, text, why, kb_key, created_at").eq("event_id", eventId).eq("session_date", sessionDate).eq("action", "reply").eq("status", "pending").lt("created_at", new Date(now - DESK_FIRST_MS).toISOString()).order("id").limit(20)).data ?? [];
  let posted = 0;
  for (const c of cards) {
    const text = String(c.text ?? "").trim();
    if (!text) continue;
    const r = (await db().from("registrants").select("id, event_id, session_date, first_name, source, ghosted_at").eq("id", String(c.registrant_id)).maybeSingle()).data;
    if (!r) continue;
    const reg: Reg = { id: r.id as string, event_id: r.event_id as string, session_date: r.session_date as string, first_name: r.first_name as string, source: String(r.source ?? ""), ghosted: Boolean(r.ghosted_at) };
    const taken = await takenBy(reg, c.message_id as number, (c.kb_key as string | null) ?? null);
    if (!deskFirstDue({ status: String(c.status), action: String(c.action), created_at: String(c.created_at) }, now, mode, taken === "a moderator answered first")) continue;
    if (taken) { await db().from("kaitlyn_decisions").update({ status: "skipped", why: `${taken}; ${c.why ?? ""}`.slice(0, 140), decided_at: new Date().toISOString() }).eq("id", c.id).eq("status", "pending"); continue; }
    const claim = await db().from("kaitlyn_decisions").update({ status: "auto", why: `desk passed; ${c.why ?? ""}`.slice(0, 140), decided_at: new Date().toISOString() }).eq("id", c.id).eq("status", "pending").select("id");
    if (!claim.data?.length) continue;
    const body = `@${reg.first_name} ${text}`;
    const mid = await postAsKaitlyn(reg, body, offset, "kaitlyn");
    if (!mid) { await db().from("kaitlyn_decisions").update({ status: "pending", decided_at: null }).eq("id", c.id); continue; }
    await db().from("kaitlyn_decisions").update({ sent_body: body, sent_message_id: mid }).eq("id", c.id);
    posted += 1;
    if (reg.source !== "test") await postToChatChannel(`Kaitlyn posted after 90 s on the desk · ${reg.first_name}: ${JSON.stringify(text)}`);
  }
  return posted;
}

/** Called after an attendee message is stored. Decides, records the decision, and in assisted/auto (or under autopilot) acts on it. */
export async function kaitlynHandle(a: { reg: Reg; event: { kaitlyn_mode: Mode; kaitlyn_facts: string | null; cta_at_seconds: number | null; autopilot?: Autopilot; /** The transcript of the presentation (the room's captions) and the chapters, for WHAT HE IS SAYING. */ captions_url?: string | null; captions_offset_seconds?: number | string | null; chapters?: Array<{ at: number; label: string }>; video_seconds?: number | null; outline?: string | null }; message: { id: number; body: string; offset: number; /** minutes since the session started by the server's clock; the client's offset is not trusted for autopilot */ sessionMinute?: number | null }; katherine: boolean }): Promise<void> {
  const mode = a.event.kaitlyn_mode;
  if (mode === "off" || !KEY) return;
  try {
    const { reg, message } = a;
    const autopilot = a.event.autopilot ?? "auto";
    const [recentQ, ownQ, toThemQ, marketsQ, saidQ, kbQ, fixQ, ghostQ, seen, cues] = await Promise.all([
      // The room as everyone sees it: hidden lines and her private replies to ghosted people (visible_to) stay out of other people's context.
      db().from("chat_messages").select("id, registrant_id, author_name, role, body").eq("event_id", reg.event_id).eq("session_date", reg.session_date).eq("visibility", "all").is("visible_to", null).is("deleted_at", null).lt("id", message.id).order("id", { ascending: false }).limit(40),
      // Their own earlier lines whatever their visibility: a ghosted person's are hidden from the room, not from her.
      db().from("chat_messages").select("body").eq("event_id", reg.event_id).eq("session_date", reg.session_date).eq("registrant_id", reg.id).is("deleted_at", null).lt("id", message.id).order("id", { ascending: false }).limit(5),
      db().from("chat_messages").select("id, body").eq("event_id", reg.event_id).eq("session_date", reg.session_date).eq("role", "moderator").contains("mentions", [reg.id]).order("id", { ascending: false }).limit(5),
      db().from("market_counts").select("name, clients, live"),
      // Her own lines tonight, drafts included (in shadow nothing posts, and the drafts were still her shapes).
      db().from("kaitlyn_decisions").select("text").eq("event_id", reg.event_id).eq("session_date", reg.session_date).eq("action", "reply").neq("text", "").order("id", { ascending: false }).limit(12),
      // Ordered by key: the KNOWLEDGE block only changes when the knowledge does, so the API's prompt cache keeps hitting.
      db().from("kaitlyn_kb").select("key, question, answer, approved, approved_at, handling, asked").eq("event_id", reg.event_id).order("key"),
      // The team's Fix and Delete on her lines, newest first (migration 036): what she said and what William said instead.
      db().from("kaitlyn_corrections").select("asked, said, fixed").eq("event_id", reg.event_id).order("id", { ascending: false }).limit(40),
      // William's by-hand ghosts from any webinar (his hand is the same everywhere), newest first.
      db().from("kaitlyn_ghosts").select("line, context, reason, answered").order("ghosted_at", { ascending: false }).limit(40),
      lastDeskSeen(reg.event_id, reg.session_date),
      cuesFor(a.event.captions_url),
    ]);
    const recent = (recentQ.data ?? []).reverse();
    const ctx: Context = {
      minute: Math.floor(message.offset / 60),
      pitchMinute: a.event.cta_at_seconds === null ? null : Math.floor(a.event.cta_at_seconds / 60),
      name: reg.first_name,
      body: message.body,
      priorOwn: (ownQ.data ?? []).reverse().map((m) => String(m.body)),
      modReplies: (toThemQ.data ?? []).reverse().map((m) => String(m.body)),
      said: (saidQ.data ?? []).reverse().map((r) => String(r.text)),
      recent: recent.slice(-25).map((m) => `[${m.role === "attendee" ? "attendee" : m.author_name === KAITLYN ? "Kaitlyn" : "team"}] ${m.author_name}: ${String(m.body).slice(0, 160)}`),
      market: marketLine(message.body, ((marketsQ.data ?? []) as MarketCount[])),
      katherine: a.katherine && asksForReplay(message.body),
      onScreen: onScreen(cues, a.event.chapters ?? [], message.offset, a.event.video_seconds ?? null, Number(a.event.captions_offset_seconds ?? 0) || 0),
    };
    // Autopilot: with nobody on the desk, shadow and assisted act as auto for this message; her unsure lines still wait (SPEC-kaitlyn-autopilot.md, C).
    const auto = engaged(autopilot, seen, a.message.sessionMinute ?? ctx.minute, Date.now());
    const eff: Mode = auto && mode !== "auto" ? "auto" : mode;
    // Before the pitch nobody hears about the call (SPEC-friday-unattended.md, C): parseDecision swaps a price reply for a "later" shape and silences any other reply that says "call".
    const beforePitch = ctx.pitchMinute !== null && ctx.minute < ctx.pitchMinute;
    const out = await decide(systemPrompt(a.event.kaitlyn_facts, (kbQ.data ?? []) as KbRow[], (fixQ.data ?? []) as Correction[], a.event.outline ?? null, (ghostQ.data ?? []) as Ghost[]), userTurn(ctx), { beforePitch, pick: message.id });
    if (!out) return;
    const d = { ...out.decision, text: withoutMention(out.decision.text, reg.first_name) };
    // The roll-call guard (SPEC-kaitlyn-ghosts.md, D): a bare city or state in the first five minutes is a skip whatever the model drafted, so assisted never answers the roll-call; a skip is never a card.
    if (d.action === "reply" && d.category === "market" && isRollCallDrop(message.body, message.offset, a.event.cta_at_seconds ?? null)) Object.assign(d, { action: "skip" as const, text: "", react: "", kb: null, sure: false, why: `roll-call; ${d.why}`.slice(0, 140) });
    // A line to another attendee ("@iPhone $$?") is theirs, not hers (William's grade, Oct 22): a skip whatever the model drafted.
    if (d.action !== "skip" && isAsideToAttendee(message.body)) Object.assign(d, { action: "skip" as const, text: "", react: "", kb: null, sure: false, why: `aside to another attendee; ${d.why}`.slice(0, 140) });
    if (d.kb) await touchKb(reg.event_id, d.kb);
    const itself = postsItself(eff, d);
    // Shadow keeps every actionable decision (a reaction included) for a moderator; the others act on the routine ones here.
    const pending = eff === "shadow" ? d.action !== "skip" || Boolean(d.react) : (d.action === "reply" && !itself) || d.action === "ask_william" || (d.action === "ghost" && !ghostsItself(eff, d));
    const row = await db().from("kaitlyn_decisions").insert({ event_id: reg.event_id, session_date: reg.session_date, message_id: message.id, registrant_id: reg.id, action: d.action, category: d.category, text: d.text, react: d.react, why: d.why, status: pending ? "pending" : "skipped", decided_at: pending ? null : new Date().toISOString(), model: MODEL, ms: out.ms, kb_key: d.kb?.key ?? null, autopilot: auto }).select("id").single();
    if (row.error) { console.error("[kaitlyn] decision insert failed", { code: row.error.code }); return; }
    const did = row.data.id as number;
    if (reg.source !== "test") await autopilotTransition(reg, did, auto, autopilot);
    if (eff === "shadow") return;
    if (d.react) { await reactAsKaitlyn(message.id, d.react); await db().from("kaitlyn_decisions").update({ reacted_at: new Date().toISOString() }).eq("id", did); }
    if (pending) {
      if (reg.source !== "test") await postToChatChannel(`Kaitlyn needs you · ${reg.ghosted ? "(ghosted) " : ""}${reg.first_name}: ${JSON.stringify(message.body.slice(0, 200))} → ${d.action.replace("_", " ")}${d.text ? ` ${JSON.stringify(d.text)}` : ""} (${d.why})`);
      return;
    }
    if (d.action === "ghost") {
      // Someone already ghosted stays ghosted and nobody is told twice; the private line and the team's note below still happen.
      if (!reg.ghosted) {
        await db().from("registrants").update({ ghosted_at: new Date().toISOString(), auto_ghost_reason: `kaitlyn: ${d.why}`.slice(0, 200) }).eq("id", reg.id).is("ghosted_at", null);
        await db().from("chat_messages").update({ visibility: "author", updated_at: new Date().toISOString() }).eq("id", message.id);
      }
      await db().from("kaitlyn_decisions").update({ status: "ghosted", decided_at: new Date().toISOString() }).eq("id", did);
      if (reg.source !== "test" && !reg.ghosted) await postToChatChannel(`Kaitlyn ghosted ${reg.first_name}: ${JSON.stringify(message.body.slice(0, 200))} (${d.why}). Unghost on the desk if that was wrong.`);
      // The line they still get, private (postAsKaitlyn reads the ghost); a client complaint also reaches the team so someone follows up.
      if (d.text) {
        const body = `@${reg.first_name} ${d.text}`;
        const mid = await postAsKaitlyn(reg, body, message.offset, auto ? "autopilot" : "kaitlyn");
        if (mid) await db().from("kaitlyn_decisions").update({ sent_body: body, sent_message_id: mid }).eq("id", did);
      }
      if (d.category === "support" && reg.source !== "test") await postToIntel(`A client complaint in the room tonight, hidden from the chat and answered privately: ${reg.first_name}${reg.email ? ` (${reg.email})` : ""}: ${JSON.stringify(message.body.slice(0, 300))}. Someone should follow up tomorrow.`);
      return;
    }
    if (!itself) return;
    const t0 = Date.now();
    // The pause counts from their message, so the model's own thinking time (out.ms) comes off it.
    const wait = delayMs(eff, Math.random, d.text.length) - out.ms;
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    // Still hers to answer? A moderator may have replied meanwhile, or she replied to them a moment ago.
    const taken = await takenBy(reg, message.id, d.kb?.key ?? null);
    if (taken) {
      await db().from("kaitlyn_decisions").update({ status: "skipped", why: `${taken}; ${d.why}`.slice(0, 140), decided_at: new Date().toISOString() }).eq("id", did);
      return;
    }
    // The roll-call slot (D), checked after the pause so a burst of city drops lets the first one through and the rest see it: before the pitch, one market line per 10 s room-wide.
    if (d.category === "market" && ctx.pitchMinute !== null && ctx.minute < ctx.pitchMinute) {
      const last = await db().from("kaitlyn_decisions").select("decided_at").eq("event_id", reg.event_id).eq("session_date", reg.session_date).eq("category", "market").eq("status", "auto").order("id", { ascending: false }).limit(1).maybeSingle();
      if (!rollCallOpen(last.data?.decided_at ? new Date(last.data.decided_at as string).getTime() : null, Date.now())) {
        await db().from("kaitlyn_decisions").update({ status: "skipped", why: `roll-call slot taken; ${d.why}`.slice(0, 140), decided_at: new Date().toISOString() }).eq("id", did);
        return;
      }
    }
    // Auto hands back the moment a moderator is looking again: the line waits on the desk instead of posting.
    if (auto && autopilot === "auto" && mode !== "auto") {
      const back = await lastDeskSeen(reg.event_id, reg.session_date);
      if (back !== null && Date.now() - back < AUTOPILOT_AFTER_MS) {
        await db().from("kaitlyn_decisions").update({ status: "pending", decided_at: null, why: `a moderator is back; ${d.why}`.slice(0, 140) }).eq("id", did);
        return;
      }
    }
    const body = `@${reg.first_name} ${d.text}`;
    const mid = await postAsKaitlyn(reg, body, message.offset + (Date.now() - t0) / 1000, auto ? "autopilot" : "kaitlyn");
    if (mid) await db().from("kaitlyn_decisions").update({ status: "auto", sent_body: body, sent_message_id: mid, decided_at: new Date().toISOString() }).eq("id", did);
  } catch (err) {
    console.error("[kaitlyn] handle threw", { err: String(err) });
  }
}
