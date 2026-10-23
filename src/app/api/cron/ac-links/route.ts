import { db } from "@/lib/db";
import { linkSlot, sweepLine, sweepLinks } from "@/lib/ac-links";
import { postToIntel } from "@/lib/slack";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * The link sweep (SPEC-friday-unattended.md, E2): hourly at :20 (vercel.json); runs once in the 3 AM slot and once in the
 * 3 PM slot in the event's zone, so the 4 PM email never carries a blank WebinarJoinLink. `events.ac_links_slot` records
 * the slot (a failed run is retried the next hour); `events.ac_links_last` keeps the counts for the 9 AM digest. One Slack
 * line per run. `?dry=1` plans without writing or recording; `?force=1` ignores the slot.
 */
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const dry = params.get("dry") === "1";
  const force = params.get("force") === "1";
  const now = new Date();
  const ev = await db().from("events").select("id, timezone, ac_links_slot, ac_links_last").eq("slug", "ailg-r").maybeSingle();
  if (!ev.data) return Response.json({ error: "event not found" }, { status: 404 });
  const slot = linkSlot(now, (ev.data.timezone as string) || "America/Edmonton");
  const due = slot !== null && slot !== ev.data.ac_links_slot;
  if (!due && !dry && !force) return Response.json({ now: now.toISOString(), slot, due: false });
  try {
    const result = await sweepLinks({ apply: !dry, now });
    const line = sweepLine(result, slot);
    if (!dry) {
      // A run that hit the budget keeps the slot open, so the next hour continues; the previous run rides along for the 9 AM digest (both slots count).
      const last = (ev.data.ac_links_last ?? null) as { at?: string; written?: number; created?: number; pending?: number } | null;
      const prev = last?.at ? { at: last.at, written: last.written ?? 0, created: last.created ?? 0, pending: last.pending ?? 0 } : null;
      await db().from("events").update({ ...(result.truncated ? {} : { ac_links_slot: slot }), ac_links_last: { at: now.toISOString(), slot, ...result, sample: undefined, prev } }).eq("id", ev.data.id);
      await postToIntel(line);
    }
    return Response.json({ now: now.toISOString(), slot, due, dry, line, result });
  } catch (err) {
    console.error("[ac-links] sweep failed", { err: String(err) });
    if (!dry) await postToIntel(`Links: the sweep failed (${String(err).slice(0, 120)}); contacts without a personal link may get a blank promo. Next try in an hour.`);
    return Response.json({ now: now.toISOString(), slot, error: String(err) }, { status: 500 });
  }
}
