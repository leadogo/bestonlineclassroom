import { db } from "@/lib/db";
import { INTEL_CHANNEL, postNotice } from "@/lib/slack";
import { pushNotice, type PushEmailDelta } from "@/lib/notices";
import { activeCampaignConfigured, addTag, api } from "@/lib/activecampaign";
import { ELIGIBLE_SEGMENT, GROUP_TAGS, GROUPS, HOLD_DAYS, PUSH_TODAY_TAG, REENGAGEMENT_AUTOMATION, easternDate, groupFor, isPushMinute, pickToday, smallestGroup } from "@/lib/push-day";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Email 1 of the push (campaign 6239): its running counters, kept per run so the next run reports the difference. */
const EMAIL_1 = "6239";

type Page = { contacts: Array<{ id: string }> };
type AutomationPage = { contactAutomations: Array<{ contact: string; status: string }> };

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
 * smallest one, then today's group (minus re-engagement and the hold) gets `push_today`, which starts automation 199.
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
    const done = await db().from("push_runs").select("push_date").eq("push_date", date).maybeSingle();
    if (done.data) return Response.json({ skipped: "already pushed today", date });
  }

  // Groups as they stand, then newcomers to the smallest.
  const members = await Promise.all(GROUP_TAGS.map((tag) => allContacts(`tagid=${tag}`)));
  const grouped = new Set(members.flat());
  const sizes = members.map((m) => m.length);
  let assignedNew = 0;
  for (const id of await allContacts(`segmentid=${ELIGIBLE_SEGMENT}`)) {
    if (grouped.has(id)) continue;
    const g = smallestGroup(sizes);
    if (!dry && !(await addTag(id, GROUP_TAGS[g - 1]))) continue;
    sizes[g - 1]++;
    members[g - 1].push(id);
    assignedNew++;
  }

  const since = new Date(Date.parse(`${date}T12:00:00Z`) - HOLD_DAYS * 86_400_000).toISOString().slice(0, 10);
  const recent = await db().from("push_log").select("contact_id").gt("push_date", since).lt("push_date", date);
  if (recent.error) throw recent.error;
  const pick = pickToday(members[group - 1], await inAutomation(REENGAGEMENT_AUTOMATION), new Set((recent.data ?? []).map((r) => r.contact_id as string)));

  let tagged = 0;
  let failed = 0;
  if (dry) tagged = pick.push.length;
  else {
    for (const id of pick.push) {
      if (await addTag(id, PUSH_TODAY_TAG)) tagged++;
      else failed++;
    }
  }

  const camp = await api<{ campaign: { send_amt: string; uniqueopens: string; unsubscribes: string } }>(`/campaigns/${EMAIL_1}`);
  const stats = camp ? { sent: Number(camp.campaign.send_amt), opens: Number(camp.campaign.uniqueopens), unsubs: Number(camp.campaign.unsubscribes) } : null;
  const last = await db().from("push_runs").select("email_stats").lt("push_date", date).order("push_date", { ascending: false }).limit(1).maybeSingle();
  const before = last.data?.email_stats as PushEmailDelta | null | undefined;
  const previous = stats && before ? { sent: stats.sent - before.sent, opens: stats.opens - before.opens, unsubs: stats.unsubs - before.unsubs } : null;

  if (!dry) {
    const rows = pick.push.map((contact_id) => ({ contact_id, push_date: date, group_no: group }));
    for (let i = 0; i < rows.length; i += 500) await db().from("push_log").upsert(rows.slice(i, i + 500));
    await db().from("push_runs").insert({ push_date: date, group_no: group, tagged, skipped_reengagement: pick.skippedReengagement, skipped_hold: pick.skippedHold, assigned_new: assignedNew, failed, email_stats: stats });
  }
  const result = { date, group, dry, tagged, failed, skippedReengagement: pick.skippedReengagement, skippedHold: pick.skippedHold, assignedNew, previous };
  await postNotice(INTEL_CHANNEL, pushNotice(result)).catch(() => {});
  return Response.json(result);
}
