// Stacy's instant DM relay: Meta's webhook for the Book More Showings Page and @willkabrall, turned into a small
// notice to Stacy's routine (she reads and answers through the Graph API with her own token). The relay never
// replies, never holds a Meta token, and stores ids only. Pure parts here, tested; delivery below.
import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "./db.ts";

/** Our own Page and Instagram account: anything they send is ours, not a person's. */
export const OWN_IDS = new Set(["104542139222761", "17841405344631477"]);

export type RelayEvent = { platform: "fb" | "ig"; sender_id: string; recipient_id: string; mid: string; text: string; timestamp: number; kind: "message" | "postback" | "comment" };

/** Meta signs the raw body with the app secret: `X-Hub-Signature-256: sha256=<hex>`. */
export function validSignature(raw: string, header: string | null, secret: string): boolean {
  if (!secret || !header?.startsWith("sha256=")) return false;
  const want = Buffer.from(createHmac("sha256", secret).update(raw).digest("hex"));
  const got = Buffer.from(header.slice(7));
  return got.length === want.length && timingSafeEqual(got, want);
}

type Obj = Record<string, unknown>;
const o = (v: unknown): Obj => (v && typeof v === "object" ? (v as Obj) : {});
const s = (v: unknown): string => (typeof v === "string" || typeof v === "number" ? String(v) : "");
const clip = (t: unknown) => s(t).slice(0, 500);

/** The person-sent messages, postbacks and new comments in one webhook body; echoes and our own sends skipped. */
export function parseEvents(body: unknown): RelayEvent[] {
  const b = o(body);
  const platform = b.object === "page" ? "fb" : b.object === "instagram" ? "ig" : null;
  if (!platform) return [];
  const out: RelayEvent[] = [];
  for (const entry of Array.isArray(b.entry) ? b.entry : []) {
    const e = o(entry);
    const entryTime = Number(e.time) || Date.now();
    for (const raw of Array.isArray(e.messaging) ? e.messaging : []) {
      const m = o(raw);
      const sender_id = s(o(m.sender).id);
      const recipient_id = s(o(m.recipient).id);
      if (!sender_id || OWN_IDS.has(sender_id)) continue;
      const timestamp = Number(m.timestamp) || entryTime;
      const msg = o(m.message);
      if (m.message && !msg.is_echo && s(msg.mid)) {
        const text = clip(msg.text) || (Array.isArray(msg.attachments) && msg.attachments.length ? `[${s(o(msg.attachments[0]).type) || "attachment"}]` : "");
        out.push({ platform, sender_id, recipient_id, mid: s(msg.mid), text, timestamp, kind: "message" });
      }
      const pb = o(m.postback);
      if (m.postback && s(pb.mid)) out.push({ platform, sender_id, recipient_id, mid: s(pb.mid), text: clip(pb.title || pb.payload), timestamp, kind: "postback" });
    }
    for (const raw of Array.isArray(e.changes) ? e.changes : []) {
      const c = o(raw);
      const v = o(c.value);
      // Instagram: field "comments" { id, text, from: { id } }. Page: field "feed" { item: "comment", verb: "add", comment_id, message, from: { id } }.
      const ig = c.field === "comments";
      const fb = c.field === "feed" && v.item === "comment" && v.verb === "add";
      if (!ig && !fb) continue;
      const sender_id = s(o(v.from).id);
      const mid = s(ig ? v.id : v.comment_id);
      if (!mid || !sender_id || OWN_IDS.has(sender_id)) continue;
      out.push({ platform, sender_id, recipient_id: s(e.id), mid, text: clip(ig ? v.text : v.message), timestamp: Number(v.created_time) ? Number(v.created_time) * 1000 : entryTime, kind: "comment" });
    }
  }
  return out;
}

/** Keeps the events whose id we have not seen in the last 24 h, recording them as received. */
export async function claimNew(events: RelayEvent[]): Promise<RelayEvent[]> {
  if (!events.length) return [];
  const since = new Date(Date.now() - 86_400_000).toISOString();
  // a row older than 24 h no longer blocks: clear those ids first so a re-sent id counts as new
  await db().from("social_relay_events").delete().in("mid", events.map((e) => e.mid)).lt("received_at", since);
  const { data, error } = await db().from("social_relay_events").upsert(events.map((e) => ({ mid: e.mid, platform: e.platform, kind: e.kind })), { onConflict: "mid", ignoreDuplicates: true }).select("mid");
  if (error) throw error;
  const fresh = new Set((data ?? []).map((r) => r.mid as string));
  return events.filter((e) => fresh.has(e.mid));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * One POST to Stacy's routine per webhook delivery, `{ events: [...] }` (Meta already groups bursts into one
 * delivery). Three tries with backoff; the outcome lands on each event's row for the health check.
 * ponytail: no cross-delivery batching; a 60 s window would need a queue, add one if Stacy's wake-ups get noisy.
 */
export async function forwardToStacy(events: RelayEvent[]): Promise<boolean> {
  const url = process.env.STACY_WEBHOOK_URL ?? "";
  const key = process.env.STACY_WEBHOOK_KEY ?? "";
  const mids = events.map((e) => e.mid);
  let error = url ? "" : "STACY_WEBHOOK_URL not set";
  for (let i = 0; url && i < 3; i++) {
    try {
      const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json", ...(key ? { authorization: `Bearer ${key}` } : {}) }, body: JSON.stringify({ events }), signal: AbortSignal.timeout(10_000) });
      if (res.ok) { error = ""; break; }
      error = `HTTP ${res.status}`;
    } catch (e) {
      error = e instanceof Error ? e.name : "fetch failed";
    }
    if (i < 2) await sleep(1000 * 3 ** i);
  }
  if (error) console.error("[meta-relay] forward failed", mids.length, error);
  await db().from("social_relay_events").update(error ? { error } : { forwarded_at: new Date().toISOString(), error: null }).in("mid", mids);
  return !error;
}

export async function relayHealth(): Promise<{ last_event_at: string | null; forwarded_24h: number; errors_24h: number; last_error: string | null }> {
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const last = await db().from("social_relay_events").select("received_at").order("received_at", { ascending: false }).limit(1).maybeSingle();
  const ok = await db().from("social_relay_events").select("mid", { count: "exact", head: true }).gte("received_at", since).not("forwarded_at", "is", null);
  const bad = await db().from("social_relay_events").select("error, received_at").gte("received_at", since).not("error", "is", null).order("received_at", { ascending: false });
  return { last_event_at: (last.data?.received_at as string) ?? null, forwarded_24h: ok.count ?? 0, errors_24h: bad.data?.length ?? 0, last_error: (bad.data?.[0]?.error as string) ?? null };
}
