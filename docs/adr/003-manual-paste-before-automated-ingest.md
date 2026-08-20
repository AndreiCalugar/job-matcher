# ADR 003 — Manual paste before automated ingest

**Status:** accepted · **Date:** 2026-08-20

## Context

Automated ingest from job boards is the visible, impressive feature. It is
also the one with the most moving parts: adapters, scheduling, dedupe,
failure handling, cost control.

## Decision

Phase 1 is a textarea. Every posting — pasted or fetched — goes through the
same `job.raw` → parser → scorer path. Automated ingest (Phase 6) was built
only after parse, score and kit generation were in daily use.

## Consequences

- The parser, scorer and gate were tuned on postings the user actually
  cared about, not on whatever a feed returned.
- The feed adapters had a stable contract to target: produce text, store
  the native payload, hand off to a pipeline that already worked.
- Paste remains the primary path. A posting found in a newsletter or a
  message has no feed; the tool must be as good for that as for anything.
- Cost: six sessions of pasting by hand before the cron existed. The eval
  fixtures were fetched with a one-off script in the meantime.
