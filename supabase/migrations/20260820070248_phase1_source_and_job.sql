-- Phase 1: manual paste -> stored job.
-- Only the columns this phase reads or writes. Parsed fields (title, skills,
-- comp, red_flags, parser_version ...) arrive with Phase 2 in their own
-- migration so the schema history matches the build log.

-- pgvector is enabled now (CLAUDE.md "Stack") so later migrations never need
-- an extension step mid-flight. It costs nothing while unused.
create extension if not exists vector;

-- ---------------------------------------------------------------------------
-- source: where a job came from. One row per feed/query/paste-channel.
-- ---------------------------------------------------------------------------
create table source (
  id          uuid primary key default gen_random_uuid(),
  -- Closed set, enforced in the DB rather than only in Zod: an ingest cron
  -- writing a typo'd kind must fail loudly, not succeed quietly.
  kind        text not null check (kind in (
                'manual','greenhouse','lever','ashby','workable',
                'recruitee','personio','adzuna','jsearch','arbeitnow','remoteok'
              )),
  -- Board token / slug / subdomain / query string. For 'manual' it is the
  -- literal string 'manual' — the paste channel is a singleton.
  identifier  text not null,
  enabled     boolean not null default true,
  created_at  timestamptz not null default now(),

  -- A feed is identified by (kind, identifier); subscribing to the same
  -- Greenhouse board twice must be a no-op, not a duplicate row.
  unique (kind, identifier)
);

-- The manual channel is a system constant, not user data, so it is seeded here
-- with a fixed id. The app refers to it by this id and never has to look it up.
insert into source (id, kind, identifier)
values ('00000000-0000-0000-0000-000000000001', 'manual', 'manual');

-- ---------------------------------------------------------------------------
-- job: one posting, as received. Untouched payload in `raw`.
-- ---------------------------------------------------------------------------
create table job (
  id            uuid primary key default gen_random_uuid(),
  source_id     uuid not null references source(id) on delete restrict,
  -- The id the source uses for this posting. For ATS feeds it is theirs; for
  -- manual pastes there is none, so we use content_hash. Either way the
  -- unique constraint below makes every ingest path idempotent.
  external_id   text not null,
  url           text,
  -- The payload exactly as received: API JSON for feeds, {text, url} for a
  -- paste. Never normalised here — the parser (Phase 2) reads from this and
  -- re-parsing later must start from the original, not from our edits.
  raw           jsonb not null,
  -- sha256 of the normalised posting text. Same ad arriving from an
  -- aggregator and the company's own ATS collapses on this.
  content_hash  text not null,
  first_seen    timestamptz not null default now(),
  last_seen     timestamptz not null default now(),
  created_at    timestamptz not null default now(),

  unique (source_id, external_id)
);

create index job_content_hash_idx on job (content_hash);
create index job_first_seen_idx on job (first_seen desc);

-- ---------------------------------------------------------------------------
-- Access. There is no auth in Phase 1, so nothing may be reachable with the
-- anon key. RLS is enabled with zero policies: anon/authenticated get nothing,
-- and every read/write goes through server code holding the service role.
-- Phase 8 adds per-user policies; until then this is the safe default.
-- ---------------------------------------------------------------------------
alter table source enable row level security;
alter table job    enable row level security;
