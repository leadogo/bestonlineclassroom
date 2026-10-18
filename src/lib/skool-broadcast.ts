// The Wednesday and Sunday Skool broadcast: which post goes out today, and whether this minute is the moment.
// Pure. Copy by Jeremy (Oct 18 2026), William's register. The link is the room's open door on the texting domain.

export const SKOOL_GROUP = "bms-agent-accelerator";
export const BROADCAST_LINK = "https://watch.bookmoreshowings.com/w/ailg-r?src=skool";
export const BROADCAST_HOUR = 16; // 4:58 pm Mountain, two minutes before the 5 pm session
export const BROADCAST_MINUTE = 58;
export const CATEGORY = "Announcements";


export type Broadcast = { weekday: "wednesday" | "sunday"; title: string; body: string };

export const BROADCASTS: Record<Broadcast["weekday"], Broadcast> = {
  // The post and its email land at 4:58 pm Mountain, two minutes before the doors: doors-open-now framing (Jeremy,
  // Oct 18, second pass). One siren, never a row of them: Skool members are past registrants, not cold traffic.
  wednesday: {
    weekday: "wednesday",
    title: "🚨 Doors open in two minutes",
    body:
      "The workshop doors are open right now. It starts at 7 pm Eastern, 5 Mountain, 4 Pacific. You will see the system agents use to turn leads into booked showings. The door asks for a name or email, that is how the room holds your seat. If you cannot stay the whole way, the replay stays up for 72 hours.\n\n" +
      `Here is the door: ${BROADCAST_LINK}\n\nCome in now.`,
  },
  sunday: {
    weekday: "sunday",
    title: "🚨 How many leads did you waste last month?",
    body:
      "Quick question: how many of the leads you paid for last month turned into appointments? If the honest answer is low, the workshop running right now fixes exactly that. Doors are open. It starts at 7 pm Eastern, 5 Mountain, 4 Pacific. The door asks for a name or email so the room can hold your seat. The replay stays up for 72 hours if tonight does not work.\n\n" +
      `Door: ${BROADCAST_LINK}\n\nCome in.`,
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
