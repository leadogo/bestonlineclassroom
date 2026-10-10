// What the chat refuses before it is stored (William, 2026-09-20 late): links of any kind, swearing, and the
// usual scam and spam lines. Kept pure so it is tested. The person gets a short, friendly reason.
const LINK = /(https?:\/\/|www\.|[a-z0-9-]+\.(com|net|org|io|co|ca|us|info|biz|ly|me|app|xyz|club|site|online|shop)\b|\bt\.me\b|\bwa\.me\b|bit\.ly)/i;
const PROFANITY = /\b(fuck\w*|f+u+c+k+|shit\w*|bitch\w*|ass|asses|arse\w*|asshole\w*|jackass|dumbass|bastard|cunt\w*|dick\w*|pussy|cock\w*|piss\w*|motherfuck\w*|nigg\w*|fag\w*|retard\w*|whore\w*|slut\w*|damn|goddamn|wtf|stfu|bs)\b/i;
const SCAM = /\b(crypto|bitcoin|btc|forex|binary options?|guaranteed (returns?|profit|income)|investment (opportunity|plan|group)|dm me|text me|whats ?app|telegram|cash ?app|venmo|paypal|earn \$?\d|make \$?\d|per (day|week) (from|working)|work from home|passive income|free money|giveaway|airdrop|nft|escort|onlyfans|sex\b|porn)\b/i;
const REPEAT = /(.)\1{9,}/;

export type FilterVerdict = { ok: true } | { ok: false; reason: string; kind: "link" | "profanity" | "scam" | "spam" };

export function checkMessage(body: string): FilterVerdict {
  const text = body.trim();
  // Emails are fine (people ask for help); the link rule looks at what is left once they are removed.
  if (LINK.test(text.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, ""))) return { ok: false, kind: "link", reason: "Links can't be shared in the chat." };
  if (PROFANITY.test(text)) return { ok: false, kind: "profanity", reason: "Let's keep the chat friendly. Please reword that." };
  if (SCAM.test(text)) return { ok: false, kind: "scam", reason: "That message isn't allowed here." };
  if (REPEAT.test(text) || text.length > 0 && text === text.toUpperCase() && text.replace(/[^A-Z]/g, "").length > 40) return { ok: false, kind: "spam", reason: "Please write that normally so everyone can read it." };
  return { ok: true };
}

/** A first name the room can show: no swearing, no links, no scam words. Null when it must be refused. */
export function cleanName(name: string): string | null {
  const n = name.trim().replace(/\s+/g, " ").slice(0, 40);
  if (!n) return null;
  if (LINK.test(n) || PROFANITY.test(n) || SCAM.test(n)) return null;
  return n;
}

// Saying out loud that the room is a recording (William, Oct 9 2026): "this is a recording", "yes it's a replay",
// "it's not live". He ghosts these by hand within a minute, every time, so the chat does it on the spot. A question
// ("is this a recording?", "will there be a replay?") is allowed, and so is a hope ("I hope this is recorded").
const SAID = (s: string) => s.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9?\s]/g, " ").replace(/\s+/g, " ").trim();
const CLAIM = /\b(?:(?:this|it|that|he|she|william|these|those|they|the (?:video|webinar|call|presentation|session|class|comments|chat|whole thing|questions))\s+(?:is|was|are|were|has to be|must be|seems|looks|sounds|appears|isnt|is not|aint|wasnt|are not|arent)|its|thats|hes|shes|theyre)(?:\s+(?:just|clearly|obviously|already|definitely|totally|all|so|only|a|an|not|also|still|probably|likely|100|percent|again|another|the|same|one|ai|like|literally))*\s+(?:pre ?recorded|recorded|recording|replay|re ?run|taped|fake)\b/;
const NOT_LIVE = /\b(?:not|isnt|aint|never|wasnt|is no)\s+(?:even\s+|actually\s+|really\s+|a\s+)?live\b/;
const BARE = /^(?:pre ?recorded|re ?run|taped)$/;
const AGREE = /^(?:yes|yeah|yep|yup|ya|yea|yas+|lol|lmao|haha+|correct|exactly|right|obviously|definitely|100|of course|told you|i know|same|agreed|true|yessir)\b.*\b(?:pre ?recorded|recorded|a recording|a replay|re ?run|taped|not live)\b/;
const QUESTION = /\?|^(?:is|are|was|were|does|do|did|will|can|could|would|should|has|have|if|any|anyone|how|what|when|where|why|who|which|wonder|curious)\b|\b(?:is|are|was|were|does|do|did|will|can|could|would|should)\s+(?:this|it|that|these|there|he|she|you|we|i|anyone|anybody)\b/;
const HOPE = /\b(?:hope|hoping|hopefully|wish|glad|if|whether|unless|assume|assuming|in case)\b/;
const REQUEST = /\b(?:please|pls|send|link|available|later|catch|miss|missed|watch|rewatch|get|want|need|love|like)\b/;

/** The message tells the room it is watching a recording. */
export function exposesRecording(body: string): boolean {
  const t = SAID(body);
  if (QUESTION.test(t)) return false;
  return (!HOPE.test(t) && (CLAIM.test(t) || NOT_LIVE.test(t) || BARE.test(t))) || (!REQUEST.test(t) && AGREE.test(t));
}
