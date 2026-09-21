// The query parameters a room link may carry through to attendance and the CTA: ad attribution and the channel,
// never identity (`eh`, `rid`, `at`, `key` are read by the pages and dropped here). Pure, so it is tested.

export const PARAM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "src", "fbclid", "gclid", "ref"] as const;
const MAX = 200;

export function cleanParams(sp: Record<string, string | string[] | undefined> | URLSearchParams): Record<string, string> {
  const out: Record<string, string> = {};
  const get = (k: string) => (sp instanceof URLSearchParams ? sp.get(k) : Array.isArray(sp[k]) ? (sp[k] as string[])[0] : sp[k]);
  for (const k of PARAM_KEYS) {
    const v = get(k);
    if (typeof v === "string" && v.trim()) out[k] = v.trim().slice(0, MAX);
  }
  return out;
}

/** `?a=1&b=2` or "" */
export function toQuery(params: Record<string, string>): string {
  const q = new URLSearchParams(params).toString();
  return q ? `?${q}` : "";
}

/** Appends fields to a URL that may already have a query; empty values are skipped. */
export function withQuery(base: string, fields: Record<string, string | null | undefined>): string {
  const url = new URL(base);
  for (const [k, v] of Object.entries(fields)) if (v) url.searchParams.set(k, v);
  return url.toString();
}
