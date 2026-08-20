import { z } from "zod";
import { compPeriod, employmentType, redFlag, remotePolicy, requiredSkill, seniority } from "@/lib/parse/schema";

// Fixed id seeded by migration 20260820070248. The manual channel is a
// system constant; the app never looks it up.
export const MANUAL_SOURCE_ID = "00000000-0000-0000-0000-000000000001";

// What the paste form submits. Validated server-side before anything is
// stored; the client gets the same messages back under `fieldErrors`.
export const pasteInput = z.object({
  text: z
    .string()
    .trim()
    .min(80, "Paste the full posting. Under 80 characters is not enough to parse."),
  url: z
    .string()
    .trim()
    .url("Enter a full URL starting with http:// or https://, or leave it empty.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});
export type PasteInput = z.infer<typeof pasteInput>;

// Shape of job.raw. Every source writes the same envelope: the plain text
// the parser reads, the URL, and (for feeds) the native payload verbatim.
// Versioned so a later change to the shape does not silently break
// re-parses.
export const jobRaw = z.object({
  kind: z.string(),            // source kind: 'manual' | 'greenhouse' | ...
  v: z.literal(1),
  text: z.string(),
  url: z.string().url().optional(),
  payload: z.unknown().optional(),
});
export type JobRaw = z.infer<typeof jobRaw>;
/** @deprecated alias kept for the Phase 1–2 call sites */
export const manualRaw = jobRaw;
export type ManualRaw = JobRaw;

// The row as read back for the list. Zod here too: the DB is a boundary.
// Parsed fields are nullable: null until Phase 2's parser has run.
export const jobRow = z.object({
  id: z.string().uuid(),
  url: z.string().nullable(),
  raw: jobRaw,
  content_hash: z.string(),
  first_seen: z.string(),
  last_seen: z.string(),
  source: z.object({ kind: z.string() }),
  title: z.string().nullable(),
  company_name: z.string().nullable(),
  seniority: seniority.nullable(),
  employment_type: employmentType.nullable(),
  remote_policy: remotePolicy.nullable(),
  location: z.string().nullable(),
  country: z.string().nullable(),
  required_skills: z.array(requiredSkill).nullable(),
  nice_to_have: z.array(z.object({ name: z.string() })).nullable(),
  comp_min: z.number().nullable(),
  comp_max: z.number().nullable(),
  comp_currency: z.string().nullable(),
  comp_period: compPeriod.nullable(),
  comp_stated: z.boolean().nullable(),
  red_flags: z.array(redFlag).nullable(),
  summary: z.string().nullable(),
  language: z.string().nullable(),
  parsed_at: z.string().nullable(),
  parser_version: z.string().nullable(),
});
export type JobRow = z.infer<typeof jobRow>;

export const JOB_ROW_COLUMNS =
  "id, url, raw, content_hash, first_seen, last_seen, source:source_id(kind), title, company_name, seniority, employment_type, remote_policy, location, country, required_skills, nice_to_have, comp_min, comp_max, comp_currency, comp_period, comp_stated, red_flags, summary, language, parsed_at, parser_version";
