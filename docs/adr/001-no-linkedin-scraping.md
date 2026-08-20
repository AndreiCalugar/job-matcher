# ADR 001 — No LinkedIn scraping

**Status:** accepted · **Date:** 2026-08-20

## Context

LinkedIn is where most of the target postings and most of the relevant
recruiters are. Every tool in this category is tempted to read profiles,
collect recruiter contacts, or automate connection requests, and several
libraries make it a weekend's work. The product needs an outreach message per
application and a recipient to send it to.

## Decision

The system never reads from LinkedIn by automated means. No profile
collection, no contact scraping, no automated connection or message sending,
no Sales Navigator automation, no headless browser against linkedin.com.

A job posting found on LinkedIn enters through the manual paste path, like a
posting found anywhere else. A recipient's name and role are typed in by the
user, one at a time, for one application. Recruiter discovery stays human.

## Consequences

- Outreach is slower per application. The user finds the person; the tool
  drafts the message. This is consistent with the product thesis — quality
  of one tailored contact over volume — so the cost is accepted, not
  tolerated.
- The LinkedIn User Agreement (§8.2) prohibits scraping and automation. Not
  doing it removes a termination risk for the user's own account, which for a
  job seeker is the single most damaging outcome a tool could cause.
- Collected third-party profile data would make the project a data controller
  over people who never consented. Not collecting it keeps the GDPR surface
  limited to the user's own CV, which is the only one the Phase 8 processor
  obligations need to cover.
- No ingest source of kind `linkedin` exists in the `source.kind` check
  constraint, and none will be added. If a future aggregator (e.g. JSearch)
  returns LinkedIn-hosted postings through its own licensed API, that is the
  aggregator's relationship, not ours; the posting is stored with the
  aggregator as the source.
- This is a hard line, recorded here so it cannot be reopened casually in a
  later session as "just a small scraper".
