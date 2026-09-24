// The crowd the People tab shows (phase 5.3, Jeremy's curve): everyone until 5 minutes in, 85% by 15 minutes, 80% at
// the pitch, 60% at 1:45, 40% at the end, straight lines between, on the session's own timeline (a short test session
// follows the same shape). Names roll off the end of the list. Behind events.people_curve_enabled.

export function crowdShare(offset: number, pitchAt: number | null, seconds: number): number {
  if (seconds <= 0) return 1;
  const t = Math.min(1, Math.max(0, offset / seconds));
  const pitch = pitchAt !== null && pitchAt > 0 && pitchAt < seconds ? pitchAt / seconds : 0.54;
  const pts = ([[0, 1], [0.06, 1], [0.11, 0.85], [pitch, 0.8], [0.75, 0.6], [1, 0.4]] as Array<[number, number]>).sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    if (t <= x1) return x1 === x0 ? Math.min(y0, y1) : y0 + ((t - x0) / (x1 - x0)) * (y1 - y0);
  }
  return 0.4;
}

/**
 * The waiting number on the join card (William, Sep 23): starts at `floor` fifteen minutes out and climbs toward the
 * crowd the room shows at the start (host plus every crowd name), real openers on top, and is never allowed above
 * that crowd. The room adds the real people and the moderators on top of the same crowd, so what they see on
 * entering is always at least one more than the last number they waited behind.
 */
export function waitingCount(progress: number, crowd: number, realOpeners: number, floor = 90): number {
  const p = Math.min(1, Math.max(0, progress));
  const base = Math.min(floor, crowd);
  const climb = Math.round(base + (crowd - base) * Math.pow(p, 1.2));
  return Math.max(0, Math.min(crowd, climb + Math.max(0, realOpeners)));
}

export function crowdNames(names: string[], share: number): string[] {
  return names.slice(0, Math.round(names.length * Math.min(1, Math.max(0, share))));
}
