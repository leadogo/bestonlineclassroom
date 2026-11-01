// Clock agreement (SPEC-clock-agreement.md): once a day the canary asks every system that times the webinar when
// tonight's session starts and compares each answer with the events row. Pure comparisons here (tested); the canary
// route does the fetching. A system that cannot be reached is a warning, a system that disagrees is a failure.
import { partsInTz, zoned } from "./tz.ts";
import type { CanaryCheck } from "./notices.ts";

export type Reading = { system: string; start: Date | null; slots?: Date[]; error?: string };
export type AcTrigger = { automation: number; type: string; params: { time?: number | string; timezone?: string } };

const minutesOff = (a: Date, b: Date) => Math.round((a.getTime() - b.getTime()) / 60_000);
export const clockLabel = (d: Date, tz: string) => new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(d);

/** One check per system: agrees with the event's start to the minute, or says by how much it is off. */
export function clockChecks(start: Date, tz: string, readings: Reading[]): CanaryCheck[] {
  return readings.map((r) => {
    const name = `clock: ${r.system}`;
    if (r.error) return { name, ok: true, detail: `⚠ unreachable (${r.error}), not compared`, short: `${r.system} clock ?` };
    if (!r.start) return { name, ok: false, detail: "answered without a start time", short: `${r.system} clock` };
    const off = minutesOff(r.start, start);
    if (off !== 0) return { name, ok: false, detail: `says ${clockLabel(r.start, tz)}, ${Math.abs(off)} min ${off > 0 ? "late" : "early"} against the room's ${clockLabel(start, tz)}`, short: `${r.system} clock` };
    const late = (r.slots ?? []).filter((s) => s.getTime() >= start.getTime());
    if (late.length) return { name, ok: false, detail: `call slot(s) at or after the start: ${late.map((s) => clockLabel(s, tz)).join(", ")}`, short: `${r.system} clock` };
    const slots = r.slots?.length ? `, calls ${r.slots.map((s) => `${minutesOff(s, start)} min`).join(" / ")}` : "";
    return { name, ok: true, detail: `agrees: ${clockLabel(r.start, tz)}${slots}`, short: `${r.system} clock` };
  });
}

/** When an ActiveCampaign trigger fires on the session's date, from its own hour ("15" or "17:50") and its own zone. */
export function triggerInstant(date: string, t: AcTrigger): Date | null {
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = String(t.params.time ?? "").split(":").map(Number);
  if (!t.params.timezone || !Number.isFinite(h)) return null;
  return zoned(y, m, d, h, Number.isFinite(min) ? min : 0, t.params.timezone);
}

/**
 * ActiveCampaign: the account zone runs every "wait until the date field" step, so it must be the room's zone; each
 * start trigger must fire before the start (its reminders follow it); a trigger in another zone is a warning (it
 * drifts an hour at the next clock change).
 */
export function acChecks(start: Date, tz: string, date: string, accountZone: string | null, triggers: AcTrigger[]): CanaryCheck[] {
  const checks: CanaryCheck[] = [];
  checks.push(accountZone === null
    ? { name: "clock: ActiveCampaign zone", ok: true, detail: "⚠ account zone not readable", short: "AC zone ?" }
    : { name: "clock: ActiveCampaign zone", ok: accountZone === tz, detail: `account zone ${accountZone}${accountZone === tz ? "" : `, the room runs on ${tz}: every date-field wait step is off`}`, short: "AC zone" });
  const late: string[] = [];
  const drift: string[] = [];
  for (const t of triggers) {
    const at = triggerInstant(date, t);
    if (!at) continue;
    if (at.getTime() >= start.getTime()) late.push(`${t.automation} at ${clockLabel(at, tz)}`);
    if (t.params.timezone !== tz) drift.push(`${t.automation} (${t.params.timezone})`);
  }
  checks.push({
    name: "clock: ActiveCampaign triggers",
    ok: late.length === 0,
    detail: [late.length ? `fire at or after the start: ${late.join(", ")}` : `${triggers.length} triggers fire before the start`, drift.length ? `⚠ not on ${tz}: ${drift.join(", ")}` : ""].filter(Boolean).join("; "),
    short: "AC triggers",
  });
  return checks;
}

/** The site's /api/calendar: the first DTSTART (UTC form, 20261102T000000Z). */
export function icsStart(ics: string): Date | null {
  const m = /DTSTART:(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/.exec(ics);
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])) : null;
}

/** True when the zone name is one Intl knows (a typo in events.timezone breaks every page). */
export function isZone(tz: string): boolean {
  try {
    partsInTz(new Date(0), tz);
    return true;
  } catch {
    return false;
  }
}
