import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { getProfile } from "@/lib/cv/queries";
import { getJob } from "@/lib/jobs/queries";
import { ToolCallError, type MessagesClient } from "@/lib/llm/tool-call";
import { verdictFor } from "@/lib/match/bands";
import { MODEL, PROMPT_VERSION, scoreMatch } from "@/lib/match/matcher";
import { supabase } from "@/lib/supabase/server";

let client: MessagesClient | undefined;
const getClient = () => (client ??= new Anthropic());

export type ScoreOutcome =
  | { status: "scored"; matchId: string; score: number }
  | { status: "cached"; matchId: string; score: number }
  | { status: "skipped"; reason: "no_profile" | "profile_unreviewed" | "job_unparsed" }
  | { status: "failed"; error: string };

// Score one job against the current reviewed profile. Cached on
// (job, profile, prompt_version): a given pairing is scored once per prompt
// version, ever. Refuses to run against an unreviewed profile — the review
// screen is not optional.
export async function scoreStoredJob(jobId: string, opts?: { force?: boolean }): Promise<ScoreOutcome> {
  const profile = await getProfile();
  if (!profile) return { status: "skipped", reason: "no_profile" };
  if (!profile.human_corrected) return { status: "skipped", reason: "profile_unreviewed" };

  const job = await getJob(jobId);
  if (!job || !job.parsed_at) return { status: "skipped", reason: "job_unparsed" };

  if (!opts?.force) {
    const existing = await supabase
      .from("match")
      .select("id, score")
      .eq("job_id", jobId)
      .eq("profile_id", profile.id)
      .eq("prompt_version", PROMPT_VERSION)
      .maybeSingle();
    if (existing.data) return { status: "cached", matchId: existing.data.id, score: Number(existing.data.score) };
  }

  try {
    const result = await scoreMatch(
      getClient(),
      {
        headline: profile.headline,
        summary: profile.summary,
        experience: profile.experience,
        skills: profile.skills,
        projects: profile.projects,
        education: profile.education,
        languages: profile.languages,
      },
      {
        title: job.title,
        company_name: job.company_name,
        seniority: job.seniority,
        employment_type: job.employment_type,
        remote_policy: job.remote_policy,
        location: job.location,
        country: job.country,
        required_skills: job.required_skills,
        nice_to_have: job.nice_to_have,
        comp_min: job.comp_min,
        comp_max: job.comp_max,
        comp_currency: job.comp_currency,
        comp_period: job.comp_period,
        summary: job.summary,
        raw_text: job.raw.text,
      },
    );
    const m = result.match;
    const row = {
      job_id: jobId,
      profile_id: profile.id,
      score: m.score,
      verdict: verdictFor(m.score),
      matched_skills: m.matched_skills,
      gaps: m.gaps,
      reasoning: m.reasoning,
      premortem: m.premortem,
      model_version: result.model,
      prompt_version: PROMPT_VERSION,
      computed_at: new Date().toISOString(),
    };
    const upsert = await supabase
      .from("match")
      .upsert(row, { onConflict: "job_id,profile_id,prompt_version" })
      .select("id")
      .single();
    if (upsert.error) throw new Error(`db: ${upsert.error.message}`);

    await supabase.from("usage_event").insert({
      kind: "match_scored",
      job_id: jobId,
      model: result.model,
      input_tokens: result.usage.input_tokens,
      output_tokens: result.usage.output_tokens,
      cache_read_tokens: result.usage.cache_read_tokens,
      cache_creation_tokens: result.usage.cache_creation_tokens,
      latency_ms: result.usage.latency_ms,
    });
    return { status: "scored", matchId: upsert.data.id, score: m.score };
  } catch (e) {
    const error = describe(e);
    await supabase.from("failed_ingest").insert({ job_id: jobId, stage: "match", error, payload: { model: MODEL, prompt_version: PROMPT_VERSION } });
    return { status: "failed", error };
  }
}

function describe(e: unknown): string {
  if (e instanceof ToolCallError) return `${e.stage}: ${e.message}`;
  if (e instanceof Anthropic.APIError) return `api ${e.status}: ${e.message}`;
  if (e instanceof Error) return e.message;
  return String(e);
}
