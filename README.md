# Job match

A job-search instrument. Upload a CV once; paste a posting (or let feeds
bring them); get a **calibrated 0–100 estimate of your chance of a first
interview**, the requirements you meet with evidence, the gaps with how to
handle them, and a pre-mortem in the hiring manager's voice. Then a
ready-to-send application kit in which **nothing is invented** — every claim
is checked against your profile before you see it. You press send. The tool
tracks what happened and tests its own score against reality.

Built in public, for one person's job search first. Free.
Live: https://job-matcher-sand.vercel.app · Decisions: [`docs/adr`](docs/adr) ·
Screenshots: [`docs/screenshots`](docs/screenshots)

---

## The two things worth reading about

### 1. The score is tested, not trusted

You cannot unit-test "is 73 the right score". So the matcher is evaluated
against a **hand-ranked set of real postings**: `evals/fixtures/jobs.json`
(24 postings fetched from public boards) and `evals/fixtures/ranking.json`
(the same ids ordered best-to-worst fit by a human). `npm run eval` scores
them all and reports one number — **Spearman rank correlation** between the
model's order and the human's. 1 = identical, 0 = unrelated.

| run | prompt | model | n | ρ | note |
|---|---|---|---|---|---|
| 1 | `match.v1` | sonnet-5 / medium | 24 | **−0.106** | human ranking was by *title only*; the four largest disagreements were postings whose titles say "full-stack" and whose requirements say Java/Go/Kotlin. The model read the requirements. Re-rank pending. |

Every prompt change gets a row here and a commit message like
`match v3: ρ 0.71 → 0.78`. Results are committed under `evals/results/`.

The second test is **calibration**: once applications are tracked, the
statistics page plots response rate per predicted band. If the bands
separate, the score is a measurement. If the line is flat, it is decoration
and the model needs work. It needs ~50 sent applications to say anything.

### 2. The system cannot emit an unsupported claim

Generated material (CV advice, cover letter, outreach) passes a gate before
it is stored:

- **Hard checks, deterministic, blocking.** Every CV edit must address a
  path that exists in the profile and quote its real current text. Every
  number, percentage, technology, employer and place in generated prose must
  occur in the profile or the posting. Every claim in the model's own ledger
  must resolve to a profile path. Any failure → the draft is discarded and
  logged to `blocked_generation`, never shown.
- **Judgement checks, warning.** A verb stronger than the CV's wording, or a
  sentence a second (cheap) model doubts, is flagged *on the affected item*
  for the user to accept or reject.

The split was decided by data: the first three live kits were all blocked by
the judgement checks, and two of the three blocks were wrong. The hard checks
have had no false positives. Eight tests feed the gate deliberately
fabricated kits ("12 engineers", "40%", "Terraform", "helped" → "led", a
fake CV path) — all blocked.

---

## What it does, in order

| Phase | What | Status |
|---|---|---|
| 1 | Paste a posting → stored verbatim | ✅ |
| 2 | Parse to structured requirements + red flags, once per posting, cheap tier | ✅ |
| 3 | CV → structured profile → **non-skippable** review screen | ✅ |
| 4 | Match: score, matched requirements with evidence, gaps, pre-mortem; eval harness | ✅ |
| 5 | Application kit: CV advice diff, cover letter, outreach, ATS-safe export, anti-fabrication gate | ✅ |
| 6 | Automated ingest: Greenhouse / Lever / Ashby company feeds, Jobicy / Arbeitnow / RemoteOK; cron every 6h | ✅ |
| 7 | Tracking pipeline incl. ghosted as a first-class state; calibration chart; statistics | ✅ |
| 8 | Multi-user: magic-link auth, per-user RLS, export, hard delete, privacy statement | ✅ |

What it will **not** do, by decision: submit applications
([ADR 002](docs/adr/002-no-automated-application-submission.md)), scrape
LinkedIn ([ADR 001](docs/adr/001-no-linkedin-scraping.md)), regenerate a
designed CV, or round a score up to be encouraging.

---

## How it is built

- **TypeScript everywhere.** Next.js 16 (App Router), Tailwind v4, shadcn/ui.
  Supabase (Postgres, RLS on every table) for data and auth. Vercel for the
  app; GitHub Actions for CI and the ingest cron.
- **Every model call is a forced, strict tool call** whose input schema is
  generated from the Zod schema that then validates the response
  (`src/lib/llm/tool-call.ts`). Prose is never parsed for data.
- **Model routing by judgement required.** Job parsing and the fabrication
  verifier run on the cheap tier; CV parsing, matching and kit generation on
  the strong tier. The eval harness can run the matcher on any tier
  (`--model haiku|sonnet|opus`) — the cheapest model that matches the human
  ranking is the one to ship.
- **Prompts are versioned files** under [`prompts/`](prompts). Every match
  row carries `model_version` and `prompt_version`; a prompt bump writes a
  new row beside the old one. "Did the market change or did I change the
  prompt?" stays answerable.
- **Everything cached, nothing re-parsed.** A posting is parsed once per
  `parser_version`. The profile sits in the prompt-cache prefix; the second
  call of a session reads ~11k tokens at 10% price.
- **Unattended-safe.** Idempotent upsert on `(source, external_id)`;
  content-hash dedupe across sources; retry once then dead-letter; a
  posting that leaves a feed is closed, not deleted; one bad source never
  stops the run; run log on every source.
- **A meter, not a paywall.** `usage_event` records every call's tokens from
  day one. Pricing, if it ever comes, gets set from real numbers.
- **Tests never hit the API.** Fixture-based, 61 of them, on every push.

Design language: [`DESIGN.md`](DESIGN.md) — colour is reserved for data;
chrome is monochrome; every score renders as a tick-marked gauge.

---

## Running it

```bash
npm install
cp .env.example .env.local        # Supabase URL + service role + anon key, Anthropic key
npx supabase link --project-ref <ref> && npx supabase db push
npm run dev
```

| Command | What |
|---|---|
| `npm test` | fixture-based tests, no network |
| `npm run eval -- --model sonnet --effort medium --limit 10` | score the eval set, print ρ (cheap loop) |
| `npm run eval -- --model opus --min 0.6` | recorded run; exits 1 below the threshold |
| `npm run eval:fetch` | refresh candidate postings for the eval set |
| `npm run ingest -- --score-cap 10` | one ingest run locally |
| `npm run claim -- you@example.com` | attach pre-auth rows to the first user (one-off) |

Costs, measured: parse ≈ $0.005, match ≈ $0.02 (Sonnet) – $0.06 (Opus),
kit ≈ $0.12, CV parse ≈ $0.07. A 20-posting eval run ≈ $0.40 on Sonnet.

---

## Building in public

The reasoning, dead ends and numbers from each session are in a build log
kept alongside the repo; the decisions that constrain future work are in
[`docs/adr`](docs/adr). Phases 1–8 were built in one day; the interesting
parts are the eval harness, the gate, and the calibration chart — not the UI.

MIT.
