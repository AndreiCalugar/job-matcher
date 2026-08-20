import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "@/lib/supabase/server";
import { manualRaw } from "@/lib/jobs/schema";
import { PARSER_VERSION, ParseError, parseJobText, type MessagesClient } from "@/lib/parse/job-parser";

let client: MessagesClient | undefined;
function getClient(): MessagesClient {
  // Lazy: the key is only required when a parse actually runs, so the app
  // boots (and the paste path works) without it.
  client ??= new Anthropic();
  return client;
}

export type PipelineOutcome =
  | { status: "parsed"; jobId: string }
  | { status: "cached"; jobId: string }
  | { status: "failed"; jobId: string; error: string };

// Parse one stored job. Idempotent on parser_version: a row already at the
// current version is returned untouched (CLAUDE.md: "a given job ad is parsed
// exactly once, ever"). On failure: retry once, then dead-letter and return —
// never throw into a batch.
export async function parseStoredJob(jobId: string, opts?: { force?: boolean }): Promise<PipelineOutcome> {
  const { data: job, error } = await supabase
    .from("job")
    .select("id, url, raw, parser_version")
    .eq("id", jobId)
    .single();
  if (error || !job) return { status: "failed", jobId, error: error?.message ?? "not found" };
  if (!opts?.force && job.parser_version === PARSER_VERSION) return { status: "cached", jobId };

  const raw = manualRaw.safeParse(job.raw);
  if (!raw.success) {
    await deadLetter(jobId, "unsupported raw shape", job.raw);
    return { status: "failed", jobId, error: "unsupported raw shape" };
  }

  let lastError = "";
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const result = await parseJobText(getClient(), raw.data.text, job.url);
      const p = result.parse;
      const update = await supabase
        .from("job")
        .update({
          title: p.title,
          company_name: p.company_name,
          seniority: p.seniority,
          employment_type: p.employment_type,
          remote_policy: p.remote_policy,
          location: p.location,
          country: p.country,
          required_skills: p.required_skills,
          nice_to_have: p.nice_to_have,
          comp_min: p.comp_min,
          comp_max: p.comp_max,
          comp_currency: p.comp_currency,
          comp_period: p.comp_period,
          comp_stated: p.comp_stated,
          red_flags: p.red_flags,
          summary: p.summary,
          language: p.language,
          parsed_at: new Date().toISOString(),
          parser_version: PARSER_VERSION,
        })
        .eq("id", jobId);
      if (update.error) throw new Error(`db update: ${update.error.message}`);

      // Meter every call, even before billing exists.
      await supabase.from("usage_event").insert({
        kind: "job_parsed",
        job_id: jobId,
        model: result.model,
        input_tokens: result.usage.input_tokens,
        output_tokens: result.usage.output_tokens,
        cache_read_tokens: result.usage.cache_read_tokens,
        cache_creation_tokens: result.usage.cache_creation_tokens,
        latency_ms: result.usage.latency_ms,
      });
      return { status: "parsed", jobId };
    } catch (e) {
      lastError = describe(e);
      // A bad API key or a 400 will not fix itself on retry; stop early.
      if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.BadRequestError) break;
    }
  }

  await deadLetter(jobId, lastError, { url: job.url, parser_version: PARSER_VERSION });
  return { status: "failed", jobId, error: lastError };
}

async function deadLetter(jobId: string, error: string, payload: unknown) {
  await supabase.from("failed_ingest").insert({ job_id: jobId, stage: "parse", error, payload });
}

function describe(e: unknown): string {
  if (e instanceof ParseError) return `${e.stage}: ${e.message}`;
  if (e instanceof Anthropic.APIError) return `api ${e.status}: ${e.message}`;
  if (e instanceof Error) return e.message;
  return String(e);
}
