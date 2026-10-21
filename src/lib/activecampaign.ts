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

async function api<T>(path: string, init: RequestInit = {}, retried = false): Promise<T | null> {
  await paced();
  const res = await fetch(`${BASE}/api/3${path}`, { ...init, headers: { "Api-Token": KEY, "content-type": "application/json", ...(init.headers ?? {}) }, signal: AbortSignal.timeout(10_000) });
  if (res.status === 429 && !retried) {
    await new Promise((r) => setTimeout(r, 1500));
    return api<T>(path, init, true);
  }
  if (!res.ok) {
    if (res.status !== 404 && res.status !== 422) console.error("[activecampaign]", path, res.status);
    return null;
  }
  return (await res.json()) as T;
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
  const r = await api<{ contactTag?: { id: string } }>("/contactTags", { method: "POST", body: JSON.stringify({ contactTag: { contact: cid, tag: tid } }) });
  return Boolean(r?.contactTag) || r === null; // a repeat returns 422/null: the tag is there
}
