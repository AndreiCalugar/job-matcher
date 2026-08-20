-- Phase 7: tracking + feedback loop.

-- One row per application actually sent. Created when the user marks a
-- kit as sent; the kit holds what was sent, this holds what happened.
create table application (
  id                       uuid primary key default gen_random_uuid(),
  kit_id                   uuid references application_kit(id) on delete set null,
  job_id                   uuid not null references job(id) on delete cascade,
  match_id                 uuid references match(id) on delete set null,
  profile_id               uuid not null references profile(id) on delete cascade,
  status                   text not null default 'applied' check (status in (
                             'applied','screening','interview','final','offer',
                             'rejected','withdrawn','ghosted'
                           )),
  channel                  text check (channel in ('email','linkedin','form','other')),
  angle                    text,                -- copied from the kit; survives kit deletion
  score_at_send            numeric,             -- copied from the match; the calibration x-axis
  verdict_at_send          text,
  sent_at                  timestamptz not null default now(),
  first_response_at        timestamptz,         -- any human or automated reply
  response_kind            text check (response_kind in ('auto_reject','human_reject','interest','interview_invite')),
  days_to_response         int,                 -- derived on write from sent_at/first_response_at
  closed_at                timestamptz,         -- when a terminal status was set
  -- Company-process fields (CLAUDE.md "collect now, display later"). Structured only.
  comp_disclosed_at_stage  text check (comp_disclosed_at_stage in ('ad','screen','offer','never')),
  total_days_to_decision   int,
  final_stage_reached      text,
  shared_anonymously       boolean not null default false,
  notes                    text,                -- private to the user; never aggregated
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create index application_profile_sent_idx on application (profile_id, sent_at desc);
create index application_status_idx on application (status);

-- Schema only (CLAUDE.md "Company process data"). No UI until the build
-- trigger (5+ opted-in applications at one company, 100+ overall).
create table interview_round (
  id                uuid primary key default gen_random_uuid(),
  application_id    uuid not null references application(id) on delete cascade,
  round_number      int not null,
  format            text check (format in ('screen','take_home','live_coding','system_design','behavioural','panel','onsite','other')),
  scheduled_at      timestamptz,
  occurred_at       timestamptz,
  outcome           text check (outcome in ('advanced','rejected','ghosted','withdrew','pending')),
  duration_minutes  int,
  take_home_hours   numeric,
  created_at        timestamptz not null default now()
);

-- Ghosting is first-class. After this many days with no response, an
-- 'applied' application is marked ghosted by the ingest run.
alter table profile add column ghost_after_days int not null default 21;

alter table application   enable row level security;
alter table interview_round enable row level security;
