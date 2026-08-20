-- Phase 2: raw -> structured, one LLM call per job, ever.

-- ---------------------------------------------------------------------------
-- Parsed fields on job. All nullable: a row exists before it is parsed, and
-- a parse that dead-letters leaves them null. `parser_version` is the cache
-- key — a job is re-parsed only if this value is behind the current one.
-- ---------------------------------------------------------------------------
alter table job
  add column title           text,
  -- What the ad says the employer is called. Denormalised on purpose: the
  -- parser extracts a string, not an entity. The `company` table (Phase 6)
  -- will link on top of this; nothing is lost by storing the string now.
  add column company_name    text,
  add column seniority       text check (seniority in ('junior','mid','senior','staff','lead','unclear')),
  add column employment_type text check (employment_type in ('permanent','contract','either','unclear')),
  add column remote_policy   text check (remote_policy in ('remote','hybrid','onsite','unclear')),
  add column location        text,
  add column country         text,   -- ISO 3166-1 alpha-2, or null
  add column required_skills jsonb,  -- [{name, importance, years_wanted}]
  add column nice_to_have    jsonb,  -- [{name}]
  add column comp_min        numeric,
  add column comp_max        numeric,
  add column comp_currency   text,
  add column comp_period     text check (comp_period in ('year','month','day','hour')),
  add column comp_stated     boolean,
  add column red_flags       jsonb,  -- [{kind, evidence, severity}]
  add column summary         text,   -- one or two plain sentences from the parser
  add column language        text,   -- ISO 639-1 of the posting text
  add column parsed_at       timestamptz,
  add column parser_version  text;

-- "Give me everything not yet parsed at the current version" is the
-- ingest cron's main query. Partial index keeps it tiny.
create index job_unparsed_idx on job (first_seen) where parsed_at is null;

-- ---------------------------------------------------------------------------
-- Dead-letter table. On parse failure: retry once, then write here and move
-- on. The batch never dies on one bad payload (CLAUDE.md "Failure discipline").
-- ---------------------------------------------------------------------------
create table failed_ingest (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid references job(id) on delete cascade,
  stage       text not null,          -- 'parse' | later: 'fetch', 'match', ...
  error       text not null,
  payload     jsonb,                  -- whatever we had when it failed
  created_at  timestamptz not null default now()
);
create index failed_ingest_job_idx on failed_ingest (job_id);

-- ---------------------------------------------------------------------------
-- Usage meter. Built before billing, never after (CLAUDE.md "Monetisation").
-- One row per LLM call. user_id is nullable until Phase 8 adds auth.
-- ---------------------------------------------------------------------------
create table usage_event (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid,
  kind           text not null check (kind in ('job_parsed','cv_parsed','match_scored','kit_generated')),
  job_id         uuid references job(id) on delete set null,
  model          text not null,
  input_tokens   int  not null,
  output_tokens  int  not null,
  cache_read_tokens int not null default 0,
  latency_ms     int,
  created_at     timestamptz not null default now()
);
create index usage_event_kind_created_idx on usage_event (kind, created_at desc);

alter table failed_ingest enable row level security;
alter table usage_event   enable row level security;
