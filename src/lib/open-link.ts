// The open-link monitor (SPEC-phase7.md): did asking for an email instead of a name cost us people? One line a night,
// tonight's card → email → joined against the name-only nights before the switch, with a sample floor so a quiet
// night never cries wolf.
export type Funnel = { cards: number; submitted: number; joined: number };

export const SMALL_SAMPLE = 30;
export const ALARM_SHARE = 0.75;

export const pct = (x: number | null) => (x === null ? "–" : `${Math.round(x * 100)}%`);

export function openLinkVerdict(tonight: Funnel, baseline: Funnel): { rate: number | null; base: number | null; light: "🟢" | "🔴" | "⚪"; note: string } {
  const rate = tonight.cards > 0 ? tonight.submitted / tonight.cards : null;
  const base = baseline.cards > 0 ? baseline.submitted / baseline.cards : null;
  if (tonight.cards < SMALL_SAMPLE) return { rate, base, light: "⚪", note: `small sample, ${tonight.cards} cards` };
  if (base === null) return { rate, base, light: "⚪", note: "no name-only baseline yet" };
  if ((rate ?? 0) < ALARM_SHARE * base) return { rate, base, light: "🔴", note: `under ${Math.round(ALARM_SHARE * 100)}% of the name-only baseline: flip Settings → Open link back to a name` };
  return { rate, base, light: "🟢", note: "" };
}

export function openLinkLine(title: string, day: string, tonight: Funnel, baseline: Funnel, baselineNights: number): string {
  const v = openLinkVerdict(tonight, baseline);
  const base = v.base === null ? "no name-only baseline" : `name-only baseline ${pct(v.base)} over ${baselineNights} nights (${baseline.submitted} of ${baseline.cards})`;
  return `${v.light} Open link, ${title} ${day}: ${tonight.cards} cards → ${tonight.submitted} emails (${pct(v.rate)}) → ${tonight.joined} joined. ${base}.${v.note ? ` ${v.note}.` : ""}`;
}

/** YYYY-MM-DD shifted by whole days (dates only, no zones). */
export function shiftDay(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
