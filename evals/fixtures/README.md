# Eval fixtures

The matcher is not trusted until it agrees with a human ranking.

1. `jobs.json` — ~20 real postings, `[{ "id": "short-slug", "title": "…", "company": "…", "url": "…", "text": "full posting text" }]`.
   Pick a spread: a few you would expect to be strong fits, several stretches, several clear misses.
   Do not include anything confidential; these are committed.
2. `ranking.json` — the same ids, ordered **by you**, best fit first. No ties. This is the ground truth; if the model disagrees, the model is wrong.
3. `npm run eval` — parses (cached), scores, prints the table and Spearman ρ. `--min 0.6` makes it exit non-zero below that.

Every prompt change gets run against this and the ρ goes in the commit message: `match v3: ρ 0.71 → 0.78`.
