import type Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { ProfileEdit } from "@/lib/cv/schema";
import { callTool, toolFromZod, type MessagesClient, type ToolCallResult } from "@/lib/llm/tool-call";
import { buildProfileBlock, type JobForMatch } from "@/lib/match/matcher";
import type { MatchRow } from "@/lib/match/schema";
import { kitParse, type Angle, type KitParse } from "@/lib/kit/schema";

export const PROMPT_VERSION = "kit.v2";
// CLAUDE.md model routing: user-facing output quality → strong tier.
export const MODEL = "claude-opus-5";
export const TOOL_NAME = "record_kit";

export function loadPrompt(version: string = PROMPT_VERSION): string {
  return readFileSync(path.join(process.cwd(), "prompts", `${version}.md`), "utf8");
}

export function buildTool(): Anthropic.Tool {
  return toolFromZod(TOOL_NAME, "Record the application kit for one candidate and one posting.", kitParse);
}

export type Recipient = { name: string; role: string | null; channel: "email" | "linkedin" | "form" | "other" } | null;

export function buildUserMessage(
  job: JobForMatch,
  match: Pick<MatchRow, "score" | "verdict" | "matched_skills" | "gaps" | "premortem">,
  recipient: Recipient,
  angle: Angle | null,
): string {
  const { raw_text, ...parsed } = job;
  return [
    "<job_parsed>",
    JSON.stringify(parsed, null, 1),
    "</job_parsed>",
    "",
    "<job_posting>",
    raw_text,
    "</job_posting>",
    "",
    "<match>",
    JSON.stringify(match, null, 1),
    "</match>",
    "",
    recipient ? `<recipient>\n${JSON.stringify(recipient)}\n</recipient>` : "<recipient>none</recipient>",
    angle ? `<required_angle>${angle}</required_angle>` : "<required_angle>choose</required_angle>",
  ].join("\n");
}

export type KitResult = { kit: KitParse; usage: ToolCallResult<KitParse>["usage"]; model: string };

export async function generateKit(
  client: MessagesClient,
  profile: ProfileEdit,
  job: JobForMatch,
  match: Pick<MatchRow, "score" | "verdict" | "matched_skills" | "gaps" | "premortem">,
  recipient: Recipient,
  angle: Angle | null,
  opts: { model?: string; effort?: "low" | "medium" | "high" } = {},
): Promise<KitResult> {
  const r = await callTool(client, {
    model: MODEL,
    modelOverride: opts.model,
    max_tokens: 8192,
    // Same cached prefix order as the matcher: prompt, then profile.
    system: [loadPrompt(), buildProfileBlock(profile)],
    tool: buildTool(),
    schema: kitParse,
    content: buildUserMessage(job, match, recipient, angle),
    // medium: first live run at high took 175s for 4.8k output tokens. The
    // gate, not effort, is what guarantees correctness here.
    effort: opts.effort ?? "medium",
  });
  return { kit: r.data, usage: r.usage, model: r.model };
}
