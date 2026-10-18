// The humanizer's mechanical fixes and machine-checkable tells for a one-line chat reply (after blader/humanizer v3.1.0,
// MIT; the full rules are in humanizer-rules.ts and in Kaitlyn's WRITING block). `tidy` always applies; a `tell` sends the
// draft to the desk instead of the room (SPEC-kaitlyn-autopilot.md, B).

/** Dashes become commas, curly quotes straight, spacing sane. Hyphens inside words stay. */
export function tidy(text: string): string {
  return text
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/\s+--\s+/g, ", ")
    .replace(/,(\s*,)+/g, ",")
    .replace(/\s+/g, " ")
    .trim();
}

const RULES: Array<[string, RegExp]> = [
  ["not X but Y", /\bnot (?:just|only|merely|simply)\b[^.!?]{0,80}?\bbut\b/i],
  ["not X but Y", /\b(?:it|this|that|she|he|katherine)'?s not (?:about |just |only )?[^.!?]{0,60}?,\s*(?:it|this|that|she|he)'?s\b/i],
  ["chatbot residue", /\b(?:great|good|excellent|awesome|fantastic) question\b|^(?:of course|certainly|absolutely)!\s+\S|\bi hope (?:this|that) helps\b|\blet me know if\b|\bhappy to help\b|\bfeel free to\b/i],
  ["staged opener", /^(?:honestly|look|here'?s the thing|the thing is|let'?s be honest|real talk)\s*[,:?!.]/i],
  ["closer", /(?:^|[.!?]\s+)(?:that'?s the (?:real )?(?:win|key|point|difference|magic)|let that sink in|read that again|that distinction matters|simple as that|it'?s that simple)[.!]?\s*$/i],
];
const STOCK = /\b(delve|delving|crucial|pivotal|robust|seamless(?:ly)?|elevate|game.?changers?|leverag(?:e|es|ing)|journey|landscape|testament|tapestry|underscores?|showcas(?:e|es|ing)|meticulous(?:ly)?|vibrant|realm|unlock|empower(?:s|ing)?|streamlines?|cutting.?edge|world.?class|best.?in.?class|synerg\w+|holistic)\b/gi;

/** The names of the AI tells left in a line, in the order they appear; empty when it reads like a person wrote it. */
export function tells(text: string): string[] {
  const out: string[] = [];
  for (const [name, re] of RULES) if (re.test(text) && !out.includes(name)) out.push(name);
  for (const m of text.matchAll(STOCK)) out.push(`stock word: ${m[1].toLowerCase()}`);
  return out;
}
