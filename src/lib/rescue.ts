// The post-pitch rescue (SPEC-bookings-recovery.md M4): people who click the offer and have not booked 15 minutes later
// get one Roezan text with the booking link (ActiveCampaign tag `ailgr_rescue` → automation "AILGR Rescue text") and a
// Katherine call; people who stayed to the pitch without clicking get a call the next evening (the second ring).
// In the last 14 days before Nov 4 2026, 136 of 157 clicks that booked did so within 15 minutes. Pure.

import { partsInTz } from "./tz.ts";

export const RESCUE_TAG = "ailgr_rescue";
export const RESCUE_AFTER_MS = 15 * 60_000;
/** The pitch lands about 75 minutes into the 7 pm Eastern session; texts go out from 8:15 to 10:45 pm Eastern. */
export const RESCUE_WINDOW_MIN = { from: 20 * 60 + 15, to: 22 * 60 + 45 } as const;
/** Live seconds into the session at which the offer is pitched (the classroom's "at the pitch" line). */
export const PITCH_OFFSET_S = 4500;

export type Clicker = { id: string; clickedAt: string; /** a booking at or after the click, by this row or the same email */ booked: boolean; blocked: boolean };

export function rescueReady(c: Clicker, nowMs: number): boolean {
  return !c.blocked && !c.booked && nowMs - Date.parse(c.clickedAt) >= RESCUE_AFTER_MS;
}

export function inRescueWindow(now: Date): boolean {
  const p = partsInTz(now, "America/New_York");
  const m = p.hour * 60 + p.minute;
  return m >= RESCUE_WINDOW_MIN.from && m <= RESCUE_WINDOW_MIN.to;
}

export type Attendee = { id: string; maxOffset: number; clicked: boolean; booked: boolean; blocked: boolean; registeredAt: string };

/** Stayed to the pitch, did not click, did not book, not blocked; newest registration first. */
export function secondRing<T extends Attendee>(rows: readonly T[]): T[] {
  return rows.filter((r) => r.maxOffset >= PITCH_OFFSET_S && !r.clicked && !r.booked && !r.blocked).sort((a, b) => b.registeredAt.localeCompare(a.registeredAt));
}
