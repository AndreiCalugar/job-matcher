// Score → band. Deliberately not a traffic light (DESIGN.md §2): a weak
// match is not an error. Thresholds are a product decision and live here,
// in one place, so the calibration chart (Phase 7) can test them.

export type Verdict = "strong" | "stretch" | "weak" | "mismatch";

export const BANDS: { verdict: Verdict; min: number }[] = [
  { verdict: "strong", min: 75 },
  { verdict: "stretch", min: 55 },
  { verdict: "weak", min: 35 },
  { verdict: "mismatch", min: 0 },
];

export function verdictFor(score: number): Verdict {
  for (const b of BANDS) if (score >= b.min) return b.verdict;
  return "mismatch";
}

// Below this, the morning queue collapses the row by default (never hides
// it — the user can audit what was filtered).
export const COLLAPSE_BELOW = 55;
