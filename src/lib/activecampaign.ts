// Tags in ActiveCampaign (SPEC-analytics.md): find the contact by email, find or create the tag, attach it.
// Same account and key as the site (Doppler). Best-effort and idempotent: ActiveCampaign ignores a repeat.
const BASE = (process.env.ACTIVECAMPAIGN_API_URL ?? "").replace(/\/$/, "");
const KEY = process.env.ACTIVECAMPAIGN_API_KEY ?? "";

export function activeCampaignConfigured(): boolean {
  return Boolean(BASE && KEY);
}

/** ActiveCampaign allows 5 requests a second per account: calls are paced at least this far apart (one module clock, so concurrent callers queue), and a 429 is retried once after a breath (SPEC-post-session.md, A). */
const PACE_MS = 210;
let nextSlot = 0;
async function paced(): Promise<void> {
  const now = Date.now();
  const at = Math.max(now, nextSlot);
  nextSlot = at + PACE_MS;
  if (at > now) await new Promise((r) => setTimeout(r, at - now));
}

/** One call: the status and the parsed body (null when not OK). A 429 is retried once after a breath that also holds every other caller on this instance. */
async function apiRaw<T>(path: string, init: RequestInit = {}, retried = false): Promise<{ status: number; body: T | null }> {
  await paced();
  const res = await fetch(`${BASE}/api/3${path}`, { ...init, headers: { "Api-Token": KEY, "content-type": "application/json", ...(init.headers ?? {}) }, signal: AbortSignal.timeout(10_000) });
  if (res.status === 429 && !retried) {
    nextSlot = Date.now() + 1500;
    await new Promise((r) => setTimeout(r, 1500));
    return apiRaw<T>(path, init, true);
  }
  if (!res.ok) {
    if (res.status !== 404 && res.status !== 422) console.error("[activecampaign]", path, res.status);
    return { status: res.status, body: null };
  }
  return { status: res.status, body: (await res.json()) as T };
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T | null> {
  return (await apiRaw<T>(path, init)).body;
}

const tagIds = new Map<string, string>();

/** The tag's id, created if it does not exist. */
export async function tagId(name: string): Promise<string | null> {
  const hit = tagIds.get(name);
  if (hit) return hit;
  const found = await api<{ tags: Array<{ id: string; tag: string }> }>(`/tags?search=${encodeURIComponent(name)}`);
  let id = found?.tags.find((t) => t.tag === name)?.id ?? null;
  if (!id) {
    const made = await api<{ tag: { id: string } }>("/tags", { method: "POST", body: JSON.stringify({ tag: { tag: name, tagType: "contact", description: "bestonlineclassroom" } }) });
    id = made?.tag.id ?? null;
  }
  if (id) tagIds.set(name, id);
  return id;
}

/** Creates or updates the contact so a tag can land even before the Zap has made it. */
export async function ensureContact(email: string, firstName: string, phone: string | null): Promise<string | null> {
  const r = await api<{ contact: { id: string } }>("/contact/sync", { method: "POST", body: JSON.stringify({ contact: { email, firstName, ...(phone ? { phone } : {}) } }) });
  return r?.contact.id ?? null;
}

export async function contactId(email: string): Promise<string | null> {
  const r = await api<{ contacts: Array<{ id: string }> }>(`/contacts?email=${encodeURIComponent(email)}`);
  return r?.contacts[0]?.id ?? null;
}

/** true when the tag is on the contact afterwards (already there counts). */
export async function tagContact(email: string, tag: string): Promise<boolean> {
  if (!activeCampaignConfigured()) return false;
  const [cid, tid] = await Promise.all([contactId(email), tagId(tag)]);
  if (!cid || !tid) return false;
  return addTag(cid, tid);
}

/** Attaches a tag by ids (the outcome push looks the contact up once per email and reuses it). true when the tag is on the contact afterwards. */
export async function addTag(cid: string, tid: string): Promise<boolean> {
  if (!activeCampaignConfigured()) return false;
  const r = await apiRaw<{ contactTag?: { id: string } }>("/contactTags", { method: "POST", body: JSON.stringify({ contactTag: { contact: cid, tag: tid } }) });
  // A repeat answers 422: the tag is there. Any other failure (a second 429, a 5xx, a timeout) is not a landed tag.
  return Boolean(r.body?.contactTag) || r.status === 422;
}

/** The personal watch link's shape and the two fields that hold it (SPEC-friday-unattended.md, E1; `watch.` is the texting domain, SPEC-show-rate-recovery.md). */
export const WATCH = "https://watch.bookmoreshowings.com";
export const PERSONAL_RE = /^https:\/\/watch\.bookmoreshowings\.com\/[abcdefghjkmnpqrstuvwxyz23456789]{12}$/;
export const JOIN_FIELD = "47";
export const REPLAY_FIELD = "49";
/** `ailgr_registered`: the tag every registered contact carries; the sweep's scope. */
export const REGISTERED_TAG_ID = "304";
export const watchLinks = (token: string) => ({ join: `${WATCH}/${token}`, replay: `${WATCH}/replay/${token}` });

/** One paced call for the sweep (the body, or null when the call failed). */
export const acApi = api;

/** Writes the room's two links onto the contact (SPEC-friday-unattended.md, E1) unless the join field already holds a personal link. Called on the `registered` tag from every path (site, Skool, Zapier, guest, the door), so the field no longer depends on the site's Zap, which missed one new contact in five in the week of Oct 20. true when both links are there afterwards. */
export async function setLinks(email: string, token: string): Promise<boolean> {
  if (!activeCampaignConfigured()) return false;
  const cid = await contactId(email);
  if (!cid) return false;
  const have = (await api<{ fieldValues: Array<{ id: string; field: string; value: string }> }>(`/contacts/${cid}/fieldValues`))?.fieldValues ?? [];
  if (have.some((f) => f.field === JOIN_FIELD && PERSONAL_RE.test(f.value))) return true;
  const links = watchLinks(token);
  let ok = true;
  // The join field last: it is the "done" marker, so a failed replay write is retried by the sweep.
  for (const [field, value] of [[REPLAY_FIELD, links.replay], [JOIN_FIELD, links.join]] as const) {
    const existing = have.find((f) => f.field === field);
    const body = JSON.stringify({ fieldValue: { contact: cid, field, value } });
    const r = existing ? await api(`/fieldValues/${existing.id}`, { method: "PUT", body }) : await api("/fieldValues", { method: "POST", body });
    if (!r) ok = false;
  }
  return ok;
}
