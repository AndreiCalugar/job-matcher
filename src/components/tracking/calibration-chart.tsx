import type { BandStat } from "@/lib/tracking/stats";

// The calibration chart — DESIGN.md §6 at chart scale. Predicted band on
// the x-axis (labelled; colour is a redundant cue), observed response rate
// on the y-axis. Inline SVG, no library. Thin bars, 2px gaps, 4px rounded
// data-ends on the baseline, value labels in ink (contrast relief for the
// deliberately muted weak/mismatch fills), a table below.
const FILL: Record<string, string> = {
  strong: "var(--band-strong)", stretch: "var(--band-stretch)", weak: "var(--band-weak)", mismatch: "var(--band-mismatch)",
};
const LABEL: Record<string, string> = { strong: "75–100", stretch: "55–74", weak: "35–54", mismatch: "0–34" };

export function CalibrationChart({ bands, minSent = 50 }: { bands: BandStat[]; minSent?: number }) {
  const W = 560, H = 220, padL = 44, padR = 16, padT = 16, padB = 44;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const n = bands.length;
  const slot = plotW / n;
  const barW = Math.min(64, slot * 0.5);
  const total = bands.reduce((s, b) => s + b.sent, 0);
  const y = (rate: number) => padT + plotH * (1 - rate);

  return (
    <figure className="rounded-lg border border-rule bg-surface p-4">
      <figcaption className="mb-3 flex items-baseline justify-between">
        <span className="eyebrow">Response rate by predicted band</span>
        <span className="font-mono text-small text-graphite">
          {total} sent{total < minSent ? ` · needs ~${minSent} before it means much` : ""}
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full max-w-[560px]" role="img" aria-label="Response rate per predicted score band">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="var(--rule)" strokeWidth={1} />
            <text x={padL - 8} y={y(t) + 4} textAnchor="end" className="fill-[var(--graphite)] font-mono" fontSize={11}>
              {Math.round(t * 100)}%
            </text>
          </g>
        ))}
        <line x1={padL} x2={W - padR} y1={y(0)} y2={y(0)} stroke="var(--rule-strong)" strokeWidth={1} />
        {bands.map((b, i) => {
          const cx = padL + slot * i + slot / 2;
          const rate = b.rate ?? 0;
          const top = y(rate);
          const h = Math.max(0, y(0) - top);
          return (
            <g key={b.verdict}>
              {b.sent > 0 ? (
                <path
                  d={`M${cx - barW / 2},${y(0)} v${-Math.max(h - 4, 0)} a4,4 0 0 1 4,-4 h${barW - 8} a4,4 0 0 1 4,4 v${Math.max(h - 4, 0)} z`}
                  fill={FILL[b.verdict]}
                />
              ) : (
                <rect x={cx - barW / 2} y={y(0) - 2} width={barW} height={2} fill="var(--surface-sunken)" />
              )}
              <text x={cx} y={(b.sent > 0 ? top : y(0)) - 6} textAnchor="middle" className="fill-[var(--ink)] font-mono" fontSize={12}>
                {b.rate == null ? "—" : `${Math.round(b.rate * 100)}%`}
              </text>
              <text x={cx} y={y(0) + 16} textAnchor="middle" className="fill-[var(--ink)]" fontSize={12}>
                {b.verdict}
              </text>
              <text x={cx} y={y(0) + 30} textAnchor="middle" className="fill-[var(--graphite)] font-mono" fontSize={10}>
                {LABEL[b.verdict]} · n={b.sent}
              </text>
            </g>
          );
        })}
      </svg>
      <table className="mt-3 w-full text-small">
        <thead>
          <tr className="[&>th]:eyebrow [&>th]:h-8 [&>th]:text-left">
            <th>Band</th><th>Score</th><th className="text-right">Sent</th><th className="text-right">Responded</th><th className="text-right">Rate</th>
          </tr>
        </thead>
        <tbody>
          {bands.map((b) => (
            <tr key={b.verdict} className="h-8 border-t border-rule">
              <td className="text-ink">{b.verdict}</td>
              <td className="font-mono text-graphite">{LABEL[b.verdict]}</td>
              <td className="text-right font-mono text-graphite">{b.sent}</td>
              <td className="text-right font-mono text-graphite">{b.responded}</td>
              <td className="text-right font-mono text-ink">{b.rate == null ? "—" : `${Math.round(b.rate * 100)}%`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
