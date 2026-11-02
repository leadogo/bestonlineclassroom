import { db, pageAll } from "@/lib/db";
import { INTEL_CHANNEL, postNotice } from "@/lib/slack";
import { pushNotice, type PushEmailDelta } from "@/lib/notices";
import { activeCampaignConfigured, addTag, api } from "@/lib/activecampaign";
import { ELIGIBLE_SEGMENT, GROUP_TAGS, GROUPS, HOLD_DAYS, HOT_DAILY_CAP, HOT_TAGS, PUSH_TODAY_TAG, REENGAGEMENT_AUTOMATION, easternDate, groupFor, isPushMinute, pickHot, pickToday, smallestGroup } from "@/lib/push-day";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Email 1 of the push (campaign 6239): its running counters, kept per run so the next run reports the difference. */
const EMAIL_1 = "6239";

type Page = { contacts: Array<{ id: string }> };
type AutomationPage = { contactAutomations: Array<{ contact: string; status: string }> };

const shiftDays = (date: string, days: number) => new Date(Date.parse(`${date}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

async function allContacts(query: string): Promise<string[]> {
  const ids: string[] = [];
  for (let offset = 0; ; offset += 100) {
    const page = await api<Page>(`/contacts?${query}&limit=100&offset=${offset}`);
    if (!page) throw new Error(`ActiveCampaign list failed: ${query} @${offset}`);
    ids.push(...page.contacts.map((c) => c.id));
    if (page.contacts.length < 100) return ids;
  }
}

async function inAutomation(automation: string): Promise<Set<string>> {
  const ids = new Set<string>();
  for (let offset = 0; ; offset += 100) {
    const page = await api<AutomationPage>(`/contactAutomations?filters[seriesid]=${automation}&limit=100&offset=${offset}`);
    if (!page) throw new Error(`ActiveCampaign automation ${automation} list failed @${offset}`);
    for (const r of page.contactAutomations) if (r.status === "1") ids.add(r.contact);
    if (page.contactAutomations.length < 100) return ids;
  }
}

/**
 * The daily push (src/lib/push-day.ts): Mon–Thu at 5:50 pm Eastern, contacts who qualify and have no group join the
 * smallest one, then today's group (minus re-engagement and the hold) and the hot track (SPEC-daily-push.md M1) get
 * `push_today`, which starts automation 199.
 * `?dry=1` counts and tags nothing; `?force=1` ignores the minute guard; `?group=N` pushes another group.
 */
export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!activeCampaignConfigured()) return Response.json({ error: "ActiveCampaign not configured" }, { status: 500 });
  const q = new URL(request.url).searchParams;
  const dry = q.get("dry") === "1";
  const force = q.get("force") === "1";
  const now = new Date();
  const { date } = easternDate(now);
  const forced = Number(q.get("group"));
  const group = forced >= 1 && forced <= GROUPS ? forced : groupFor(date);
  if (!group) return Response.json({ skipped: "not a push day", date });
  if (!force && !dry && !isPushMinute(now)) return Response.json({ skipped: "not the push minute", eastern: easternDate(now) });
  if (!dry) {
    // Claim the day before any tag lands: a second invocation (a retry, a manual run) hits the primary key and stops.
    const claim = await db().from("push_runs").insert({ push_date: date, group_no: group, tagged: 0, skipped_reengagement: 0, skipped_hold: 0, assigned_new: 0, failed: 0 });
    if (claim.error) return Response.json({ skipped: "already pushed today", date, detail: claim.error.message });
  }

  // Every read at once: the ActiveCampaign client paces all callers to its 5-a-second limit, so running them side by
  // side keeps the whole run near that limit instead of waiting on each call's latency (500 tags one by one ran past 300 s).
  const [members, eligible, reengagement, attended, watched40, booked, clients, log] = await Promise.all([
    Promise.all(GROUP_TAGS.map((tag) => allContacts(`tagid=${tag}`))),
    allContacts(`segmentid=${ELIGIBLE_SEGMENT}`),
    inAutomation(REENGAGEMENT_AUTOMATION),
    allContacts(`tagid=${HOT_TAGS.attended}`),
    allContacts(`tagid=${HOT_TAGS.watched40}`).then((ids) => new Set(ids)),
    allContacts(`tagid=${HOT_TAGS.booked}`).then((ids) => new Set(ids)),
    allContacts(`tagid=${HOT_TAGS.client}`).then((ids) => new Set(ids)),
    pageAll<{ contact_id: string; push_date: string; track: string }>((from, to) => db().from("push_log").select("contact_id, push_date, track").gte("push_date", shiftDays(date, -60)).lt("push_date", date).order("push_date").range(from, to)),
  ]);

  // Newcomers to the smallest group.
  const grouped = new Set(members.flat());
  const sizes = members.map((m) => m.length);
  const joins: Array<[string, number]> = [];
  for (const id of eligible) {
    if (grouped.has(id)) continue;
    const g = smallestGroup(sizes);
    sizes[g - 1]++;
    members[g - 1].push(id);
    grouped.add(id);
    joins.push([id, g]);
  }

  // Push history: the 13-day hold for groups, every hot push, and each contact's latest push.
  const since = shiftDays(date, -HOLD_DAYS);
  const recent = new Set<string>();
  const hotHistory = new Map<string, string[]>();
  const lastAny = new Map<string, string>();
  for (const r of log) {
    if (r.push_date > since) recent.add(r.contact_id);
    if (r.track === "hot") hotHistory.set(r.contact_id, [...(hotHistory.get(r.contact_id) ?? []), r.push_date]);
    lastAny.set(r.contact_id, r.push_date);
  }
  const pick = pickToday(members[group - 1], reengagement, recent);

  // Hot track: attended, never booked, not a client, in no group.
  const candidates = attended.filter((id) => !booked.has(id) && !clients.has(id) && !grouped.has(id)).map((id) => ({ id, watched40: watched40.has(id) }));
  const hot = pickHot(candidates, hotHistory, reengagement, lastAny, date, HOT_DAILY_CAP);
  for (const id of hot.graduate) {
    const g = smallestGroup(sizes);
    sizes[g - 1]++;
    joins.push([id, g]);
  }
  const hotPush = [...hot.first, ...hot.second].filter((id) => !pick.push.includes(id));

  let tagged = 0;
  let failed = 0;
  let assignedNew = 0;
  if (dry) {
    tagged = pick.push.length + hotPush.length;
    assignedNew = joins.length;
  } else {
    const results = await Promise.all([
      ...joins.map(([id, g]) => addTag(id, GROUP_TAGS[g - 1]).then((ok) => ({ kind: "join" as const, ok }))),
      ...[...pick.push, ...hotPush].map((id) => addTag(id, PUSH_TODAY_TAG).then((ok) => ({ kind: "push" as const, ok }))),
    ]);
    for (const r of results) {
      if (r.kind === "join") assignedNew += r.ok ? 1 : 0;
      else if (r.ok) tagged++;
      else failed++;
    }
  }

  const camp = await api<{ campaign: { send_amt: string; uniqueopens: string; unsubscribes: string } }>(`/campaigns/${EMAIL_1}`);
  const stats = camp ? { sent: Number(camp.campaign.send_amt), opens: Number(camp.campaign.uniqueopens), unsubs: Number(camp.campaign.unsubscribes) } : null;
  const last = await db().from("push_runs").select("email_stats").lt("push_date", date).order("push_date", { ascending: false }).limit(1).maybeSingle();
  const before = last.data?.email_stats as PushEmailDelta | null | undefined;
  const previous = stats && before ? { sent: stats.sent - before.sent, opens: stats.opens - before.opens, unsubs: stats.unsubs - before.unsubs } : null;

  if (!dry) {
    const rows = [...pick.push.map((contact_id) => ({ contact_id, push_date: date, group_no: group, track: "group" })), ...hotPush.map((contact_id) => ({ contact_id, push_date: date, group_no: 0, track: "hot" }))];
    for (let i = 0; i < rows.length; i += 500) {
      const w = await db().from("push_log").upsert(rows.slice(i, i + 500));
      if (w.error) console.error("[push-day] push_log write failed; the hold will miss these", w.error.message);
    }
    await db().from("push_runs").update({ tagged, skipped_reengagement: pick.skippedReengagement, skipped_hold: pick.skippedHold, assigned_new: assignedNew, failed, email_stats: stats, hot_first: hot.first.length, hot_second: hot.second.length, hot_graduated: hot.graduate.length }).eq("push_date", date);
  }
  const result = { date, group, dry, tagged, failed, skippedReengagement: pick.skippedReengagement, skippedHold: pick.skippedHold, assignedNew, previous, hot: { first: hot.first.length, second: hot.second.length, graduated: hot.graduate.length } };
  await postNotice(INTEL_CHANNEL, pushNotice(result)).catch(() => {});
  return Response.json(result);
}
