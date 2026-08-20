import type Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import path from "node:path";
import { callTool, toolFromZod, type MessagesClient, type ToolCallResult } from "@/lib/llm/tool-call";
import { cvParse, type CvParse } from "@/lib/cv/schema";

export const PROMPT_VERSION = "cv-parse.v2";
// CLAUDE.md model routing: CV → profile runs once and must be right →
// strong tier.
export const MODEL = "claude-opus-5";
export const PARSER_VERSION = `${PROMPT_VERSION}/${MODEL}`;
export const TOOL_NAME = "record_profile";

export function loadPrompt(version: string = PROMPT_VERSION): string {
  return readFileSync(path.join(process.cwd(), "prompts", `${version}.md`), "utf8");
}

export function buildTool(): Anthropic.Tool {
  return toolFromZod(TOOL_NAME, "Record the structured profile extracted from one CV.", cvParse);
}

export type CvParseResult = { parse: CvParse; usage: ToolCallResult<CvParse>["usage"]; model: string };

export async function parseCvText(client: MessagesClient, text: string): Promise<CvParseResult> {
  const r = await callTool(client, {
    model: MODEL,
    max_tokens: 16000,
    system: loadPrompt(),
    tool: buildTool(),
    schema: cvParse,
    content: `<cv>\n${text}\n</cv>`,
    effort: "high",
  });
  return { parse: r.data, usage: r.usage, model: r.model };
}
