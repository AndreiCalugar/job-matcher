import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { getProfile } from "@/lib/cv/queries";
import { getJob } from "@/lib/jobs/queries";
import { atsExport } from "@/lib/kit/ats-export";
import { deterministicGate, gatePassed, type Issue } from "@/lib/kit/gate";
import { MODEL, PROMPT_VERSION, generateKit, type Recipient } from "@/lib/kit/generator";
import type { Angle } from "@/lib/kit/schema";
import { verifyKitText } from "@/lib/kit/verifier";
import { ToolCallError, type MessagesClient } from "@/lib/llm/tool-call";
import { getMatchForJob } from "@/lib/match/queries";
import { supabase } from "@/lib/supabase/server";

let client: MessagesClient | undefined;
const getClient = () => (client ??= new Anthropic());

export type KitOutcome =
  | { status: "generated"; kitId: string }
  | { status: "blocked"; issues: Issue[] }
  | { status: "skipped"; reason: "no_profile" | "profile_unreviewed" | "no_match" }
  | { status: "failed"; error: string };

// Generate → deterministic gate → verifier → store. A kit that fails either
// gate is never stored as a kit; it goes to blocked_generation with the
// reasons. Blocked, not warned (CLAUDE.md "Anti-fabrication gate").
export async function generateKitForJob(
  jobId: string,
  input: { recipient: Recipient; angle: Angle | null },
): Promise<KitOutcome> {
  const profile = await getProfile();
  if (!profile) return { status: "skipped", reason: "no_profile" };
  if (!profile.human_corrected) return { status: "skipped", reason: "profile_unreviewed" };
  const [job, match] = await Promise.all([getJob(jobId), getMatchForJob(jobId)]);
  if (!job || !job.parsed_at || !match) return { status: "skipped", reason: "no_match" };

  const profileEdit = {
    headline: profile.headline, summary: profile.summary, experience: profile.experience,
    skills: profile.skills, projects: profile.projects, education: profile.education, languages: profile.languages,
  };
  const jobForMatch = {
    title: job.title, company_name: job.company_name, seniority: job.seniority, employment_type: job.employment_type,
    remote_policy: job.remote_policy, location: job.location, country: job.country, required_skills: job.required_skills,
    nice_to_have: job.nice_to_have, comp_min: job.comp_min, comp_max: job.comp_max, comp_currency: job.comp_currency,
    comp_period: job.comp_period, summary: job.summary, raw_text: job.raw.text,
  };

  try {
    const gen = await generateKit(getClient(), profileEdit, jobForMatch, match, input.recipient, input.angle);
    await meter("kit_generated", jobId, gen.model, gen.usage);

    const det = deterministicGate(profileEdit, gen.kit, job.raw.text, {
      allowTerms: [input.recipient?.name, input.recipient?.role].filter((t): t is string => !!t),
    });
    let verifierIssues: Issue[] = [];
    let verifierModel: string | null = null;
    if (gatePassed(det)) {
      // Only pay for the verifier when the hard checks pass.
      const v = await verifyKitText(getClient(), profileEdit, { cover_letter: gen.kit.cover_letter, outreach_body: gen.kit.outreach_body }, job.raw.text);
      verifierIssues = v.issues;
      verifierModel = v.model;
      await meter("kit_generated", jobId, v.model, v.usage);
    }
    const issues = [...det, ...verifierIssues];

    if (!gatePassed(issues)) {
      await supabase.from("blocked_generation").insert({
        match_id: match.id,
        prompt_version: PROMPT_VERSION,
        model_version: gen.model,
        reasons: issues,
        payload: gen.kit,
      });
      return { status: "blocked", issues: issues.filter((i) => i.level === "block") };
    }

    const emphasis = (job.required_skills ?? []).filter((s) => s.importance === "must").map((s) => s.name);
    const { count } = await supabase.from("application_kit").select("id", { count: "exact", head: true }).eq("match_id", match.id);
    const inserted = await supabase
      .from("application_kit")
      .insert({
        match_id: match.id,
        job_id: jobId,
        profile_id: profile.id,
        cv_changes: gen.kit.cv_changes.map((c) => ({ ...c, accepted: null })),
        ats_export: atsExport(profileEdit, { emphasis }),
        cover_letter: gen.kit.cover_letter,
        outreach_subject: gen.kit.outreach_subject,
        outreach_body: gen.kit.outreach_body,
        gap_handling: gen.kit.gap_handling,
        recipient_name: input.recipient?.name ?? null,
        recipient_role: input.recipient?.role ?? null,
        channel: input.recipient?.channel ?? null,
        angle: gen.kit.angle,
        claims: gen.kit.claims,
        gate_report: { deterministic: det, verifier: verifierIssues, verifier_model: verifierModel },
        version: (count ?? 0) + 1,
        model_version: gen.model,
        prompt_version: PROMPT_VERSION,
      })
      .select("id")
      .single();
    if (inserted.error) throw new Error(`db: ${inserted.error.message}`);
    return { status: "generated", kitId: inserted.data.id };
  } catch (e) {
    const error = describe(e);
    await supabase.from("failed_ingest").insert({ job_id: jobId, stage: "kit", error, payload: { model: MODEL, prompt_version: PROMPT_VERSION } });
    return { status: "failed", error };
  }
}

async function meter(kind: "kit_generated", jobId: string, model: string, u: { input_tokens: number; output_tokens: number; cache_read_tokens: number; cache_creation_tokens: number; latency_ms: number }) {
  await supabase.from("usage_event").insert({
    kind, job_id: jobId, model,
    input_tokens: u.input_tokens, output_tokens: u.output_tokens,
    cache_read_tokens: u.cache_read_tokens, cache_creation_tokens: u.cache_creation_tokens, latency_ms: u.latency_ms,
  });
}

function describe(e: unknown): string {
  if (e instanceof ToolCallError) return `${e.stage}: ${e.message}`;
  if (e instanceof Anthropic.APIError) return `api ${e.status}: ${e.message}`;
  if (e instanceof Error) return e.message;
  return String(e);
}
