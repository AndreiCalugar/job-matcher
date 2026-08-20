# Screenshots

One set per shipped phase, taken from the deployed app unless noted.
Naming: `phase-N-<what>-<theme>.jpg`. Test data only.

## Phase 1 — manual paste → stored job (2026-08-20)
- `phase-1-empty-state-dark.jpg` — first load, no rows (local dev, pre-deploy)
- `phase-1-jobs-list-dark.jpg` — two stored postings, production
- `phase-1-jobs-list-light.jpg` — same, light theme
- `phase-1-duplicate-detected-light.jpg` — re-pasting an existing ad: no new row, `last_seen` bumped

## Phase 2 — job parsing (2026-08-20)
- `phase-2-jobs-list-parsed-light.jpg` — list with parsed columns: level, remote, comp, flag count, parser state
- `phase-2-job-detail-light.jpg` / `-dark.jpg` — parsed record: summary, required skills with importance and years, nice-to-haves, posting facts, parser version
- `phase-2-job-detail-red-flags-dark.jpg` — a posting with three red flags, each with verbatim evidence (local dev)

## Phase 3 — CV parsing + correction screen (2026-08-20, synthetic CV, local dev)
- `phase-3-review-gaps-light.jpg` — review screen: what the parser noticed (overlapping roles, unsupported skills, summary vs dates)
- `phase-3-review-experience-dark.jpg` — editable experience cards
- `phase-3-profile-light.jpg` / `-dark.jpg` — confirmed profile read view

## Phase 4 — match + gaps + pre-mortem (2026-08-20, local dev)
- `phase-4-jobs-list-scored-light.jpg` / `-dark.jpg` — the calibration bar in the list: 68 / stretch, ticks at 25/50/75, unscored rows offer Score
- (no detail-panel screenshot: the match evidence quotes the real profile)

## Phase 6 — automated ingest (2026-08-20, local dev)
- `phase-6-sources-light.jpg` — subscribe by careers URL, aggregator queries, run log (one Jobicy source after its first run: 64 seen)

## Phase 7 — tracking + statistics (2026-08-20, local dev)
- `phase-7-statistics-empty-light.jpg` — the calibration chart with no data yet: the structure is the promise; it fills as applications are sent
