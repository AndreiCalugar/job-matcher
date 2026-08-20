import type Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { ProfileEdit } from "@/lib/cv/schema";
import { callTool, toolFromZod, type MessagesClient, type ToolCallResult } from "@/lib/llm/tool-call";
import type { JobRow } from "@/lib/jobs/schema";
import { matchParse, type MatchParse } from "@/lib/match/schema";

export const PROMPT_VERSION = "match.v1";
// CLAUDE.md model routing: match scoring + gap analysis is the core value →
// strong tier.
export const MODEL = "claude-opus-5";
export const TOOL_NAME = "record_match";

export function loadPrompt(version: string = PROMPT_VERSION): string {
  return readFileSync(path.join(process.cwd(), "prompts", `${version}.md`), "utf8");
}

export function buildTool(): Anthropic.Tool {
  return toolFromZod(TOOL_NAME, "Record the assessment of one profile against one job posting.", matchParse);
}

// Exactly what the model sees. Deterministic serialisation so the same
// inputs produce the same prompt (cache-friendly, replayable).
export type JobForMatch = Pick<
  JobRow,
  | "title" | "company_name" | "seniority" | "employment_type" | "remote_policy" | "location" | "country"
  | "required_skills" | "nice_to_have" | "comp_min" | "comp_max" | "comp_currency" | "comp_period" | "summary"
> & { raw_text: string };

export function buildUserMessage(profile: ProfileEdit, job: JobForMatch): string {
  const { raw_text, ...parsed } = job;
  return [
    "<profile>",
    JSON.stringify(profile, null, 1),
    "</profile>",
    "",
    "<job_parsed>",
    JSON.stringify(parsed, null, 1),
    "</job_parsed>",
    "",
    "<job_posting>",
    raw_text,
    "</job_posting>",
  ].join("\n");
}

export type MatchResult = { match: MatchParse; usage: ToolCallResult<MatchParse>["usage"]; model: string };

export async function scoreMatch(client: MessagesClient, profile: ProfileEdit, job: JobForMatch): Promise<MatchResult> {
  const r = await callTool(client, {
    model: MODEL,
    max_tokens: 8192,
    system: loadPrompt(),
    tool: buildTool(),
    schema: matchParse,
    content: buildUserMessage(profile, job),
    effort: "high",
  });
  return { match: r.data, usage: r.usage, model: r.model };
}
