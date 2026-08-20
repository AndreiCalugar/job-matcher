# ADR 002 — No automated application submission

**Status:** accepted · **Date:** 2026-08-20

## Context

Every step before "send" is automated: parse, score, draft. The obvious next
step is to submit. Users ask for it; competitors advertise it.

## Decision

The tool never submits an application. It deep-links to the employer's apply
URL with the tailored material one click away, and records what the user
actually sent after they sent it.

## Consequences

- It contradicts the product thesis otherwise. The value claim is tailored
  quality over volume. Mass submission is what made recruiters hostile to AI
  tooling; building it would make this project part of that problem.
- It is mostly impossible anyway. ATS write endpoints require the employer's
  credentials — Greenhouse's `POST /jobs/{id}` needs that company's Job Board
  API key. Read is open; write is not. Form automation against arbitrary
  career sites is brittle and indistinguishable from abuse.
- It is the thing that gets a public project mocked.
- Keeping a human on "send" is also what makes `final_sent_body` meaningful:
  the diff between the draft and what went out is the highest-signal data in
  the schema, and it only exists if a person edits and sends.
