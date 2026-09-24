// Which tags a registrant's outcomes earn (SPEC-analytics.md), the same nine EasyWebinar sent. Pure, tested.
// "registered" goes as soon as the contact exists; "attended" (15 min or more live) and "missed" are decided once
// the session has ended; "watched_replay" can arrive days later.

export type Outcome = {
  registered: boolean;
  attended: boolean;
  missed: boolean;
  watched_replay: boolean;
  left_early: boolean;
  stayed_40min: boolean;
  asked_question: boolean;
  clicked_offer: boolean;
  saw_offer_no_click: boolean;
};

export const OUTCOME_KEYS = ["registered", "attended", "missed", "watched_replay", "left_early", "stayed_40min", "asked_question", "clicked_offer", "saw_offer_no_click"] as const;

export type TagNames = Record<string, string>;

/** The tag names this registrant should carry, given the outcomes and the event's tag names; `sessionOver` gates attended/missed/left_early. */
export function tagsFor(o: Outcome, names: TagNames, sessionOver: boolean): string[] {
  const out: string[] = [];
  const add = (k: keyof Outcome) => {
    const name = names[k];
    if (o[k] && name) out.push(name);
  };
  if (sessionOver) {
    add("attended");
    add("missed");
    add("left_early");
    add("stayed_40min");
    add("saw_offer_no_click");
  }
  add("registered");
  add("watched_replay");
  add("asked_question");
  add("clicked_offer");
  return out;
}

/** Retention: of those who joined live, the share still present at each 10-minute mark (by furthest offset seen). */
export function retentionCurve(maxOffsets: number[], videoSeconds: number, stepSeconds = 600): Array<{ at: number; share: number }> {
  const n = maxOffsets.length;
  const out: Array<{ at: number; share: number }> = [];
  for (let at = 0; at <= videoSeconds; at += stepSeconds) {
    const present = maxOffsets.filter((m) => m >= at).length;
    out.push({ at, share: n ? present / n : 0 });
  }
  return out;
}

/** The most people in the room at once: intervals [from, to] in ms, sampled every `stepMs`. */
/** Heartbeats land every 15 s or so; a person is still there for this long after their last one (William, Sep 23: every counter uses the same rule). */
export const PRESENCE_GRACE_MS = 120_000;

/** How many intervals cover the instant `at`, each extended by the grace. */
export function concurrentAt(intervals: Array<{ from: number; to: number }>, at: number, graceMs = PRESENCE_GRACE_MS): number {
  let n = 0;
  for (const i of intervals) if (i.from <= at && at <= i.to + graceMs) n++;
  return n;
}

export function peakConcurrent(intervals: Array<{ from: number; to: number }>, stepMs = 15_000, graceMs = PRESENCE_GRACE_MS): number {
  if (intervals.length === 0) return 0;
  const start = Math.min(...intervals.map((i) => i.from));
  const end = Math.max(...intervals.map((i) => i.to)) + graceMs;
  let peak = 0;
  for (let t = start; t <= end; t += stepMs) {
    const n = concurrentAt(intervals, t, graceMs);
    if (n > peak) peak = n;
  }
  return peak;
}
