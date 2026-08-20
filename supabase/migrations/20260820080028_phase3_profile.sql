-- Phase 3: CV -> structured profile, then human correction.

create table profile (
  id               uuid primary key default gen_random_uuid(),
  -- Nullable until Phase 8 adds auth. One row total until then.
  user_id          uuid,
  headline         text,
  summary          text,
  -- JSONB on purpose (ADR 004): the shape will change several times in the
  -- first month and nothing queries inside these yet.
  experience       jsonb not null default '[]'::jsonb, -- [{company,title,start,end,bullets[],stack[]}]
  skills           jsonb not null default '[]'::jsonb, -- [{name,proficiency,years,evidence}]
  projects         jsonb not null default '[]'::jsonb, -- [{name,url,description,stack[],role}]
  education        jsonb not null default '[]'::jsonb,
  languages        jsonb not null default '[]'::jsonb,
  -- Original upload as plain text, kept so a re-parse starts from the same
  -- input. PDFs are reduced to text before storage (see lib/cv/extract).
  raw_cv           text not null,
  raw_cv_filename  text,
  -- The review screen is non-skippable: nothing downstream reads a profile
  -- until this is true. Parsed output is the draft; the corrected row is
  -- ground truth.
  human_corrected  boolean not null default false,
  corrected_at     timestamptz,
  parsed_at        timestamptz,
  parser_version   text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table profile enable row level security;
