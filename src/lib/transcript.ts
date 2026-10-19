// What William is saying on screen (SPEC-kaitlyn-transcript.md, A): the recording's transcript is the room's captions
// VTT (`events.captions_url`), and every chat line carries the second of the video the person was at. This windows
// the transcript around that second (what he just said, what he says next) and names the chapter they are in.
// Pure functions plus one cached fetch; a missing or failing transcript means no block, never an error.
import { parseVtt } from "./captions.ts";

export type Cue = { start: number; end: number; text: string };
export type OnScreen = { said: string; next: string; segment: string | null };
/** How far back and ahead the window reaches, in seconds. */
export const BACK_S = 90;
export const AHEAD_S = 120;

const one = (s: string) => s.replace(/\s+/g, " ").trim();

/** The cues that cover the last `back` seconds up to `offset` (a cue spanning the moment is in; one ending exactly at the edge is out), and the ones starting in the next `ahead` seconds. */
export function windowAt(cues: Cue[], offset: number, back = BACK_S, ahead = AHEAD_S): { said: string; next: string } {
  return {
    said: one(cues.filter((c) => c.end > offset - back && c.start <= offset).map((c) => c.text).join(" ")),
    next: one(cues.filter((c) => c.start > offset && c.start <= offset + ahead).map((c) => c.text).join(" ")),
  };
}

/** The chapter the second falls in: the last one starting at or before it; null when there are none. */
export function segmentAt(chapters: Array<{ at: number; label: string }>, offset: number): string | null {
  let hit: { at: number; label: string } | null = null;
  for (const c of chapters) if (c.at <= offset && (!hit || c.at >= hit.at)) hit = c;
  return hit?.label ?? null;
}

/** The block's data for one message: null when there is no transcript. `shift` is the event's captions offset (the room shows cue time + shift, so cue time is video time - shift). */
export function onScreen(cues: Cue[], chapters: Array<{ at: number; label: string }>, offset: number, videoSeconds: number | null, shift = 0): OnScreen | null {
  if (!cues.length) return null;
  const w = windowAt(cues, offset - shift);
  const label = segmentAt(chapters, offset);
  const minute = Math.floor(offset / 60);
  return { ...w, segment: label ? `${label} (minute ${minute}${videoSeconds ? ` of ${Math.floor(videoSeconds / 60)}` : ""})` : null };
}

/** One fetch per transcript per function instance, kept an hour; a failure is kept five minutes so a bad night does not hammer the store. */
const TTL_MS = 3_600_000;
const FAIL_TTL_MS = 300_000;
const cache = new Map<string, { until: number; cues: Cue[] }>();

export async function cuesFor(url: string | null | undefined, fetcher: typeof fetch = fetch): Promise<Cue[]> {
  if (!url) return [];
  const hit = cache.get(url);
  if (hit && Date.now() < hit.until) return hit.cues;
  try {
    const res = await fetcher(url, { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const cues = parseVtt(await res.text());
    cache.set(url, { until: Date.now() + TTL_MS, cues });
    return cues;
  } catch (err) {
    console.error("[transcript] fetch failed", { err: String(err) });
    cache.set(url, { until: Date.now() + FAIL_TTL_MS, cues: [] });
    return [];
  }
}

/** For tests. */
export function forgetTranscripts(): void {
  cache.clear();
}
