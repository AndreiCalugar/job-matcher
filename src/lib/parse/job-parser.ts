import type Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import path from "node:path";
import { callTool, toolFromZod, type MessagesClient, type ToolCallResult } from "@/lib/llm/tool-call";
import { jobParse, type JobParse } from "@/lib/parse/schema";

export { ToolCallError as ParseError, type MessagesClient } from "@/lib/llm/tool-call";

// ---------------------------------------------------------------------------
// Versioning. parser_version is the cache key on job rows: a row is re-parsed
// only when the stored value differs from PARSER_VERSION. Bump PROMPT_VERSION
// on any prompt change; MODEL changes bump the composite automatically.
// ---------------------------------------------------------------------------
export const PROMPT_VERSION = "job-parse.v2";
// CLAUDE.md model routing: extraction is high-volume, low-judgement → cheap
// tier. Matching and kit generation (Phases 4–5) use the strong tier.
export const MODEL = "claude-haiku-4-5";
export const PARSER_VERSION = `${PROMPT_VERSION}/${MODEL}`;

export const TOOL_NAME = "record_job";

// Prompts live in versioned files, never inline (CLAUDE.md "Conventions").
export function loadPrompt(version: string = PROMPT_VERSION): string {
  return readFileSync(path.join(process.cwd(), "prompts", `${version}.md`), "utf8");
}

export function buildTool(): Anthropic.Tool {
  return toolFromZod(TOOL_NAME, "Record the structured extraction of one job posting.", jobParse);
}

export function buildUserMessage(text: string, url: string | null): string {
  const header = url ? `URL: ${url}\n\n` : "";
  return `${header}<posting>\n${text}\n</posting>`;
}

export type ParseResult = { parse: JobParse; usage: ToolCallResult<JobParse>["usage"]; model: string };

// One posting → one structured record. Pure with respect to the DB.
export async function parseJobText(client: MessagesClient, text: string, url: string | null): Promise<ParseResult> {
  const r = await callTool(client, {
    model: MODEL,
    max_tokens: 4096,
    system: loadPrompt(),
    tool: buildTool(),
    schema: jobParse,
    content: buildUserMessage(text, url),
  });
  return { parse: r.data, usage: r.usage, model: r.model };
}
