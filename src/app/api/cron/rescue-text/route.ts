import { db } from "@/lib/db";
import { getEvent } from "@/lib/events";
import { activeCampaignConfigured, tagContact } from "@/lib/activecampaign";
import { easternDate } from "@/lib/push-day";
import { RESCUE_TAG, inRescueWindow, rescueReady } from "@/lib/rescue";
import { loadRescueLists } from "@/lib/rescue-data";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * The rescue text (SPEC-bookings-recovery.md M4): every 5 minutes, 8:15–10:45 pm Eastern, tonight's offer clickers with
 * no booking 15 minutes after the click get the ActiveCampaign tag `ailgr_rescue`, which starts the "AILGR Rescue text"
 * automation (one Roezan text with the booking link). One per registrant per session: the `rescue_texts` row is
 * claimed before the tag, and given back if the tag fails so the next run retries. `?dry=1` lists and tags nothing;
 * `?force=1` ignores the window; `?date=` reads another session (dry runs only).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const q = new URL(request.url).searchParams;
  const dry = q.get("dry") === "1";
  const now = new Date();
  if (!dry && q.get("force") !== "1" && !inRescueWindow(now)) return Response.json({ skipped: "outside 8:15–10:45 pm Eastern", eastern: easternDate(now) });
  const date = dry && /^\d{4}-\d{2}-\d{2}$/.test(q.get("date") ?? "") ? (q.get("date") as string) : easternDate(now).date;
  const event = await getEvent("ailg-r");
  if (!event) return Response.json({ error: "Event not found" }, { status: 500 });
  if (!dry && !activeCampaignConfigured()) return Response.json({ error: "ActiveCampaign not configured" }, { status: 500 });

  const lists = await loadRescueLists(event.id, date);
  const ready = lists.rescue.filter((r) => r.email && rescueReady(r, now.getTime()));
  const done = await db().from("rescue_texts").select("registrant_id").eq("session_date", date);
  if (done.error) throw done.error;
  const texted = new Set((done.data ?? []).map((r) => r.registrant_id as string));
  const due = ready.filter((r) => !texted.has(r.id));
  if (dry) return Response.json({ date, dry, clicked: lists.rescue.length, ready: ready.length, alreadyTexted: ready.length - due.length, wouldText: due.map((r) => ({ id: r.id, first_name: r.first_name, clicked_at: r.clicked_at })) });

  let tagged = 0, failed = 0;
  for (const r of due) {
    const claim = await db().from("rescue_texts").insert({ registrant_id: r.id, session_date: date });
    if (claim.error) continue; // another run has it
    if (await tagContact(r.email as string, RESCUE_TAG).catch(() => false)) tagged++;
    else {
      failed++;
      await db().from("rescue_texts").delete().eq("registrant_id", r.id).eq("session_date", date);
    }
  }
  return Response.json({ date, clicked: lists.rescue.length, ready: ready.length, tagged, failed });
}
