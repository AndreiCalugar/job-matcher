-- Phase 6: automated ingest.

-- ---------------------------------------------------------------------------
-- search_profile: a saved set of criteria. Drives aggregator queries and,
-- more importantly, decides which newly ingested jobs are worth a
-- strong-tier scoring call.
-- ---------------------------------------------------------------------------
create table search_profile (
  id                uuid primary key default gen_random_uuid(),
  profile_id        uuid not null references profile(id) on delete cascade,
  name              text not null,
  titles            text[] not null default '{}',   -- substrings matched against job.title, case-insensitive
  countries         text[] not null default '{}',   -- ISO alpha-2; empty = any
  remote_policy     text[] not null default '{}',   -- subset of remote|hybrid|onsite; empty = any
  seniority         text[] not null default '{}',
  employment_type   text[] not null default '{}',
  comp_floor        numeric,
  comp_currency     text,
  exclude_keywords  text[] not null default '{}',
  exclude_companies text[] not null default '{}',
  enabled           boolean not null default true,
  created_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- company: resolved from a careers URL. The ATS feed is the source; the
-- company is what the user subscribed to.
-- ---------------------------------------------------------------------------
create table company (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  domain          text unique,
  ats_kind        text,
  ats_identifier  text,
  is_target       boolean not null default true,
  created_at      timestamptz not null default now(),
  unique (ats_kind, ats_identifier)
);

-- ---------------------------------------------------------------------------
-- source: run log + config. Phase 1 created the table; this is the rest.
-- ---------------------------------------------------------------------------
alter table source
  add column company_id        uuid references company(id) on delete cascade,
  add column search_profile_id uuid references search_profile(id) on delete cascade,
  add column config            jsonb not null default '{}'::jsonb,
  add column last_run_at       timestamptz,
  add column last_run_status   text check (last_run_status in ('ok','error','empty')),
  add column last_error        text,
  add column last_run_new      int,
  add column last_run_seen     int;

alter table job add column company_id uuid references company(id) on delete set null;
alter table job add column posted_at timestamptz;   -- as reported by the source, if at all

-- A posting that vanishes from a feed is closed, not deleted.
-- closed_at stays null for manual pastes (no feed to vanish from).
alter table job add column closed_at timestamptz;
create index job_open_idx on job (last_seen desc) where closed_at is null;

alter table search_profile enable row level security;
alter table company        enable row level security;
