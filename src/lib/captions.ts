// Captions for a "live" room must read like live captions: one short line at a time, each shown only while its
// words are being said. Zoom's transcript has 3–8 second cues of a sentence or two, which shows text seconds before
// it is spoken and wraps to several lines on a phone. Reflow: split every cue into ~40-character pieces at word
// boundaries, give each piece a share of the cue's time by length, never overlap, and shift by the event's offset.
const MAX = 42;

type Cue = { start: number; end: number; text: string };

const toSec = (t: string) => {
  const p = t.trim().split(":").map(Number);
  return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1];
};
const fmt = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = (s % 60).toFixed(3).padStart(6, "0");
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${sec}`;
};

export function parseVtt(text: string): Cue[] {
  const out: Cue[] = [];
  for (const block of text.replace(/\r/g, "").split(/\n\n+/)) {
    const lines = block.split("\n").filter((l) => l.trim());
    const i = lines.findIndex((l) => l.includes("-->"));
    if (i < 0) continue;
    const [a, b] = lines[i].split("-->");
    const body = lines.slice(i + 1).join(" ").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (!body) continue;
    out.push({ start: toSec(a), end: toSec(b.trim().split(" ")[0]), text: body });
  }
  return out;
}

/** Word-boundary pieces of at most `max` characters. */
export function pieces(text: string, max = MAX): string[] {
  const words = text.split(" ");
  const out: string[] = [];
  let cur = "";
  for (const w of words) {
    if (cur && (cur + " " + w).length > max) {
      out.push(cur);
      cur = w;
    } else cur = cur ? `${cur} ${w}` : w;
  }
  if (cur) out.push(cur);
  return out;
}

export function reflow(cues: Cue[], offset = 0): Cue[] {
  const out: Cue[] = [];
  cues.forEach((c, i) => {
    const ps = pieces(c.text);
    const total = ps.reduce((n, p) => n + p.length, 0) || 1;
    const nextStart = cues[i + 1]?.start ?? Infinity;
    const end = Math.min(c.end, nextStart);
    const dur = Math.max(0.6, end - c.start);
    let t = c.start;
    for (const p of ps) {
      const d = (dur * p.length) / total;
      out.push({ start: t + offset, end: t + d + offset, text: p });
      t += d;
    }
  });
  return out.filter((c) => c.end > 0).map((c) => ({ ...c, start: Math.max(0, c.start) }));
}

export function toVtt(cues: Cue[]): string {
  return "WEBVTT\n\n" + cues.map((c) => `${fmt(c.start)} --> ${fmt(c.end)} line:-2 align:center\n${c.text}`).join("\n\n") + "\n";
}

export function liveCaptions(vtt: string, offset = 0): string {
  return toVtt(reflow(parseVtt(vtt), offset));
}
