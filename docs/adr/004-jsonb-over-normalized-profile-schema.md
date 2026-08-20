# ADR 004 — JSONB over a normalised profile schema

**Status:** accepted · **Date:** 2026-08-20

## Context

A profile has experience, skills, projects, education and languages, each a
list of structured records. The textbook design is a table per list with
foreign keys.

## Decision

`profile` stores each section as a JSONB column. Zod schemas in
`src/lib/cv/schema.ts` are the contract; the database stores what Zod
accepted. Job `required_skills`, `red_flags`, match `gaps` and kit
`cv_changes` follow the same pattern.

## Consequences

- The shape changed three times on the first day (skill `years` moved from
  model output to computed; `summary` and `language` were added to jobs;
  `accepted` was added to CV changes). Each was a code change, not a
  migration with a backfill.
- Nothing queries inside these structures yet. When something does — gap
  frequency across matches is the first candidate — a generated column or a
  view can be added for that one access path without unpicking the rest.
- The anti-fabrication gate addresses profile fields by path
  (`experience[2].bullets[0]`), which is natural over a document and awkward
  over five joined tables.
- Cost: no referential integrity inside a section, and Postgres cannot
  enforce the enum values Zod does. Accepted while the shape is still moving.
