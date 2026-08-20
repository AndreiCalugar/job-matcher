import { z } from "zod";

// Output contract for the matcher. The model returns a number and the
// evidence for it; the band is derived in code.

export const matchedSkill = z.object({
  skill: z.string().min(1),
  importance_in_job: z.enum(["must", "should", "nice"]),
  evidence_from_profile: z.string().min(1).describe("Where in the profile this is demonstrated: role, project, or bullet, quoted or closely paraphrased."),
});

export const gap = z.object({
  skill: z.string().min(1).describe("The requirement the profile does not meet, as the posting names it."),
  severity: z.enum(["critical", "important", "minor"]).describe("critical: a stated must-have with no evidence; important: a must-have with weak/adjacent evidence, or a should-have missing; minor: a nice-to-have missing."),
  mitigable: z.boolean().describe("Can the candidate credibly address this in an application (adjacent experience, fast to learn, partially covered)? false if it is a hard requirement with no bridge."),
  how_to_address: z.string().min(1).describe("One or two sentences: what to say or do about it. Concrete. If not mitigable, say so and say why."),
});

export const matchParse = z.object({
  score: z.number().min(0).max(100).describe("Probability-like estimate (0–100) that this candidate would reach a first interview if they applied well. Calibrated, not encouraging."),
  matched_skills: z.array(matchedSkill),
  gaps: z.array(gap),
  reasoning: z.string().min(1).describe("The case for the score in plain sentences. Name the two or three facts that moved it most, in both directions."),
  premortem: z.string().min(1).describe("Written as if the application failed: the most likely reason this company passes on this candidate, in the recruiter's voice. Specific to this posting and this profile. Not softened."),
  seniority_fit: z.enum(["under", "match", "over", "unclear"]),
  location_fit: z.enum(["ok", "relocation_needed", "blocked", "unclear"]),
});
export type MatchParse = z.infer<typeof matchParse>;

export const matchRow = z.object({
  id: z.string().uuid(),
  job_id: z.string().uuid(),
  profile_id: z.string().uuid(),
  score: z.coerce.number(),
  verdict: z.enum(["strong", "stretch", "weak", "mismatch"]),
  matched_skills: z.array(matchedSkill),
  gaps: z.array(gap),
  reasoning: z.string(),
  premortem: z.string(),
  model_version: z.string(),
  prompt_version: z.string(),
  computed_at: z.string(),
});
export type MatchRow = z.infer<typeof matchRow>;
export const MATCH_COLUMNS =
  "id, job_id, profile_id, score, verdict, matched_skills, gaps, reasoning, premortem, model_version, prompt_version, computed_at";
