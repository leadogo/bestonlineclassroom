// The simulated chat file as EasyWebinar exports it: header `HH:MM:SS,Name,Role,Message`, one message a row,
// timestamps like `0:00:33` or `1:14:20` (or `mm:ss`). Quoted fields may hold commas, newlines and doubled
// quotes. Everything here is pure so the parser is tested against strings, not files.

export type SimulatedRow = { offset_seconds: number; name: string; body: string };

/** "1:14:20" → 4460, "0:00:33" → 33, "12:05" → 725. Null for anything else. */
export function parseTimestamp(s: string): number | null {
  const m = /^\s*(?:(\d{1,3}):)?(\d{1,2}):(\d{2})\s*$/.exec(s);
  if (!m) return null;
  const h = m[1] ? Number(m[1]) : 0;
  return h * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

/** RFC 4180 rows, tolerant of CRLF, a BOM and a trailing newline. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') { quoted = true; continue; }
    if (c === ",") { row.push(field); field = ""; continue; }
    if (c === "\r") continue;
    if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; continue; }
    field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((f) => f.trim().length));
}

/** The rows the room plays, ordered by offset; header matched by name, case-insensitive; blank messages dropped. */
export function parseChatCsv(text: string): SimulatedRow[] {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (names: string[]) => header.findIndex((h) => names.includes(h));
  const iTime = col(["hh:mm:ss", "time", "timestamp", "offset"]);
  const iName = col(["name", "attendee", "user"]);
  const iBody = col(["message", "text", "body"]);
  if (iTime < 0 || iName < 0 || iBody < 0) throw new Error(`CSV header must have a time, name and message column; got: ${rows[0].join(",")}`);
  const out: SimulatedRow[] = [];
  for (const r of rows.slice(1)) {
    const offset = parseTimestamp(r[iTime] ?? "");
    const name = (r[iName] ?? "").trim();
    const body = (r[iBody] ?? "").trim();
    if (offset === null || !name || !body) continue;
    out.push({ offset_seconds: offset, name, body });
  }
  return out.sort((a, b) => a.offset_seconds - b.offset_seconds);
}

/** Distinct names in order of first appearance: the simulated attendee list. */
export function distinctNames(rows: SimulatedRow[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of rows) if (!seen.has(r.name)) { seen.add(r.name); out.push(r.name); }
  return out;
}
