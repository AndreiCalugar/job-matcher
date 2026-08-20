import type { Verdict } from "@/lib/match/bands";

// DESIGN.md §6 — the one memorable object. A tick-marked gauge, never a
// number in a coloured pill. Ticks at 25/50/75 are always visible: the
// scale is honest, so the scale is shown. Fill colour is the band; that is
// the only chroma on the screen.

const FILL: Record<Verdict, string> = {
  strong: "bg-band-strong",
  stretch: "bg-band-stretch",
  weak: "bg-band-weak",
  mismatch: "bg-band-mismatch",
};
const TEXT: Record<Verdict, string> = {
  strong: "text-band-strong",
  stretch: "text-band-stretch",
  weak: "text-band-weak",
  mismatch: "text-band-mismatch",
};

export function CalibrationBar({
  score,
  verdict,
  size = "inline",
  sweep = false,
}: {
  score: number;
  verdict: Verdict;
  size?: "inline" | "detail";
  sweep?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, score));
  const dims = size === "detail" ? "h-4 w-[320px]" : "h-1.5 w-16";
  return (
    <span className="inline-flex items-center gap-3" role="img" aria-label={`Score ${Math.round(pct)} of 100, ${verdict}`}>
      <span className={`relative block shrink-0 overflow-hidden rounded-sm bg-surface-sunken ${dims}`}>
        <span
          className={`absolute inset-y-0 left-0 ${FILL[verdict]} ${sweep ? "motion-safe:animate-[sweep_240ms_cubic-bezier(0.2,0,0,1)]" : ""}`}
          style={{ width: `${pct}%` }}
        />
        {[25, 50, 75].map((t) => (
          <span key={t} className="absolute inset-y-0 w-px bg-rule-strong" style={{ left: `${t}%` }} />
        ))}
      </span>
      <span className={`font-mono tabular-nums ${size === "detail" ? "text-h1 font-medium" : "text-small"} text-ink`}>
        {Math.round(pct)}
      </span>
      {size === "detail" ? (
        <span className={`eyebrow ${TEXT[verdict]}`} style={{ color: undefined }}>
          {verdict}
        </span>
      ) : null}
    </span>
  );
}
