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
