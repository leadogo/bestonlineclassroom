// Market answers on the desk (William, Oct 8 2026): after the pitch the video asks "what market are you in?" and
// thirty replies land in five minutes. Kevin answers each with the Client Directory's count for that market. These
// helpers find the market a message names and draft the reply in his own words; the moderator clicks, edits, sends.
// The counts are the directory's own (every client ever linked to the market, churned included), pushed every
// 30 minutes with the client wall. Nothing here claims buyer or seller availability — the data does not know it.

export type MarketCount = { name: string; clients: number; live: number };

/** "Calgary, AB" → "Calgary". */
export function placeOf(name: string): string {
  return name.split(",")[0].trim();
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

/** Markets whose place name appears whole in the text; longest place first, then the busiest. Empty when none. */
export function findMarkets(text: string, markets: MarketCount[]): MarketCount[] {
  const t = ` ${norm(text)} `;
  if (t.trim().length < 3) return [];
  return markets
    .filter((m) => {
      const p = norm(placeOf(m.name));
      return p.length >= 3 && t.includes(` ${p} `);
    })
    .sort((a, b) => norm(placeOf(b.name)).length - norm(placeOf(a.name)).length || b.clients - a.clients);
}

const ASK = /\b(market|area|county|region|territory|how many|agents? (in|here|there)|anyone in|anybody in)\b/i;

/** The message reads like a market question even when no market name matched (a county, a suburb, a state). */
export function asksMarket(text: string): boolean {
  return ASK.test(text);
}

// Kevin's own lines from Sep 29–Oct 8, number and place swapped; {N} is the count, {X} the place.
const BANK: Array<[number, string[]]> = [
  [100, ["we got tons in {X}! over {N}, but no saturation experienced as of yet", "over {N} in {X} and still no saturation so youre good"]],
  [30, ["about {A} in {X} area, we have markets with over 50+ and its fine", "weve got {N} in {X}, no saturation experienced as of yet so youre good"]],
  [10, ["weve got {N} in {X}, youre good", "{N} there! youre good", "we have {N} in {X}, just confirm on the call what you want to run and youll be good"]],
  [2, ["weve got {N} in {X} youre good", "{N} in {X} so youre good", "we've got {N} in {X}", "just {N} in {X} so youre good"]],
  [1, ["just 1 in {X} so youre good", "1 there so youre good", "only 1 in {X}"]],
  [0, ["none in {X} yet so youre good", "we dont have anyone in {X} yet so youre good"]],
];

/** The reply body (no @mention) for a market and its directory count. `pick` chooses the variant; random by default. */
export function marketDraft(name: string, clients: number, pick: () => number = Math.random): string {
  const [, lines] = BANK.find(([min]) => clients >= min) ?? BANK[BANK.length - 1];
  const line = lines[Math.min(lines.length - 1, Math.floor(pick() * lines.length))];
  const over = clients >= 100 ? Math.floor(clients / 50) * 50 : clients;
  const about = Math.round(clients / 5) * 5;
  return line.replace("{N}", String(over)).replace("{A}", String(about)).replace(/\{X\}/g, placeOf(name));
}

/** What the desk types when a market question matched nothing in the directory. */
export const NO_MATCH_DRAFT = "none there yet so youre good";

export const MIN_MARKETS = 50;

/** The sync's market summary, cleaned: a name, two whole counts; blanks and duplicates dropped. */
export function normalizeMarkets(raw: unknown): MarketCount[] {
  if (!Array.isArray(raw)) return [];
  const out = new Map<string, MarketCount>();
  for (const r of raw as Array<Record<string, unknown>>) {
    const name = String(r?.name ?? "").trim().slice(0, 80);
    if (!name) continue;
    const n = (v: unknown) => Math.max(0, Math.floor(Number(v) || 0));
    out.set(name, { name, clients: n(r.clients), live: n(r.live) });
  }
  return [...out.values()];
}
