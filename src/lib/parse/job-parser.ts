import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import path from "node:path";
import { jobParse, jobParseJsonSchema, type JobParse } from "@/lib/parse/schema";

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
// Read once per process; the file is static.
let cachedPrompt: string | undefined;
export function loadPrompt(): string {
  if (cachedPrompt) return cachedPrompt;
  cachedPrompt = readFileSync(path.join(process.cwd(), "prompts", `${PROMPT_VERSION}.md`), "utf8");
  return cachedPrompt;
}

export function buildTool(): Anthropic.Tool {
  return {
    name: TOOL_NAME,
    description: "Record the structured extraction of one job posting.",
    strict: true,
    input_schema: jobParseJsonSchema() as Anthropic.Tool.InputSchema,
  };
}

export function buildUserMessage(text: string, url: string | null): string {
  const header = url ? `URL: ${url}\n\n` : "";
  return `${header}<posting>\n${text}\n</posting>`;
}

export type ParseUsage = {
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  latency_ms: number;
};

export type ParseResult = { parse: JobParse; usage: ParseUsage; model: string };

// The minimal surface of the SDK this module uses. Tests pass a fake; the
// real client satisfies it structurally.
export type MessagesClient = {
  messages: { create: (params: Anthropic.MessageCreateParamsNonStreaming) => Promise<Anthropic.Message> };
};

export class ParseError extends Error {
  constructor(message: string, readonly stage: "api" | "no_tool_use" | "validation") {
    super(message);
    this.name = "ParseError";
  }
}

// One posting → one structured record. Pure with respect to the DB: callers
// decide what to do with the result. Throws ParseError; never returns a
// partially valid object.
export async function parseJobText(
  client: MessagesClient,
  text: string,
  url: string | null,
): Promise<ParseResult> {
  const started = Date.now();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: [{ type: "text", text: loadPrompt(), cache_control: { type: "ephemeral" } }],
    tools: [buildTool()],
    tool_choice: { type: "tool", name: TOOL_NAME },
    messages: [{ role: "user", content: buildUserMessage(text, url) }],
  });
  const latency_ms = Date.now() - started;

  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === TOOL_NAME,
  );
  if (!toolUse) {
    throw new ParseError(`No ${TOOL_NAME} tool call in response (stop_reason=${response.stop_reason})`, "no_tool_use");
  }

  const validated = jobParse.safeParse(toolUse.input);
  if (!validated.success) {
    throw new ParseError(`Schema validation failed: ${validated.error.message}`, "validation");
  }

  return {
    parse: validated.data,
    model: response.model,
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      cache_read_tokens: response.usage.cache_read_input_tokens ?? 0,
      latency_ms,
    },
  };
}
