import { z } from "zod";

// Output contract for the job parser. This is the tool's input_schema (via
// z.toJSONSchema) AND the runtime validator for what comes back. One source
// of truth; a drift between the two is impossible by construction.
//
// Every enum here mirrors a CHECK constraint in the Phase 2 migration.

export const seniority = z.enum(["junior", "mid", "senior", "staff", "lead", "unclear"]);
export const employmentType = z.enum(["permanent", "contract", "either", "unclear"]);
export const remotePolicy = z.enum(["remote", "hybrid", "onsite", "unclear"]);
export const compPeriod = z.enum(["year", "month", "day", "hour"]);
export const importance = z.enum(["must", "should", "nice"]);
export const redFlagKind = z.enum([
  "no_comp",
  "vague_scope",
  "multiple_roles",
  "wear_many_hats",
  "unrealistic_stack",
  "urgency_pressure",
  "unpaid_work",
  "agency_repost",
]);
export const severity = z.enum(["low", "medium", "high"]);

export const requiredSkill = z.object({
  name: z.string().min(1).describe("Normalised skill name, e.g. 'React', 'PostgreSQL'."),
  importance,
  years_wanted: z.number().int().min(0).max(30).nullable().describe("Years explicitly asked for, else null."),
});

export const redFlag = z.object({
  kind: redFlagKind,
  evidence: z.string().min(1).describe("Verbatim quote from the posting that supports the flag."),
  severity,
});

export const jobParse = z.object({
  title: z.string().min(1).describe("Job title as written, trimmed of req ids and location suffixes."),
  company_name: z.string().nullable().describe("Employer name if stated, else null."),
  seniority,
  employment_type: employmentType,
  remote_policy: remotePolicy,
  location: z.string().nullable().describe("City/region as written, e.g. 'Copenhagen' or 'EU'."),
  country: z.string().length(2).nullable().describe("ISO 3166-1 alpha-2, upper-case, or null."),
  required_skills: z.array(requiredSkill),
  nice_to_have: z.array(z.object({ name: z.string().min(1) })),
  comp_min: z.number().nullable(),
  comp_max: z.number().nullable(),
  comp_currency: z.string().length(3).nullable().describe("ISO 4217, upper-case, or null."),
  comp_period: compPeriod.nullable(),
  comp_stated: z.boolean(),
  red_flags: z.array(redFlag),
  summary: z.string().min(1),
  language: z.string().length(2).describe("ISO 639-1 of the posting text."),
});
export type JobParse = z.infer<typeof jobParse>;

// JSON Schema for the tool definition. strict tool use requires
// additionalProperties:false and a full `required` list, which Zod 4 emits
// for plain objects. Verified by a test so a Zod upgrade cannot silently
// break strictness.
export function jobParseJsonSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(jobParse, { target: "draft-7" }) as Record<string, unknown>;
  delete schema.$schema;
  return stripUnsupported(schema) as Record<string, unknown>;
}

// Strict tool schemas accept a JSON Schema subset: no length/range/format
// constraints. Zod still enforces them when the response is validated, so
// nothing is lost — the model just is not told about them.
const UNSUPPORTED = new Set(["minLength", "maxLength", "minimum", "maximum", "format", "pattern"]);
function stripUnsupported(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(stripUnsupported);
  if (node && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) {
      if (UNSUPPORTED.has(k)) continue;
      out[k] = stripUnsupported(v);
    }
    return out;
  }
  return node;
}
