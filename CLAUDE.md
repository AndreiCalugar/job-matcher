# Project Context

## What this is

A job-matching and application-preparation engine. It takes a structured CV,
ingests job postings from public sources, scores each posting against the
profile, surfaces gaps honestly, and generates a ready-to-send application kit
(tailored CV, cover letter, outreach message) grounded in the specific overlap.

Built first as a personal tool for a single user, then opened to others.
Developed in public — repo is public from day one.

## Who it's for

**Phase 1 (now):** one user. A full-stack engineer (React/TypeScript/Next.js,
Python, Node, C#/.NET), MSc in Computer Science, ~4-5 years in Danish fintech,
~2 years freelancing under a Romanian PFA. Targeting both salaried roles and
freelance clients across the EU/Nordics and remote.

**Phase 2:** other job seekers and freelancers. The freelancer path is a
deliberate differentiator — most tools in this space assume salaried employment.

## Design principles

1. **Honest calibration over flattery.** Match scores must be usable. A 40% is
   more valuable than an inflated 90%. Never round up to be encouraging.
2. **Gaps are the product.** Telling the user *why* they don't fit, and what to
   address, is worth more than telling them they do.
3. **Automate preparation, never submission.** The tool should get the user to
   a reviewed, ready-to-send artifact in under two minutes. A human presses send.
   See "On auto-apply" below — this is a product position, not a limitation.
4. **Everything cached, nothing re-parsed.** LLM calls are the cost centre. A
   given job ad is parsed exactly once, ever.
5. **Unattended-safe.** Ingest runs on a cron. No step may depend on a human
   catching a malformed model response.
6. **Ship boring first.** Each phase must be independently useful and deployed
   before the next starts.

---

## Discovery model — read this before designing ingest

There are three input paths with different shapes. Conflating them is the
main architectural mistake available here.

### 1. Manual paste (primary, always available)
User finds a job anywhere — LinkedIn, a newsletter, a friend — and pastes the
text or URL. Goes straight into `job.raw` and through the same parser as
everything else. **This is the first thing built and the path used most often.**

### 2. Aggregator search (broad discovery, criteria-driven)
This is the only path that supports "software engineer, Denmark + Netherlands +
remote." Adzuna, JSearch, Arbeitnow, RemoteOK. Query by title, location, and
keyword. Broader coverage, messier data, some duplicates and stale posts.

### 3. ATS feeds (depth on target companies)
Greenhouse, Lever, Ashby, Workable, Recruitee, Personio. **These are per-company
feeds, not search engines.** You cannot query by title or country. You subscribe
to a company and get everything it has open. Cleanest data, earliest signal —
the ATS is upstream of LinkedIn — and the real apply URL.

| Platform | Endpoint | Notes |
|---|---|---|
| Greenhouse | `GET https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true` | Easiest. No search/filter. Common in tech/VC-backed. |
| Lever | `GET https://api.lever.co/v0/postings/{site}?mode=json` | Supports `team`, `location`, `commitment`, `level`, `skip`, `limit`. |
| Ashby | `GET https://api.ashbyhq.com/posting-api/job-board/{name}?includeCompensation=true` | Best structured compensation data. |
| Workable | `GET https://www.workable.com/api/accounts/{subdomain}?details=true` | Locations/departments on separate endpoints. SMB-heavy. |
| Recruitee | `GET https://{company}.recruitee.com/api/offers/` | Common in European SMB / mid-market. |
| Personio | `GET https://{company}.jobs.personio.de/xml?language=en` | XML. Dominant in DACH. Some accounts use `.com`. |

All GET endpoints are unauthenticated. No published rate limits, but poll on a
schedule (every few hours), cache, and send an honest User-Agent with contact info.

**Resolving a company to a board token:** open the careers page and read the URL.
`boards.greenhouse.io/{token}`, `jobs.lever.co/{slug}`,
`jobs.ashbyhq.com/{name}`, `{company}.recruitee.com`. Build a small admin form
that takes a careers URL and auto-detects platform + identifier via regex.

### On auto-apply
Do not build it. Three reasons, in order of weight:

1. **It contradicts the product thesis.** The entire value claim is tailored
   quality over volume. Mass submission is the behaviour that made recruiters
   hostile to AI tooling in the first place.
2. **It is mostly not possible anyway.** ATS submission endpoints require the
   employer's credentials — e.g. Greenhouse's `POST .../jobs/{id}` needs Basic
   Auth with that company's Job Board API key. Read is open; write is not.
3. **Reputationally it is the thing that gets a public project mocked.**

Deep-link to the apply URL with the tailored material on the clipboard. That is
the fast path, and it keeps a human in the loop.

---

## User experience

### Onboarding (once)
1. **Upload CV.** PDF or paste.
2. **Parse into structured profile.** One strong-model pass.
3. **Review and correct screen. Non-skippable.** The parsed profile is ground
   truth for everything downstream; five minutes of human correction here is
   worth more than any amount of prompt tuning later. Let the user add evidence
   the CV omits — the freelance work that reads thin on paper is exactly what
   needs enriching.
4. **Define search profiles.** Titles (many), countries (many), remote policy,
   seniority band, employment type, comp floor, hard exclusions. Saved and
   reusable — this is a persisted object, not a one-off query.
5. **Seed target companies.** Paste careers URLs, auto-resolve to ATS feeds.

### Daily loop
1. Cron ingests overnight from aggregators + subscribed ATS boards.
2. New jobs parsed, scored, ranked.
3. **Morning queue:** ranked list, banded `strong` / `stretch` / `weak`.
   Anything below threshold is collapsed by default, not hidden — the user
   should be able to audit what was filtered out.
4. **Job detail view:** match breakdown, matched skills with evidence from the
   profile, gaps with severity and whether they're mitigable, the pre-mortem,
   and detected red flags in the posting itself.
5. **Generate application kit** — one action, produces:
   - **Tailored CV** shown as a *diff against the base CV*. Every change
     highlighted with a one-line reason. Reorder and reweight only; never
     invent. The user accepts or rejects each change.
   - **Cover letter**, grounded in named overlap.
   - **Outreach message/email**, if a recipient has been entered manually.
   - **Gap-handling suggestions** — what to address head-on rather than hide.
6. User edits, sends manually, marks as sent.
7. Status tracked; responses logged; feedback loop learns which angles work.

**Target: paste-to-ready-kit in under two minutes.** That number is the product.

---

## Stack

- **Runtime:** TypeScript everywhere. Next.js (App Router) for UI + API routes.
- **DB:** Supabase (Postgres). `pgvector` enabled from the start, used later.
- **Jobs/cron:** Supabase scheduled functions, or GitHub Actions cron for
  ingest. Keep ingest decoupled from the web app.
- **LLM:** Anthropic API. Structured output via tool-use schemas — never
  "please respond in JSON". Validate every response with Zod before it touches
  the DB.
- **Validation:** Zod at every boundary — API responses, LLM outputs, form input.
- **Deployment:** Vercel for the app, Supabase hosted for DB.

### Model routing

| Task | Model tier | Why |
|---|---|---|
| Job ad → structured requirements | Cheap/fast | High volume, low judgement |
| Red-flag detection | Cheap/fast | Pattern matching, same pass as above |
| CV → structured profile | Strong | Runs once, must be right |
| Match scoring + gap analysis | Strong | This is the core value |
| Application kit generation | Strong | User-facing output quality |

---

## Data model

Postgres. Snake_case tables and columns. `id uuid default gen_random_uuid()`,
`created_at timestamptz default now()` on everything.

### `profile`
The user, structured. One row per user.

```
id                uuid pk
user_id           uuid fk -> auth.users
headline          text
summary           text
experience        jsonb   -- [{company, title, start, end, bullets[], stack[]}]
skills            jsonb   -- [{name, proficiency, years, evidence}]
projects          jsonb   -- [{name, url, description, stack[], role}]
education         jsonb
languages         jsonb
raw_cv            text    -- original upload, kept for re-parsing
human_corrected   boolean default false
parsed_at         timestamptz
```

Do not over-normalize this early. JSONB is correct here — the shape will change
several times in the first month.

### `search_profile`
A saved set of criteria. The user has several (e.g. "Nordic frontend contract",
"remote EU senior React").

```
id                uuid pk
profile_id        uuid fk -> profile
name              text
titles            text[]
countries         text[]
remote_policy     text[]   -- ['remote','hybrid','onsite']
seniority         text[]
employment_type   text[]   -- ['permanent','contract']
comp_floor        numeric
comp_currency     text
exclude_keywords  text[]
exclude_companies text[]
enabled           boolean default true
```

### `source`
```
id                uuid pk
kind              text    -- 'manual'|'greenhouse'|'lever'|'ashby'|'workable'|'recruitee'|'personio'|'adzuna'|'jsearch'
identifier        text    -- board token / slug / subdomain / query string
search_profile_id uuid fk -> search_profile  -- null for company feeds
config            jsonb
enabled           boolean default true
last_run_at       timestamptz
last_run_status   text
last_error        text
```

### `company`
```
id                uuid pk
name              text
domain            text unique
ats_kind          text
ats_identifier    text
size              text
funding_stage     text
hq_location       text
stack_signals     text[]  -- inferred from job ads over time
notes             text    -- enrichment output
is_target         boolean default false
enriched_at       timestamptz
```

### `job`
```
id                uuid pk
source_id         uuid fk -> source
company_id        uuid fk -> company
external_id       text
url               text
apply_url         text
raw               jsonb   -- untouched payload, or pasted text
title             text
seniority         text    -- 'junior'|'mid'|'senior'|'staff'|'lead'|'unclear'
employment_type   text    -- 'permanent'|'contract'|'either'|'unclear'
remote_policy     text    -- 'remote'|'hybrid'|'onsite'|'unclear'
location          text
country            text
required_skills   jsonb   -- [{name, importance, years_wanted}]
nice_to_have      jsonb
comp_min          numeric
comp_max          numeric
comp_currency     text
comp_stated       boolean
red_flags         jsonb   -- [{kind, evidence, severity}]
content_hash      text    -- dedupe across sources
parsed_at         timestamptz
parser_version    text
first_seen        timestamptz
last_seen         timestamptz
closed_at         timestamptz

unique (source_id, external_id)
index on content_hash
```

`first_seen` / `last_seen` matter: a posting open 90 days is a different signal
than one posted yesterday. `content_hash` handles the same role arriving from
both an aggregator and the company's own ATS feed.

### `match`
```
id                uuid pk
job_id            uuid fk -> job
profile_id        uuid fk -> profile
score             numeric   -- 0-100
verdict           text      -- 'strong'|'stretch'|'weak'|'mismatch'
matched_skills    jsonb     -- [{skill, evidence_from_profile}]
gaps              jsonb     -- [{skill, severity, mitigable, how_to_address}]
reasoning         text
premortem         text      -- "here is why they will pass on you"
model_version     text      -- REQUIRED
prompt_version    text      -- REQUIRED
computed_at       timestamptz

unique (job_id, profile_id, prompt_version)
```

### `application_kit`
```
id                uuid pk
match_id          uuid fk -> match
cv_variant        jsonb   -- tailored CV
cv_changes        jsonb   -- [{path, before, after, reason, accepted}]
cover_letter      text
outreach_body     text
outreach_subject  text
recipient_name    text    -- entered manually by the user
recipient_role    text
channel           text    -- 'email'|'linkedin'|'form'|'other'
angle             text    -- REQUIRED: which strategy was used
version           int default 1
edited_by_user    boolean default false
final_sent_body   text    -- what was ACTUALLY sent, after edits
generated_at      timestamptz
sent_at           timestamptz
```

`edited_by_user` + `final_sent_body` are the highest-signal fields in the schema.
The diff between generated and sent is direct training data on model weakness.

### `application`
```
id                uuid pk
kit_id            uuid fk -> application_kit
job_id            uuid fk -> job
status            text    -- 'sent'|'no_response'|'rejected'|'screening'|'interview'|'offer'|'withdrawn'
responded_at      timestamptz
response_kind     text    -- 'auto_reject'|'human_reject'|'interest'|'interview_invite'
days_to_response  int
notes             text
```

---

## Build order

Each phase ships and is used before the next begins. No parallel tracks.

### Phase 1 — Manual paste → stored job
Textarea + optional URL. Store into `job.raw` with `source.kind = 'manual'`.
No parsing yet. Deploy it.

### Phase 2 — Parse jobs
Raw → structured, one LLM call, tool-use schema, Zod-validated, written back
with `parser_version`. Never re-parse unless `parser_version` changes. Red-flag
detection in the same pass: vague scope, multiple roles in one posting, no comp
stated, "wear many hats", unrealistic stack breadth.

### Phase 3 — Parse the CV + correction UI
One pass, then the non-skippable review screen. Store `human_corrected`.
Re-parsing later diffs against the corrected version, never overwrites it.

### Phase 4 — Match + gaps
The core. Before trusting any output:

> **Build the eval set first.** Hand-rank 20 jobs from best fit to worst.
> Store as a fixture. Every prompt change is scored against it — Spearman
> correlation against your ranking. If the model disagrees with you, the model
> is wrong. Ninety minutes of work that saves weeks of tuning blind.

The pre-mortem is not optional and must not be softened.

**At this point the tool is genuinely useful.** Paste a LinkedIn job, get an
honest score and a gap list. Use it daily from here on.

### Phase 5 — Application kit
Tailored CV with accept/reject diff UI, cover letter, outreach draft. Multiple
angles per match ("domain overlap", "solved this exact problem", "gap
acknowledged head-on"). Store which angle was used.

**Fabrication guardrail:** every claim in generated material must trace to a
field in `profile`. Add a validation pass that flags unsupported claims and
blocks generation on failure.

### Phase 6 — Automated ingest
Now add the cron. ATS feeds for the seeded target companies first, then
aggregator search driven by `search_profile`. Dedupe on `content_hash`.

### Phase 7 — Tracking + feedback loop
Status pipeline. Response rates by angle, seniority, company size, score band.
This is where it stops being a wrapper.

### Phase 8 — Multi-user
Not before Phase 7 produces insight from real data.

---

## Guardrails

### Legal / data
- **No LinkedIn scraping.** No profile collection, no automated connection
  requests, no Sales Navigator automation. Recipient details are entered
  manually, one at a time. Hard line, not a preference.
- **No automated application submission.** See "On auto-apply".
- Public job-board APIs only. Cache aggressively, back off on errors, honest
  User-Agent with a contact address.
- **GDPR, from Phase 8:** other users' CVs make this a processor. Required
  before any signup opens: privacy policy, hard-delete that actually cascades,
  explicit no-training-on-user-data commitment, data export. Design the schema
  for deletion now — miserable to retrofit.

### Repo hygiene
- Public repo from commit one.
- `/data`, `/private`, `.env*`, any CV file, any response data → `.gitignore`
  **before** the first commit.
- Secrets in Vercel/Supabase env only. Pre-commit secret scan.

### Cost
- One parse per job, forever. Cache on `parser_version`.
- Cheap tier for extraction, strong tier for reasoning.
- Log token spend per phase.

### Output quality
- Structured outputs via tool schemas, always. Never parse prose for data.
- Zod-validate every LLM response. On failure: retry once, then dead-letter the
  row and continue — never crash the batch.
- Every generated claim traceable to profile data. No invention.

---

## Conventions

- TypeScript strict mode. No `any`.
- Server actions or route handlers for mutations; no client-side DB writes.
- Prompts live in versioned files under `/prompts`, not inline in code. Bump
  `prompt_version` on every change.
- Every LLM-touching function has a fixture-based test that doesn't hit the API.
- Migrations via Supabase CLI, checked in.

---

## Building in public

- Public repo, meaningful commit messages — they become the changelog.
- One post per shipped phase, not per day. Show the ugly version working.
- The eval set and the honest-scoring approach are the most interesting things
  here technically. Lead with those, not the UI.
- Phases 1-5 within two weeks. Apply to real roles with the half-built version
  in parallel. The tool rides alongside the job search; it does not replace it.

---

## Technical credibility checklist

The stack is unremarkable by design. What makes this project read as senior work
is how the non-deterministic core is handled. These are the things to build and
to write about.

### 1. Eval harness — tests for something with no single right answer
You cannot assert `expect(score).toBe(73)`. So instead:

- `/evals/fixtures/jobs.json` — 20 real job ads.
- `/evals/fixtures/ranking.json` — those 20 ranked best-to-worst fit, by hand.
- `/evals/run.ts` — runs the matcher, compares its ordering to yours, outputs
  one number: Spearman rank correlation (0 = random, 1 = identical).
- GitHub Action on every PR touching `/prompts`. Fails below a threshold.

That single number is your regression test. Commit messages become
`prompt v7: correlation 0.71 → 0.78`. Publish the number in the README.

### 2. Calibration — proving the score means something
The score is a prediction. Test it against reality: bucket sent applications
into score bands (0-40, 40-60, 60-80, 80+) and measure actual response rate per
band. If the bands separate cleanly, the scores are real. If the line is flat,
they are decoration and the model needs work.

Needs ~50 sent applications before it says anything. Build the query early, read
it late. This chart is the single most compelling artifact this project can produce.

### 3. Reproducibility — knowing what produced what
Every `match` row stamped with `model_version` and `prompt_version`. Prompts in
versioned files, never inline. Any historical match replayable on demand.

The question this answers: "results got worse this week — did the market change,
or did I change the prompt?" Without the stamps, unanswerable.

### 4. Failure discipline — surviving unattended runs
- **Idempotent ingest.** Re-running the same fetch must not duplicate rows.
  Upsert on `(source_id, external_id)`.
- **Dead-letter table.** `failed_ingest(payload jsonb, error text, stage text,
  created_at)`. On parse failure: retry once, then write the row here and
  continue. The batch never dies on one bad payload.
- **Run log.** `last_run_at`, `last_run_status`, `last_error` on `source`, and a
  simple status page. Know a feed broke without discovering it three weeks later.

### 5. Anti-fabrication gate — a safety property with teeth
After generation, a validation pass checks every factual claim in the CV variant
and cover letter against fields in `profile`. Unsupported claim → generation
blocked, not warned. Covered by tests with deliberately fabricated fixtures.

This is the difference between "I told the model not to lie" and "the system
cannot emit an unsupported claim."

### 6. ADRs — architecture decision records
One short markdown file per significant decision, in `/docs/adr/`. Format:
context, decision, consequences. ~200 words each.

Start with:
- `001-no-linkedin-scraping.md`
- `002-no-automated-application-submission.md`
- `003-manual-paste-before-automated-ingest.md`
- `004-jsonb-over-normalized-profile-schema.md`

Cheapest item on this list, highest signal. It demonstrates reasoning, which is
exactly what technical interviews probe for.

### What to avoid
No microservices. No event sourcing. No Kubernetes. No premature abstraction.
A monolith with sharp evals reads more senior than a distributed system serving
one user. Over-engineering reads as inexperience, not sophistication.

---

## Product focus

The centre of gravity is **the job search pipeline**, not one-shot generation.
What the user comes back for daily:

1. **Application tracking** — what was applied to, when, through which channel,
   what happened next.
2. **Match statistics** — how the user performs by score band, seniority,
   company size, country, angle used.
3. **Process tracking** — pipeline stages, response times, where things stall.
4. **Tailored CV advice** — change-by-change guidance against a specific ad.

This framing matters competitively. A single tailored letter is replaceable by
a chat window. A tracked pipeline with accumulated statistics is not — it gets
more valuable the longer it is used, and it cannot be recreated by pasting a
job ad somewhere else.

### Pipeline stages
`saved → kit_generated → applied → screening → interview → final → offer`
plus terminal `rejected` / `withdrawn` / `ghosted`.

Auto-mark `ghosted` after N days without response (default 21, user-configurable).
Ghosting is the most common outcome and must be a first-class state, not a gap
in the data.

### Statistics to surface
- Response rate by score band — **the calibration chart** (see Technical
  credibility §2). Primary metric.
- Response rate by angle used.
- Median days to first response, by company size.
- Application volume vs response volume over time.
- Gap frequency: which missing skills appear most across weak matches. This
  becomes a learning roadmap the user did not have to write.
- Ghost rate by source — reveals which boards carry stale or fake postings.

---

## Monetisation

**Do not build billing until there are users.** Build the meter, not the paywall.

### From day one
`usage_event(user_id, kind, cost_tokens, created_at)` where `kind` is
`match_scored` | `kit_generated` | `cv_parsed` | `job_parsed`.

This costs an afternoon and means pricing can be set from real data later
instead of guessed now.

### When it is time to charge

| Tier | Includes | Rationale |
|---|---|---|
| **Free** | Match score, gaps, pre-mortem, red flags, tracking, statistics | Cheap to produce, high perceived value, shareable. Tracking is the retention hook — never paywall it. |
| **Paid** | Application kit generation (tailored CV advice, cover letter, outreach), ATS-safe CV export, unlimited history | Expensive per call, wanted at peak motivation. |

Free tier is deliberately generous: it can't bankrupt the project because the
expensive call is the kit, not the score.

### Pricing shape
Not a subscription. Job seekers churn the week they get hired and are
price-sensitive precisely because they are between incomes. Credit packs or a
30-day pass match actual behaviour. Revisit only after ~100 active users.

**Current priority:** reach and evidence over revenue. A free tool with 500
users is worth more to the project's stated goals than a paid one with forty.

---

## CV handling

### Never regenerate a designed CV
If the user uploads a well-designed PDF, do not rebuild it. Layout-preserving
PDF rewriting is hard, the result is worse, and it destroys something they own
and are proud of.

### The two artifacts

**1. Advice diff (primary).**
Structured change list against the base profile:

```
{ path, current, suggested, reason, severity, accepted }
```

Rendered as a review UI — accept or reject each item, with a one-line
justification for every suggestion. The user makes the edit in their own file,
in their own tool. Reorder, reweight, rephrase, emphasise. **Never invent.**

Severity bands: `critical` (blocks the match), `important` (weakens it),
`polish` (marginal).

**2. ATS-safe plain export (secondary, high value).**
Designed CVs — multi-column, sidebars, graphics, text in images — parse badly in
the systems the ad is feeding into. Generate a clean single-column,
standard-heading, machine-readable version from the structured profile, clearly
labelled as the machine-facing copy.

Positioning: keep the beautiful one for humans, send the plain one to the robot.
Most candidates do not know their design is costing them, which makes this both
genuinely useful and a good post.

### Guardrail
Both artifacts pass the anti-fabrication gate. Every claim must trace to a field
in `profile`. Unsupported claim → blocked, not warned.

---

## Company process data — collect now, display later

**Status: NOT BUILT. Schema only.**

Aggregate process data across users is the one asset here that cannot be
replicated by a better prompt. It is also worthless below scale and dangerous
if designed carelessly. So: structure the fields from day one, collect from the
first user, build no display until the data justifies it.

### What is collected — structured fields only

All of these come from tracking the user is already doing. No extra burden.

```
interview_round(
  id                uuid pk,
  application_id    uuid fk -> application,
  round_number      int,
  format            text,   -- 'screen'|'take_home'|'live_coding'|'system_design'
                            -- |'behavioural'|'panel'|'onsite'|'other'
  scheduled_at      timestamptz,
  occurred_at       timestamptz,
  outcome           text,   -- 'advanced'|'rejected'|'ghosted'|'withdrew'|'pending'
  duration_minutes  int,
  take_home_hours   numeric -- unpaid work asked for; high-signal
)
```

Extend `application` with:

```
comp_disclosed_at_stage  text     -- 'ad'|'screen'|'offer'|'never'
total_days_to_decision   int
final_stage_reached      text
shared_anonymously       boolean default false   -- explicit per-application opt-in
```

### Derived per company (future display)
- Median days to first response; ghost rate
- Typical number of rounds and their formats
- Median total process duration
- Whether comp is disclosed, and at which stage
- Unpaid take-home hours typically requested
- Response rate by match-score band — does this profile type get traction here

### Hard rules — bake into the schema now

1. **Structured fields only. No free text is ever collected for sharing.** No
   "what the interviewer said", no failure post-mortems, no interviewer names.
   Rejected candidates are a biased sample and routinely misdiagnose why they
   were rejected; publishing that produces confident nonsense. It also invites
   NDA breaches, GDPR exposure over a third party who never consented, and
   defamation risk. This is a content-moderation business with a legal team —
   not this project.
2. **Opt-in per application**, not per account. Default off.
3. **k-anonymity threshold: nothing renders below 5 applications** for a given
   company. Below that, individuals are identifiable.
4. **Aggregates only.** No per-user rows ever exposed, no dates precise enough
   to correlate with a specific candidate.
5. **Cascade on delete.** A user deleting their account removes their
   contributions from the aggregate. Design for this now.

### Build trigger
Revisit when a single company has 5+ opted-in applications and the platform has
100+ tracked applications overall. Not before.

---

## BUILDLOG.md — session record

Maintain `BUILDLOG.md` at the repo root. Append a new entry at the **end of
every working session**, newest at the top. It is the raw material for written
posts, so it records reasoning and dead ends, not just outcomes.

**Never rewrite or tidy earlier entries.** A log that gets cleaned up loses
exactly the parts that are worth reading.

### Entry format

```markdown
## 2026-08-21 — Session 003 · Phase 2 (job parsing)

### Problem being solved
One or two sentences. What was broken or missing before this session, in terms
a non-specialist could follow.

### What changed
- Bullet list of concrete changes: files, endpoints, schema, packages added.
- Commit range: abc1234..def5678

### Decisions and why
For each real choice: the options considered, what was picked, what it costs.
If it is significant enough to constrain future work, also write an ADR and
link it here.

### What was tried and abandoned
The most important section. Approaches that failed, and the specific reason.
Do not omit these because the final code does not contain them.

### Surprises
Anything that did not behave as expected. Wrong assumptions, undocumented API
behaviour, output quality that was better or worse than predicted.

### Numbers
Any measurement taken: eval correlation, tokens per parse, latency, cost, rows
processed. Even rough ones. These make written posts concrete.

### Open questions
Unresolved things carried into the next session.
```

### Agent instructions

- Write the entry from what actually happened in the session, including work
  that was reverted or thrown away.
- Be specific. "Improved the parser" is useless; "switched from prompt-requested
  JSON to a tool-use schema because ~1 in 12 responses had trailing prose that
  broke `JSON.parse`" is the sentence a post gets built from.
- Record real numbers wherever any were observed.
- Do not editorialise, do not add motivation the user did not express, and do
  not write in a promotional register. Facts and mechanics only.
- Leave the `### Surprises` section as a stub if nothing surprising occurred.
  Do not invent one.

### Human addendum

After the agent writes its entry, the user appends a short block in their own
voice:

```markdown
### Notes (mine)
What actually felt hard, what I got wrong, what I would tell someone starting this.
```

This is the part that makes a post readable. The agent never writes this section
and never edits it.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
