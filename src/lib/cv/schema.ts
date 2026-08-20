import { z } from "zod";

// The structured profile. This is the ground truth for every downstream
// phase, so every field that could be checked against the CV text has a
// place for evidence. Shape mirrors the `profile` JSONB columns.

const ym = z
  .string()
  .nullable()
  .describe("YYYY-MM if stated, YYYY if only the year is known, null if unknown or 'present'.");

export const experience = z.object({
  company: z.string().min(1),
  title: z.string().min(1),
  start: ym,
  end: ym.describe("null when the role is current."),
  current: z.boolean(),
  location: z.string().nullable(),
  employment_type: z.enum(["permanent", "contract", "freelance", "internship", "unclear"]),
  bullets: z.array(z.string().min(1)).describe("Achievements and responsibilities as written, one per bullet, lightly cleaned of formatting. Do not rewrite."),
  stack: z.array(z.string().min(1)).describe("Technologies named for this role, normalised (React, Node.js, PostgreSQL, .NET, TypeScript)."),
});

// What the model emits for a skill. No `years`: that is computed in code
// from role dates (lib/cv/years.ts) so overlapping roles cannot inflate it.
export const parsedSkill = z.object({
  name: z.string().min(1).describe("Normalised technology, language, framework, tool or domain."),
  category: z.enum(["language", "framework", "platform", "tool", "domain", "practice", "other"]),
  proficiency: z.enum(["expert", "proficient", "working", "familiar", "unclear"]).describe("Only as the CV itself signals; 'unclear' is the default."),
  evidence: z.array(z.string().min(1)).describe("Short verbatim fragments from the CV that support this skill. At least one."),
});

// What is stored and edited: the parsed skill plus computed (then
// user-editable) years.
export const skill = parsedSkill.extend({
  years: z.number().min(0).max(40).nullable(),
});

export const project = z.object({
  name: z.string().min(1),
  url: z.string().nullable(),
  description: z.string().min(1),
  stack: z.array(z.string().min(1)),
  role: z.string().nullable(),
});

export const education = z.object({
  institution: z.string().min(1),
  degree: z.string().nullable().describe("e.g. 'MSc Computer Science'."),
  field: z.string().nullable(),
  start: ym,
  end: ym,
});

export const language = z.object({
  name: z.string().min(1),
  level: z.enum(["native", "fluent", "professional", "conversational", "basic", "unclear"]),
});

export const cvParse = z.object({
  full_name: z.string().nullable(),
  headline: z.string().nullable().describe("The CV's own title line, e.g. 'Full-stack engineer'. Not invented."),
  summary: z.string().nullable().describe("The CV's summary/profile paragraph as written, or null if none."),
  location: z.string().nullable(),
  experience: z.array(experience).describe("Newest first, as listed."),
  skills: z.array(parsedSkill),
  projects: z.array(project),
  education: z.array(education),
  languages: z.array(language),
  gaps_noticed: z.array(z.string()).describe("Things a reader would want clarified: undated roles, overlapping roles, skills named with no supporting role. Plain sentences. Empty if none."),
});
export type CvParse = z.infer<typeof cvParse>;
export type Experience = z.infer<typeof experience>;
export type Skill = z.infer<typeof skill>;
export type Project = z.infer<typeof project>;
export type Education = z.infer<typeof education>;
export type Language = z.infer<typeof language>;

// The DB row. `gaps_noticed` is not persisted — it is review-screen guidance.
export const profileRow = z.object({
  id: z.string().uuid(),
  headline: z.string().nullable(),
  summary: z.string().nullable(),
  experience: z.array(experience),
  skills: z.array(skill),
  projects: z.array(project),
  education: z.array(education),
  languages: z.array(language),
  raw_cv: z.string(),
  raw_cv_filename: z.string().nullable(),
  human_corrected: z.boolean(),
  corrected_at: z.string().nullable(),
  parsed_at: z.string().nullable(),
  parser_version: z.string().nullable(),
  updated_at: z.string(),
});
export type ProfileRow = z.infer<typeof profileRow>;

// What the review form submits. Same shapes, minus the parse-only fields.
export const profileEdit = profileRow.pick({
  headline: true,
  summary: true,
  experience: true,
  skills: true,
  projects: true,
  education: true,
  languages: true,
});
export type ProfileEdit = z.infer<typeof profileEdit>;
