import { retentionCurve } from "@/lib/outcomes";

export type Metrics = { registered: number; attended: number; missed: number; live_at_pitch: number; clicked_offer: number; saw_offer_no_click: number; watched_replay: number; stayed_40min: number; asked_question: number; left_early: number; avg_live_seconds: number };

function pct(n: number, d: number): string {
  return d ? `${Math.round((n / d) * 100)}%` : "—";
}

/** The session's numbers, the way William asked for them: joined, retention, live at the pitch, clicks. */
export function SessionMetrics({ m, offsets, videoSeconds, ctaAt }: { m: Metrics | null; offsets: number[]; videoSeconds: number; ctaAt: number | null }) {
  if (!m) return <p className="text-sm text-muted">No numbers yet for this session.</p>;
  const tiles: Array<[string, string, string]> = [
    ["Registered", String(m.registered), ""],
    ["Joined live", String(m.attended), pct(m.attended, m.registered) + " show-up"],
    ["Live at the pitch", String(m.live_at_pitch), pct(m.live_at_pitch, m.attended) + " of joiners"],
    ["Clicked the offer", String(m.clicked_offer), pct(m.clicked_offer, m.attended) + " of joiners"],
    ["Saw it, didn't click", String(m.saw_offer_no_click), ""],
    ["Stayed 40 min+", String(m.stayed_40min), pct(m.stayed_40min, m.attended)],
    ["Asked a question", String(m.asked_question), ""],
    ["Left before the pitch", String(m.left_early), ""],
    ["Watched the replay", String(m.watched_replay), ""],
    ["Missed", String(m.missed), pct(m.missed, m.registered)],
    ["Avg. time in the room", `${Math.round(m.avg_live_seconds / 60)} min`, ""],
  ];
  const curve = retentionCurve(offsets, videoSeconds);
  const w = 600;
  const h = 120;
  const pts = curve.map((c, i) => `${(i / Math.max(1, curve.length - 1)) * w},${h - c.share * h}`).join(" ");
  const ctaX = ctaAt !== null && videoSeconds ? (ctaAt / videoSeconds) * w : null;
  return (
    <div className="flex flex-col gap-5">
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tiles.map(([label, value, sub]) => (
          <li key={label} className="rounded-lg border border-line bg-panel px-3 py-2">
            <p className="text-xs text-muted">{label}</p>
            <p className="text-xl font-bold tabular-nums">{value}</p>
            {sub && <p className="text-xs text-muted">{sub}</p>}
          </li>
        ))}
      </ul>
      {offsets.length > 0 && videoSeconds > 0 && (
        <div>
          <p className="text-sm font-bold text-muted">Retention: share of joiners still in the room, by 10 minutes</p>
          <div className="mt-2 overflow-x-auto rounded-lg border border-line bg-panel p-3">
            <svg viewBox={`-30 -10 ${w + 40} ${h + 30}`} className="h-40 w-full min-w-[480px]" role="img" aria-label="Retention curve">
              <line x1="0" y1={h} x2={w} y2={h} stroke="currentColor" strokeOpacity="0.3" />
              <line x1="0" y1="0" x2="0" y2={h} stroke="currentColor" strokeOpacity="0.3" />
              {[0, 0.5, 1].map((s) => (
                <text key={s} x="-6" y={h - s * h + 4} fontSize="10" textAnchor="end" fill="currentColor" fillOpacity="0.7">
                  {Math.round(s * 100)}%
                </text>
              ))}
              {ctaX !== null && <line x1={ctaX} y1="0" x2={ctaX} y2={h} stroke="#f5b324" strokeDasharray="4 3" />}
              {ctaX !== null && (
                <text x={ctaX + 4} y="10" fontSize="10" fill="#f5b324">
                  pitch
                </text>
              )}
              <polyline points={pts} fill="none" stroke="#2f7cf6" strokeWidth="2" />
              <text x="0" y={h + 14} fontSize="10" fill="currentColor" fillOpacity="0.7">
                0
              </text>
              <text x={w} y={h + 14} fontSize="10" textAnchor="end" fill="currentColor" fillOpacity="0.7">
                {Math.round(videoSeconds / 60)} min
              </text>
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}
