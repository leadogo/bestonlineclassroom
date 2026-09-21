// Everything about turning an opt-in into a registrant that can be tested without a database: the token, the
// email identity, the attribution allowlist and the request validation (SPEC-registration-webhook.md).
import { createHash, randomBytes } from "node:crypto";

/** Base32 without look-alikes (no i, l, o, 0, 1): fine to read out loud, safe in a URL. */
export const TOKEN_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export const TOKEN_LENGTH = 12;
export const TOKEN_RE = /^[abcdefghjkmnpqrstuvwxyz23456789]{12}$/;

export function newToken(): string {
  const bytes = randomBytes(TOKEN_LENGTH);
  let out = "";
  for (let i = 0; i < TOKEN_LENGTH; i++) out += TOKEN_ALPHABET[bytes[i] % TOKEN_ALPHABET.length];
  return out;
}

/** SHA-256 hex of the trimmed, lowercased email: the same recipe as the site and leadogo. "" when empty. */
export function emailHash(email: string | null | undefined): string {
  const e = (email ?? "").trim().toLowerCase();
  return e ? createHash("sha256").update(e).digest("hex") : "";
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Trimmed and lowercased, or null when it is not an address. */
export function normalizeEmail(raw: unknown): string | null {
  const e = String(raw ?? "").trim().toLowerCase();
  return EMAIL_RE.test(e) && e.length <= 254 ? e : null;
}

/** The project's test identity (the site's rule): never counted, never numbered. */
export function isTestIdentity(email: string): boolean {
  return /-test-sample@thefuturerealestateagent\.com$/i.test(email);
}

export const ATTRIBUTION_KEYS = new Set([
  "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
  "referrer", "page_path", "session_id", "experiment_id", "variant", "fbclid", "gclid", "src",
]);
const MAX_VALUE = 200;

/** Only allowlisted keys, strings only, capped at 200 chars; anything else is dropped without complaint. */
export function cleanAttribution(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!ATTRIBUTION_KEYS.has(k) || typeof v !== "string" || !v.trim()) continue;
    out[k] = v.trim().slice(0, MAX_VALUE);
  }
  return out;
}

export type RegisterInput = {
  event: string;
  first_name: string;
  email: string;
  phone: string;
  session_date: string | null;
  registration_id: string | null;
  source: "site" | "zapier";
  attribution: Record<string, string>;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** The webhook body, validated. Errors are worded for the caller's logs, not for a visitor. */
export function parseRegisterBody(body: unknown): { ok: true; input: RegisterInput } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Body must be a JSON object." };
  const b = body as Record<string, unknown>;
  const event = String(b.event ?? "").trim();
  if (!/^[a-z0-9-]{1,40}$/.test(event)) return { ok: false, error: "event (slug) is required." };
  const first_name = String(b.first_name ?? "").trim().slice(0, 60);
  if (!first_name) return { ok: false, error: "first_name is required." };
  const email = normalizeEmail(b.email);
  if (!email) return { ok: false, error: "email is not a valid address." };
  const phone = String(b.phone ?? "").trim().slice(0, 32);
  const sd = String(b.session_date ?? "").trim();
  const rid = String(b.registration_id ?? "").trim();
  const source = b.source === "zapier" ? "zapier" : "site";
  return {
    ok: true,
    input: {
      event,
      first_name,
      email,
      phone,
      session_date: DATE_RE.test(sd) ? sd : null,
      registration_id: UUID_RE.test(rid) ? rid.toLowerCase() : null,
      source,
      attribution: cleanAttribution(b.attribution),
    },
  };
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://bestonlineclassroom.com";

export function joinUrl(token: string, base = APP_URL): string {
  return `${base.replace(/\/+$/, "")}/j/${token}`;
}
