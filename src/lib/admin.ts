// Pure helpers behind the admin forms: parsing what a person types into what the tables store, and the
// reverse. Tested; the forms themselves are thin.

export type Chapter = { at: number; label: string };

/** "1:15:00 Offer and next steps" or "5:00 Who William is", one per line → sorted chapters. Bad lines are skipped. */
export function parseChapters(text: string): Chapter[] {
  const out: Chapter[] = [];
  for (const raw of text.split("\n")) {
    const m = /^\s*(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\s+(.+?)\s*$/.exec(raw);
    if (!m) continue;
    const at = (m[1] ? Number(m[1]) : 0) * 3600 + Number(m[2]) * 60 + Number(m[3]);
    out.push({ at, label: m[4].slice(0, 80) });
  }
  return out.sort((a, b) => a.at - b.at);
}

export function chaptersText(chapters: Chapter[]): string {
  return chapters
    .map((c) => {
      const h = Math.floor(c.at / 3600);
      const m = Math.floor((c.at % 3600) / 60);
      const s = c.at % 60;
      return `${h ? `${h}:${String(m).padStart(2, "0")}` : m}:${String(s).padStart(2, "0")} ${c.label}`;
    })
    .join("\n");
}

/** "1:15:00" | "75:00" | "4500" → seconds; null when it is none of those. */
export function parseSeconds(text: string): number | null {
  const t = text.trim();
  if (/^\d+$/.test(t)) return Number(t);
  const m = /^(?:(\d{1,2}):)?(\d{1,3}):(\d{2})$/.exec(t);
  if (!m) return null;
  return (m[1] ? Number(m[1]) : 0) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

export function secondsText(s: number | null): string {
  if (s === null) return "";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/** One name per line or comma-separated → trimmed, de-duplicated, order kept. */
export function parseNames(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of text.split(/[\n,]/)) {
    const t = n.trim();
    if (t && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}
