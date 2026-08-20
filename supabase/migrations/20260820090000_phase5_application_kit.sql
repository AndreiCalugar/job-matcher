-- Phase 5: application kit.

create table application_kit (
  id                uuid primary key default gen_random_uuid(),
  match_id          uuid not null references match(id) on delete cascade,
  job_id            uuid not null references job(id) on delete cascade,
  profile_id        uuid not null references profile(id) on delete cascade,
  -- Advice diff against the base profile (CLAUDE.md "CV handling"):
  -- [{path, current, suggested, reason, severity, accepted}]
  cv_changes        jsonb not null,
  -- ATS-safe plain export, generated deterministically from the profile.
  ats_export        text not null,
  cover_letter      text not null,
  outreach_subject  text,
  outreach_body     text,
  gap_handling      jsonb not null,  -- [{gap, approach}]
  recipient_name    text,
  recipient_role    text,
  channel           text check (channel in ('email','linkedin','form','other')),
  angle             text not null check (angle in ('domain_overlap','solved_this_exact_problem','gap_acknowledged','builder_track_record')),
  -- Anti-fabrication gate result. Kits are stored only when it passed;
  -- the ledger is kept so a later audit can see what was checked.
  claims            jsonb not null,  -- [{claim, source_path}]
  gate_report       jsonb not null,  -- {deterministic: [...], verifier: [...]}
  version           int not null default 1,
  edited_by_user    boolean not null default false,
  -- What was ACTUALLY sent, after edits. The diff between cover_letter and
  -- this is direct training data on model weakness.
  final_sent_body   text,
  model_version     text not null,
  prompt_version    text not null,
  generated_at      timestamptz not null default now(),
  sent_at           timestamptz
);

create index application_kit_match_idx on application_kit (match_id, generated_at desc);
create index application_kit_job_idx on application_kit (job_id);

-- Generation attempts that the gate blocked. Never shown to the user as a
-- kit; kept so fabrication rates per prompt version are measurable.
create table blocked_generation (
  id              uuid primary key default gen_random_uuid(),
  match_id        uuid references match(id) on delete cascade,
  prompt_version  text not null,
  model_version   text not null,
  reasons         jsonb not null,
  payload         jsonb,
  created_at      timestamptz not null default now()
);

alter table application_kit  enable row level security;
alter table blocked_generation enable row level security;
