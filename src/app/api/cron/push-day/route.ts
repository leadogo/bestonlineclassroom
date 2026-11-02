import { db, pageAll } from "@/lib/db";
import { INTEL_CHANNEL, postNotice } from "@/lib/slack";
import { pushNotice, type PushEmailDelta } from "@/lib/notices";
import { activeCampaignConfigured, addTag, api } from "@/lib/activecampaign";
import { GROUP_TAGS, GROUPS, HOLD_DAYS, HOT_DAILY_CAP, HOT_TAGS, PUSH_TODAY_TAG, REENGAGEMENT_AUTOMATION, easternDate, groupFor, isPushMinute, pickHot, pickToday, smallestGroup } from "@/lib/push-day";

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
    const url = `/contacts?${query}&limit=100&offset=${offset}`;
    const page = (await api<Page>(url)) ?? (await api<Page>(url));
    if (!page) throw new Error(`ActiveCampaign list failed: ${query} @${offset}`);
    ids.push(...page.contacts.map((c) => c.id));
    if (page.contacts.length < 100) return ids;
  }
}

async function inAutomation(automation: string): Promise<Set<string>> {
  const ids = new Set<string>();
  for (let offset = 0; ; offset += 100) {
    const url = `/contactAutomations?filters[seriesid]=${automation}&limit=100&offset=${offset}`;
    const page = (await api<AutomationPage>(url)) ?? (await api<AutomationPage>(url));
    if (!page) throw new Error(`ActiveCampaign automation ${automation} list failed @${offset}`);
    for (const r of page.contactAutomations) if (r.status === "1") ids.add(r.contact);
    if (page.contactAutomations.length < 100) return ids;
  }
}

/**
 * The daily push (src/lib/push-day.ts): Mon–Thu at 5:50 pm Eastern, today's group (minus re-engagement and the hold) and the hot track (SPEC-daily-push.md M1) get
 * `push_today`, which starts automation 199.
 * `?dry=1` counts and tags nothing; `?force=1` ignores the minute guard; `?group=N` previews another group on a dry run only.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!activeCampaignConfigured()) return Response.json({ error: "ActiveCampaign not configured" }, { status: 500 });
  const q = new URL(request.url).searchParams;
  const dry = q.get("dry") === "1";
  const force = q.get("force") === "1";
  const now = new Date();
  const { date } = easternDate(now);
  const forced = Number(q.get("group"));
  // `?group=N` previews another group; it never pushes one out of turn.
  const group = dry && forced >= 1 && forced <= GROUPS ? forced : groupFor(date);
  if (!group) return Response.json({ skipped: "not a push day", date });
  if (!force && !dry && !isPushMinute(now)) return Response.json({ skipped: "not the push minute", eastern: easternDate(now) });
  if (!dry) {
    // Claim the day before any tag lands: a second invocation (a retry, a manual run) hits the primary key and stops.
    const claim = await db().from("push_runs").insert({ push_date: date, group_no: group, tagged: 0, skipped_reengagement: 0, skipped_hold: 0, assigned_new: 0, failed: 0 });
    if (claim.error?.code === "23505") return Response.json({ skipped: "already pushed today", date });
    if (claim.error) throw new Error(`push_runs claim failed: ${claim.error.message}`);
  }
  const state = { logged: false };
  try {
    return await run(date, group, dry, state);
  } catch (e) {
    // Before the push log is written nothing can have been tagged, so the day goes back (a ?force=1 rerun can push it).
    // From that write on, the claim stays whatever fails, so the day is never pushed twice.
    if (!dry && !state.logged) await db().from("push_runs").delete().eq("push_date", date);
    throw e;
  }
}

/** Stop queuing tags here: the function dies at 300 s, and a tag that never ran is better than a run cut off mid-write. */
const DEADLINE_MS = 270_000;

async function run(date: string, group: number, dry: boolean, state: { logged: boolean }): Promise<Response> {
  const started = Date.now();

  // Every read at once: the ActiveCampaign client paces all callers to its 5-a-second limit, so running them side by
  // side keeps the whole run near that limit instead of waiting on each call's latency (500 tags one by one ran past 300 s).
  // Group membership is read bare (who already has a group) and again with status=1 (who is still subscribed and
  // gets pushed). Newcomers are NOT assigned from segment 1972 here: through the API the segment intermittently returns
  // the whole account (dry runs Nov 2: 40,000+ "newcomers"), which would scatter every contact into the groups.
  // ponytail: newcomers wait for a checked assignment step; the hot track's graduates still join groups here.
  const [allMembers, members, reengagement, attended, watched40, booked, clients, log] = await Promise.all([
    Promise.all(GROUP_TAGS.map((tag) => allContacts(`tagid=${tag}`))),
    Promise.all(GROUP_TAGS.map((tag) => allContacts(`tagid=${tag}&status=1`))),
    inAutomation(REENGAGEMENT_AUTOMATION),
    allContacts(`tagid=${HOT_TAGS.attended}&status=1`),
    allContacts(`tagid=${HOT_TAGS.watched40}&status=1`).then((ids) => new Set(ids)),
    allContacts(`tagid=${HOT_TAGS.booked}`).then((ids) => new Set(ids)),
    allContacts(`tagid=${HOT_TAGS.client}`).then((ids) => new Set(ids)),
    pageAll<{ contact_id: string; push_date: string; track: string }>((from, to) => db().from("push_log").select("contact_id, push_date, track").gte("push_date", shiftDays(date, -60)).lt("push_date", date).order("push_date").order("contact_id").range(from, to)),
  ]);

  const grouped = new Set(allMembers.flat());
  const sizes = allMembers.map((m) => m.length);
  const joins: Array<[string, number]> = [];

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
  const pushIds = [...pick.push, ...hotPush];
  if (dry) {
    tagged = pushIds.length;
    assignedNew = joins.length;
  } else {
    // Log every push BEFORE tagging: if the run dies mid-way, the hold and the hot history still know who may have
    // been emailed, so nobody gets a second "first" invite. A tag that then fails is counted, never retried today.
    const rows = [...pick.push.map((contact_id) => ({ contact_id, push_date: date, group_no: group, track: "group" })), ...hotPush.map((contact_id) => ({ contact_id, push_date: date, group_no: 0, track: "hot" }))];
    state.logged = true;
    for (let i = 0; i < rows.length; i += 500) {
      const w = await db().from("push_log").upsert(rows.slice(i, i + 500));
      if (w.error) throw new Error(`push_log write failed before tagging: ${w.error.message}`);
    }
    // Pushes first, then group joins; a few workers keep the client's 5-a-second pace busy, and each checks the
    // deadline before its next call so the run ends inside 300 s with its summary written.
    const jobs: Array<{ kind: "push" | "join"; id: string; tag: string }> = [...pushIds.map((id) => ({ kind: "push" as const, id, tag: PUSH_TODAY_TAG })), ...joins.map(([id, g]) => ({ kind: "join" as const, id, tag: GROUP_TAGS[g - 1] }))];
    let next = 0;
    await Promise.all(Array.from({ length: 6 }, async () => {
      while (next < jobs.length) {
        const job = jobs[next++];
        const ok = Date.now() - started < DEADLINE_MS && (await addTag(job.id, job.tag).catch(() => false));
        if (job.kind === "join") assignedNew += ok ? 1 : 0;
        else if (ok) tagged++;
        else failed++;
      }
    }));
  }

  const camp = await api<{ campaign: { send_amt: string; uniqueopens: string; unsubscribes: string } }>(`/campaigns/${EMAIL_1}`).catch(() => null);
  const stats = camp ? { sent: Number(camp.campaign.send_amt), opens: Number(camp.campaign.uniqueopens), unsubs: Number(camp.campaign.unsubscribes) } : null;
  const last = await db().from("push_runs").select("email_stats").lt("push_date", date).order("push_date", { ascending: false }).limit(1).maybeSingle();
  const before = last.data?.email_stats as PushEmailDelta | null | undefined;
  const previous = stats && before ? { sent: stats.sent - before.sent, opens: stats.opens - before.opens, unsubs: stats.unsubs - before.unsubs } : null;

  if (!dry) {
    await db().from("push_runs").update({ tagged, skipped_reengagement: pick.skippedReengagement, skipped_hold: pick.skippedHold, assigned_new: assignedNew, failed, email_stats: stats, hot_first: hot.first.length, hot_second: hot.second.length, hot_graduated: hot.graduate.length }).eq("push_date", date);
  }
  const result = { date, group, dry, tagged, failed, skippedReengagement: pick.skippedReengagement, skippedHold: pick.skippedHold, assignedNew, previous, hot: { first: hot.first.length, second: hot.second.length, graduated: hot.graduate.length } };
  await postNotice(INTEL_CHANNEL, pushNotice(result)).catch(() => {});
  return Response.json(result);
}
