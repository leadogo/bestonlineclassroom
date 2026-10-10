// Market answers on the desk (William, Oct 8 2026): after the pitch the video asks "what market are you in?" and
// thirty replies land in five minutes. Kevin answers each with the Client Directory's count for that market. These
// helpers find the market a message names and draft the reply in his own words; the moderator clicks, edits, sends.
// The counts are the directory's own (every client ever linked to the market, churned included), pushed every
// 30 minutes with the client wall. Nothing here claims buyer or seller availability — the data does not know it.
//
// Oct 9: the first night's misses were "LA", "Maryland", "PA & NJ" and places the directory does not have at all
// ("Nashville, TN"). So: spoken names map to the directory's ("LA" → Los Angeles), a bare state or province sums
// every market in it, and anything shaped like a place still gets the "none there" chip.

export type MarketCount = { name: string; clients: number; live: number };

/** "Calgary, AB" → "Calgary". */
export function placeOf(name: string): string {
  return name.split(",")[0].trim();
}

/** "South Jersey,NJ" → "NJ". */
export function codeOf(name: string): string {
  return (name.split(",")[1] ?? "").trim().toUpperCase();
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/['’]/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

const STATES: Array<[string, string]> = [
  ["Alabama", "AL"], ["Alaska", "AK"], ["Arizona", "AZ"], ["Arkansas", "AR"], ["California", "CA"], ["Colorado", "CO"], ["Connecticut", "CT"], ["Delaware", "DE"], ["Florida", "FL"], ["Georgia", "GA"], ["Hawaii", "HI"], ["Idaho", "ID"], ["Illinois", "IL"], ["Indiana", "IN"], ["Iowa", "IA"], ["Kansas", "KS"], ["Kentucky", "KY"], ["Louisiana", "LA"], ["Maine", "ME"], ["Maryland", "MD"], ["Massachusetts", "MA"], ["Michigan", "MI"], ["Minnesota", "MN"], ["Mississippi", "MS"], ["Missouri", "MO"], ["Montana", "MT"], ["Nebraska", "NE"], ["Nevada", "NV"], ["New Hampshire", "NH"], ["New Jersey", "NJ"], ["New Mexico", "NM"], ["New York", "NY"], ["North Carolina", "NC"], ["North Dakota", "ND"], ["Ohio", "OH"], ["Oklahoma", "OK"], ["Oregon", "OR"], ["Pennsylvania", "PA"], ["Rhode Island", "RI"], ["South Carolina", "SC"], ["South Dakota", "SD"], ["Tennessee", "TN"], ["Texas", "TX"], ["Utah", "UT"], ["Vermont", "VT"], ["Virginia", "VA"], ["Washington", "WA"], ["West Virginia", "WV"], ["Wisconsin", "WI"], ["Wyoming", "WY"], ["Washington DC", "DC"], ["Puerto Rico", "PR"],
  ["Alberta", "AB"], ["British Columbia", "BC"], ["Manitoba", "MB"], ["New Brunswick", "NB"], ["Newfoundland", "NL"], ["Nova Scotia", "NS"], ["Ontario", "ON"], ["Prince Edward Island", "PE"], ["Quebec", "QC"], ["Saskatchewan", "SK"],
];
const CODE_OF = new Map(STATES.map(([n, c]) => [norm(n), c]));
const NAME_OF = new Map(STATES.map(([n, c]) => [c, n]));
// How people write a state in a chat; "mass" is Massachusetts, "jersey" is New Jersey.
const STATE_WORDS: Record<string, string> = { mass: "MA", cali: "CA", jersey: "NJ", ont: "ON", "new york state": "NY", "upstate new york": "NY", "upstate ny": "NY", "washington state": "WA", dc: "DC", sask: "SK", nfld: "NL", pei: "PE", "ny state": "NY" };
// Two letters that are also words ("I'm IN", "OK", "5pm MT"): in capitals they count only after a comma, "Bolton, ON";
// in lower case a few more read as words ("thank you ma", "co"), so only a comma or capitals make those a state.
const SHOUTED = new Set(["IN", "OK", "HI", "ME", "OR", "OH", "ON", "ID", "MT", "CT", "LA", "SO"]);
const WORDY = new Set([...SHOUTED, "DE", "PA", "MA", "CO", "AL", "MS", "NE", "MO", "WA"]);

// Spoken names → the directory's place names; a key with no directory market still marks a market question.
const ALIAS: Record<string, string[]> = {
  la: ["los angeles"], "l a": ["los angeles"], sf: ["san francisco"], nyc: ["new york city"], manhattan: ["new york city"], philly: ["philedelphia", "philadelphia"], philadelphia: ["philedelphia"], vegas: ["las vegas"],
  atl: ["atlanta"], phx: ["phoenix"], okc: ["oklahoma city"], slc: ["salt lake city"], stl: ["st louis"], kc: ["kansas city"], kcmo: ["kansas city"], sac: ["sacramento"], sacto: ["sacramento"], sd: ["san diego"], dfw: ["dallas", "fort worth"],
  "the bay": ["bay area"], "tampa bay": ["tampa"], yyc: ["calgary"], yeg: ["edmonton"], kw: ["kitchener", "waterloo"], mtl: ["montreal"], cincy: ["cincinnati"], nola: ["new orleans"], jax: ["jacksonville"], indy: ["indianapolis"], "silicon valley": ["san jose", "santa clara", "san mateo"], oahu: ["honolulu"],
};
// Longest first, so "washington dc" is taken before "washington" and "new york state" before "new york".
const STATE_NAMES: Array<[string, string]> = [...[...CODE_OF.entries()], ...Object.entries(STATE_WORDS)].sort((a, b) => b[0].length - a[0].length);

/** The market is a whole state or province, not a city ("Florida, FL" yes; "Washington, MO" is a town, but reads as the state, so yes too). */
export function isStateMarket(name: string): boolean {
  return CODE_OF.has(norm(placeOf(name)));
}

/** The states and provinces the text names, by code, in order: full names, "mass", "ont", "Charlotte NC", "Bolton, ON", a bare "NJ". */
export function findStates(text: string): string[] {
  let t = ` ${norm(text)} `;
  const found: Array<[number, string]> = [];
  for (const [n, c] of STATE_NAMES) { const i = t.indexOf(` ${n} `); if (i >= 0) { found.push([i, c]); t = t.replace(` ${n} `, " ".repeat(n.length + 2)); } }
  for (const m of text.matchAll(/(,\s*)?\b([A-Za-z]{2})\b/g)) {
    const c = m[2].toUpperCase();
    if (!NAME_OF.has(c) || (!m[1] && (m[2] !== c || SHOUTED.has(c)))) continue;
    found.push([m.index, c]);
  }
  const words = norm(text).split(" ");
  const last = words.at(-1)?.toUpperCase() ?? "";
  if (words.length >= 2 && NAME_OF.has(last) && !WORDY.has(last)) found.push([text.length, last]); // "pleasant hill ca"
  return [...new Set(found.sort((a, b) => a[0] - b[0]).map(([, c]) => c))];
}

type Hit = MarketCount & { exact: boolean; len: number };

/** Markets whose place name (or a spoken alias for it) appears whole in the text; exact names first, longest first, then the busiest. A state the text names rules out cities in other states ("Durham NC" is not Durham, ON). */
export function findMarkets(text: string, markets: MarketCount[]): MarketCount[] {
  const t = ` ${norm(text)} `;
  if (t.trim().length < 2) return [];
  const hits: Hit[] = [];
  for (const m of markets) {
    if (isStateMarket(m.name)) continue;
    const p = norm(placeOf(m.name));
    // "charlotte county" (Florida) is not the city of Charlotte, NC; a market named "… County" also answers its bare name.
    const has = (x: string) => x.length >= 3 && t.includes(` ${x} `) && (x.endsWith(" county") || !t.includes(` ${x} county `));
    const spoken = Object.entries(ALIAS).find(([k, places]) => places.includes(p) && t.includes(` ${k} `));
    if (has(p)) hits.push({ ...m, exact: true, len: p.length });
    else if (spoken) hits.push({ ...m, exact: true, len: spoken[0].length });
    else if (p.endsWith(" county") && has(p.slice(0, -7))) hits.push({ ...m, exact: false, len: p.length });
  }
  // The state the text names, once the places found are taken out of it ("Kansas City" names no state; "Durham NC" does).
  const loose = (p: string) => new RegExp(p.split("").map((ch) => (ch === " " ? "[^a-z0-9]+" : `${ch}[^a-z0-9]*`)).join(""), "gi");
  const states = findStates(hits.reduce((rest, h) => rest.replace(loose(norm(placeOf(h.name))), " "), text.normalize("NFD").replace(/[\u0300-\u036f]/g, "")));
  return hits
    .filter((h) => !states.length || states.includes(codeOf(h.name)))
    .sort((a, b) => Number(b.exact) - Number(a.exact) || b.len - a.len || b.clients - a.clients)
    .map((h) => ({ name: h.name, clients: h.clients, live: h.live }));
}

// A region of a state is not the state: "South Florida" and "Northern New Jersey" get the none-there chip, not the sum.
const FILLER = /\b(in|the|any|anyone|anybody|agents?|here|there|how many|do you have|market|area|please|pls|check|can you|and|or|both|also|state|province|of|all|region|mostly|mainly|im|i am|from|what about|about|anything|many|people|clients?|yes|hi|hello|hey|ok|so|too|only|just|mine|me|yet|already|now|currently|right|booked|i booked|sellers?|buyers?|for|a|an|you|have|got|do|does|whats|what|is|it|like|my)\b/g;

/** Nothing in the text but the states it names (and filler): "Maryland", "PA & NJ", "how many in Ontario?". "Cape Coral Florida" is not, nor "South Florida". */
export function onlyStates(text: string, states: string[]): boolean {
  let rest = ` ${norm(text)} `;
  for (const [n, c] of CODE_OF) if (states.includes(c)) rest = rest.split(` ${n} `).join(" ");
  for (const [w, c] of Object.entries(STATE_WORDS)) if (states.includes(c)) rest = rest.split(` ${w} `).join(" ");
  rest = rest.replace(/\b[a-z]{2}\b/g, (w) => (states.includes(w.toUpperCase()) ? " " : w));
  return rest.replace(FILLER, " ").trim() === "";
}

export type Rollup = { code: string; name: string; clients: number; live: number; markets: MarketCount[] };

/** Every directory market in a state, summed; busiest first. */
export function rollup(code: string, markets: MarketCount[]): Rollup {
  const list = markets.filter((m) => codeOf(m.name) === code).sort((a, b) => b.clients - a.clients);
  return { code, name: NAME_OF.get(code) ?? code, clients: list.reduce((n, m) => n + m.clients, 0), live: list.reduce((n, m) => n + m.live, 0), markets: list };
}

const ASK = /\b(county|region|territory|how many (agents?|people|clients?|realtors?|markets?|in|there|here|do you)|many in|agents? (in|here|there)|anyone in|anybody in)\b/i;

/** The message reads like a market question even when no market matched: a county, a suburb, a state, "LA", "Nashville, TN". */
export function asksMarket(text: string): boolean {
  const t = ` ${norm(text)} `;
  return ASK.test(text) || findStates(text).length > 0 || Object.keys(ALIAS).some((k) => t.includes(` ${k} `));
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

/** The reply for one or more whole states: Kevin's line for one ("weve got 7 in New Jersey youre good"), a sum per state for several. */
export function rollupDraft(sums: Rollup[], pick: () => number = Math.random): string {
  if (sums.length === 1) return marketDraft(sums[0].name, sums[0].clients, pick);
  return `${sums.map((s) => `${s.clients} in ${s.name}`).join(" and ")} so youre good`;
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
