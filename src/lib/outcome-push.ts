// The outcome tags to ActiveCampaign, planned and pushed under a time budget (SPEC-post-session.md, A). Oct 20's 770
// registrants left about 2,700 tags; two unpaced requests per tag met the 5-a-second limit and every run died at 300 s.
// Now: newest session first, the session-end tags (they fire the replay and follow-up automations) before the rest, one
// contact lookup per email per run, and the run returns when the budget is spent; the next run continues.
import { addTag, contactId, tagId } from "./activecampaign.ts";
import { scheduleOf, sessionFor } from "./daily-schedule.ts";
import { db } from "./db.ts";
import { tagsFor, type Outcome, type TagNames } from "./outcomes.ts";

export const PUSH_BUDGET_MS = 240_000;
export const SESSION_END_KEYS = ["attended", "missed", "left_early", "stayed_40min", "saw_offer_no_click"] as const;

export type Planned = { registrant_id: string; email: string; tag: string; session_date: string; end: boolean };

/** Newest session first, session-end tags before the rest; the given order otherwise (sort is stable). */
export function orderTags(items: Planned[]): Planned[] {
  return [...items].sort((a, b) => (a.session_date < b.session_date ? 1 : a.session_date > b.session_date ? -1 : Number(b.end) - Number(a.end)));
}

/** Every tag still owed for the sessions of the last 8 days, in push order. The dry run's list and the digest's owed count. */
export async function planOutcomeTags(now = Date.now()): Promise<Planned[]> {
  const since = new Date(now - 8 * 86_400_000).toISOString().slice(0, 10);
  const { data: events } = await db().from("events").select("*");
  const out: Planned[] = [];
  for (const e of (events ?? []) as Array<{ id: string; timezone: string; start_time: string; video_seconds: number | null; days?: number[] | null; tags?: TagNames | null }>) {
    const names = (e.tags ?? {}) as TagNames;
    const endNames = new Set(SESSION_END_KEYS.map((k) => names[k]).filter((n): n is string => Boolean(n)));
    const { data: rows } = await db().from("registrant_outcomes").select("*").eq("event_id", e.id).gte("session_date", since).neq("source", "test").not("email", "is", null);
    const ids = (rows ?? []).map((r) => r.registrant_id as string);
    const have = new Set<string>();
    for (let i = 0; i < ids.length; i += 500) {
      const { data: done } = await db().from("outcome_tags").select("registrant_id, tag").in("registrant_id", ids.slice(i, i + 500));
      for (const d of done ?? []) have.add(`${d.registrant_id}:${d.tag}`);
    }
    for (const r of rows ?? []) {
      const session = sessionFor(scheduleOf(e), r.session_date as string);
      const over = Boolean(session && now >= session.end.getTime() + 30 * 60_000);
      for (const tag of tagsFor(r as unknown as Outcome, names, over)) {
        if (have.has(`${r.registrant_id}:${tag}`)) continue;
        out.push({ registrant_id: r.registrant_id as string, email: r.email as string, tag, session_date: r.session_date as string, end: endNames.has(tag) });
      }
    }
  }
  return orderTags(out);
}

/** Whether another tag fits: the budget counts from the run's start. */
export function withinBudget(startedMs: number, nowMs: number, budgetMs = PUSH_BUDGET_MS): boolean {
  return nowMs - startedMs < budgetMs;
}

/** Pushes in plan order until the budget is spent. A tag that lands is recorded in `outcome_tags` so it is never sent twice; one that cannot (no such contact) stays owed. */
export async function pushOutcomeTags(opts: { budgetMs?: number } = {}): Promise<{ sent: number; failed: number; owed: number }> {
  const t0 = Date.now();
  const plan = await planOutcomeTags(t0);
  const cids = new Map<string, string | null>();
  let sent = 0, failed = 0, i = 0;
  for (; i < plan.length && withinBudget(t0, Date.now(), opts.budgetMs); i++) {
    const p = plan[i];
    let cid = cids.get(p.email);
    if (cid === undefined) { cid = await contactId(p.email); cids.set(p.email, cid); }
    const tid = await tagId(p.tag);
    if (cid && tid && (await addTag(cid, tid))) {
      await db().from("outcome_tags").insert({ registrant_id: p.registrant_id, tag: p.tag });
      sent += 1;
    } else failed += 1;
  }
  return { sent, failed, owed: plan.length - i };
}
