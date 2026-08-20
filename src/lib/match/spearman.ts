// Spearman rank correlation between two orderings of the same ids.
// 1 = identical order, 0 = unrelated, -1 = reversed. Ties in scores get
// average ranks (the standard treatment).

export function ranks(values: number[], opts: { descending?: boolean } = {}): number[] {
  const idx = values.map((v, i) => ({ v, i })).sort((a, b) => (opts.descending ? b.v - a.v : a.v - b.v));
  const out = new Array<number>(values.length);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1]!.v === idx[i]!.v) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) out[idx[k]!.i] = avg;
    i = j + 1;
  }
  return out;
}

export function spearman(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length < 2) throw new Error("spearman: need two equal-length arrays of n ≥ 2");
  const ra = ranks(a);
  const rb = ranks(b);
  const n = a.length;
  const mean = (n + 1) / 2;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    const x = ra[i]! - mean;
    const y = rb[i]! - mean;
    num += x * y;
    da += x * x;
    db += y * y;
  }
  if (da === 0 || db === 0) return 0;
  return num / Math.sqrt(da * db);
}

// Convenience: human ranking is an ordered list of ids (best first); model
// output is a score per id. Returns rho over the ids present in both.
export function spearmanFromRanking(humanOrder: string[], scores: Record<string, number>): { rho: number; n: number; missing: string[] } {
  const ids = humanOrder.filter((id) => id in scores);
  const missing = humanOrder.filter((id) => !(id in scores));
  const humanRank = ids.map((_, i) => humanOrder.length - i); // best = highest
  const modelScore = ids.map((id) => scores[id]!);
  return { rho: ids.length >= 2 ? spearman(humanRank, modelScore) : 0, n: ids.length, missing };
}
