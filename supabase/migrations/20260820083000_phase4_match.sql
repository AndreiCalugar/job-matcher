-- Phase 4: match + gaps + pre-mortem.

create table match (
  id              uuid primary key default gen_random_uuid(),
  job_id          uuid not null references job(id) on delete cascade,
  profile_id      uuid not null references profile(id) on delete cascade,
  score           numeric not null check (score >= 0 and score <= 100),
  -- Derived from score in code (see lib/match/bands.ts), stored for
  -- querying. The model never chooses the band; it chooses the number.
  verdict         text not null check (verdict in ('strong','stretch','weak','mismatch')),
  matched_skills  jsonb not null, -- [{skill, evidence_from_profile, importance_in_job}]
  gaps            jsonb not null, -- [{skill, severity, mitigable, how_to_address}]
  reasoning       text not null,
  premortem       text not null,  -- "here is why they will pass on you"
  -- Reproducibility: any historical match is replayable.
  model_version   text not null,
  prompt_version  text not null,
  computed_at     timestamptz not null default now(),

  -- One match per (job, profile, prompt). A prompt bump produces a new row
  -- next to the old one; nothing is overwritten, so the "did the market
  -- change or did I change the prompt?" question stays answerable.
  unique (job_id, profile_id, prompt_version)
);

create index match_job_idx on match (job_id, computed_at desc);
create index match_profile_score_idx on match (profile_id, score desc);

alter table match enable row level security;
