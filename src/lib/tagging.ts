// Tags the moment something happens (SPEC-analytics.md): registered, asked a question, clicked the offer, opened
// the replay. The hourly job still runs behind this for the outcomes that only make sense once the session has
// ended (attended, missed, left early, 40 minutes, saw offer no click), and as a safety net. Never throws.
import { activeCampaignConfigured, ensureContact, setLinks, tagContact } from "./activecampaign.ts";
import { db } from "./db.ts";

export type InstantOutcome = "registered" | "asked_question" | "clicked_offer" | "watched_replay";

export async function tagNow(registrantId: string, outcome: InstantOutcome): Promise<void> {
  if (!activeCampaignConfigured()) return;
  try {
    const { data: r } = await db().from("registrants").select("id, email, first_name, phone, source, token, event:events(tags)").eq("id", registrantId).maybeSingle();
    if (!r || !r.email || r.source === "test") return;
    const tags = ((r.event as unknown as { tags?: Record<string, string> } | null)?.tags ?? {}) as Record<string, string>;
    const tag = tags[outcome];
    if (!tag) return;
    const { data: have } = await db().from("outcome_tags").select("tag").eq("registrant_id", r.id).eq("tag", tag).maybeSingle();
    if (have) return;
    // The links ride with the registered tag (SPEC-friday-unattended.md, E1): every path writes them, seconds after the registration.
    if (outcome === "registered") await ensureContact(r.email, r.first_name, r.phone);
    const ok = await tagContact(r.email, tag);
    if (ok) await db().from("outcome_tags").upsert({ registrant_id: r.id, tag }, { onConflict: "registrant_id,tag", ignoreDuplicates: true });
    // After the tag, so a hung ActiveCampaign call never costs it; a miss here is the sweep's.
    if (outcome === "registered") await setLinks(r.email, String(r.token)).catch((err) => console.error("[tagging] links not written", { err: String(err) }));
  } catch (err) {
    console.error("[tagging] failed", { outcome, err: String(err) });
  }
}
