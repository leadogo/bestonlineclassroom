// The Wednesday and Sunday Skool broadcast: which post goes out today, and whether this minute is the moment.
// Pure. Copy by Jeremy (Oct 18 2026), William's register. The link is the room's open door on the texting domain.

export const SKOOL_GROUP = "bms-agent-accelerator";
export const BROADCAST_LINK = "https://watch.bookmoreshowings.com/w/ailg-r?src=skool";
export const BROADCAST_HOUR = 16; // 4:58 pm Mountain, two minutes before the 5 pm session
export const BROADCAST_MINUTE = 58;
export const CATEGORY = "Announcements";

/** Jeremy's proof figures (600+ agents, 270 markets, 7,000 appointments) are his draft; flip when William confirms them. */
export const PROOF_CONFIRMED = false;

export type Broadcast = { weekday: "wednesday" | "sunday"; title: string; body: string };

const WEDNESDAY_PROOF = "600+ agents across 270 markets have been through this system and it has booked over 7,000 appointments. ";

export const BROADCASTS: Record<Broadcast["weekday"], Broadcast> = {
  wednesday: {
    weekday: "wednesday",
    title: PROOF_CONFIRMED ? "600+ agents, one system, tonight at 7 Eastern" : "One booking system, tonight at 7 Eastern",
    body:
      "Quick one for you. The Book More Showings workshop runs today at 7 pm Eastern, 5 Mountain, 4 Pacific. It runs about two hours and twenty minutes. " +
      (PROOF_CONFIRMED ? WEDNESDAY_PROOF : "") +
      "If you registered before and did not make it in, tonight is a clean restart. You will drop a name or email at the door, that is how the room holds your seat. Replay stays up for 72 hours after.\n\n" +
      `Here is the door: ${BROADCAST_LINK}\n\nSee you at 7.`,
  },
  sunday: {
    weekday: "sunday",
    title: "What happened to the leads you already paid for?",
    body:
      "Question for you: how many of the leads you already paid for turned into appointments last month? If the honest answer is low, that is the exact problem this workshop solves. It starts today at 7 pm Eastern, 5 Mountain, 4 Pacific, and runs about two hours and twenty minutes. You will see the full booking system agents use to turn leads into showings, and the replay stays up for 72 hours if tonight does not work. Drop a name or email at the door and you are in.\n\n" +
      `Door is here: ${BROADCAST_LINK}`,
  },
};

const TZ = "America/Edmonton";

export function mountainParts(now: Date): { weekday: number; hour: number; minute: number; date: string } {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { weekday, hour: Number(get("hour")) % 24, minute: Number(get("minute")), date: `${get("year")}-${get("month")}-${get("day")}` };
}

/** Today's broadcast in Mountain time, or null on the other five days. */
export function pickBroadcast(now: Date): Broadcast | null {
  const { weekday } = mountainParts(now);
  if (weekday === 3) return BROADCASTS.wednesday;
  if (weekday === 0) return BROADCASTS.sunday;
  return null;
}

/** The cron fires at 22:58 and 23:58 UTC; only the run that lands at 16:5x Mountain posts. */
export function isBroadcastMinute(now: Date): boolean {
  const { hour, minute } = mountainParts(now);
  return hour === BROADCAST_HOUR && minute >= BROADCAST_MINUTE - 3 && minute <= BROADCAST_MINUTE + 4;
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
