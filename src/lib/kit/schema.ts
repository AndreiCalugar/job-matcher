import { z } from "zod";

export const angle = z.enum(["domain_overlap", "solved_this_exact_problem", "gap_acknowledged", "builder_track_record"]);
export type Angle = z.infer<typeof angle>;

export const ANGLE_LABEL: Record<Angle, string> = {
  domain_overlap: "Domain overlap",
  solved_this_exact_problem: "Solved this exact problem",
  gap_acknowledged: "Gap acknowledged head-on",
  builder_track_record: "Builder track record",
};

// One suggested edit to the user's own CV. `path` addresses the profile
// (e.g. "experience[0].bullets[2]", "summary", "skills"). `current` must be
// the value actually at that path — the gate checks it — so the model
// cannot invent what the CV says today.
export const cvChange = z.object({
  path: z.string().min(1).describe("Profile path: 'summary', 'headline', 'experience[i].bullets[j]', 'experience[i]' (to reorder/emphasise), 'skills' (to reorder)."),
  current: z.string().describe("The current text at that path, verbatim. Empty string for a pure reorder."),
  suggested: z.string().min(1).describe("The replacement text, or an instruction like 'Move this role above Finlo A/S'."),
  reason: z.string().min(1).describe("One line: which requirement in the posting this serves."),
  severity: z.enum(["critical", "important", "polish"]),
});

export const claim = z.object({
  claim: z.string().min(1).describe("A factual statement made in the cover letter or outreach: a technology used, a duration, a company, a number, an outcome."),
  source_path: z.string().min(1).describe("Profile path that supports it, e.g. 'experience[1].bullets[0]' or 'skills[3]'. Use 'posting' only for facts about the job itself."),
});

export const kitParse = z.object({
  angle,
  angle_reason: z.string().min(1),
  cv_changes: z.array(cvChange),
  cover_letter: z.string().min(1).describe("Under 250 words. Plain. Names the specific overlap. No adjectives about the candidate's character."),
  outreach_subject: z.string().nullable(),
  outreach_body: z.string().nullable().describe("Under 120 words. Only when a recipient is given; otherwise null."),
  gap_handling: z.array(z.object({ gap: z.string().min(1), approach: z.string().min(1) })),
  claims: z.array(claim).describe("Every factual claim about the candidate made anywhere in the generated text, with its source. The gate blocks the kit if any claim cannot be traced."),
});
export type KitParse = z.infer<typeof kitParse>;

export const kitRow = z.object({
  id: z.string().uuid(),
  match_id: z.string().uuid(),
  job_id: z.string().uuid(),
  cv_changes: z.array(cvChange.extend({ accepted: z.boolean().nullable() })),
  ats_export: z.string(),
  cover_letter: z.string(),
  outreach_subject: z.string().nullable(),
  outreach_body: z.string().nullable(),
  gap_handling: z.array(z.object({ gap: z.string(), approach: z.string() })),
  recipient_name: z.string().nullable(),
  recipient_role: z.string().nullable(),
  channel: z.enum(["email", "linkedin", "form", "other"]).nullable(),
  angle,
  claims: z.array(claim),
  gate_report: z.unknown(),
  version: z.number(),
  edited_by_user: z.boolean(),
  final_sent_body: z.string().nullable(),
  model_version: z.string(),
  prompt_version: z.string(),
  generated_at: z.string(),
  sent_at: z.string().nullable(),
});
export type KitRow = z.infer<typeof kitRow>;
export const KIT_COLUMNS =
  "id, match_id, job_id, cv_changes, ats_export, cover_letter, outreach_subject, outreach_body, gap_handling, recipient_name, recipient_role, channel, angle, claims, gate_report, version, edited_by_user, final_sent_body, model_version, prompt_version, generated_at, sent_at";
