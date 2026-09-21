// Tags in ActiveCampaign (SPEC-analytics.md): find the contact by email, find or create the tag, attach it.
// Same account and key as the site (Doppler). Best-effort and idempotent: ActiveCampaign ignores a repeat.
const BASE = (process.env.ACTIVECAMPAIGN_API_URL ?? "").replace(/\/$/, "");
const KEY = process.env.ACTIVECAMPAIGN_API_KEY ?? "";

export function activeCampaignConfigured(): boolean {
  return Boolean(BASE && KEY);
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T | null> {
  const res = await fetch(`${BASE}/api/3${path}`, { ...init, headers: { "Api-Token": KEY, "content-type": "application/json", ...(init.headers ?? {}) }, signal: AbortSignal.timeout(10_000) });
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

export async function contactId(email: string): Promise<string | null> {
  const r = await api<{ contacts: Array<{ id: string }> }>(`/contacts?email=${encodeURIComponent(email)}`);
  return r?.contacts[0]?.id ?? null;
}

/** true when the tag is on the contact afterwards (already there counts). */
export async function tagContact(email: string, tag: string): Promise<boolean> {
  if (!activeCampaignConfigured()) return false;
  const [cid, tid] = await Promise.all([contactId(email), tagId(tag)]);
  if (!cid || !tid) return false;
  const r = await api<{ contactTag?: { id: string } }>("/contactTags", { method: "POST", body: JSON.stringify({ contactTag: { contact: cid, tag: tid } }) });
  return Boolean(r?.contactTag) || r === null; // a repeat returns 422/null: the tag is there
}
