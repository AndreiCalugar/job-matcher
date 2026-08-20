import type Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { ProfileEdit } from "@/lib/cv/schema";
import { callTool, toolFromZod, type MessagesClient, type ToolCallResult } from "@/lib/llm/tool-call";
import { buildProfileBlock } from "@/lib/match/matcher";
import type { Issue } from "@/lib/kit/gate";

// Anti-fabrication gate, layer 2: a cheap-tier model reads each sentence
// against the profile. Catches what lexical checks cannot — "led" vs
// "helped", an outcome attributed to the wrong role, a subtly inflated
// scope. Any `unsupported` → block.

export const VERIFY_PROMPT_VERSION = "kit-verify.v2";
export const VERIFY_MODEL = "claude-haiku-4-5";
export const VERIFY_TOOL = "record_verification";

export const verification = z.object({
  sentences: z.array(z.object({
    index: z.number().int().min(0),
    status: z.enum(["supported", "unsupported", "not_a_claim"]),
    note: z.string().nullable(),
  })),
});
export type Verification = z.infer<typeof verification>;

export function loadVerifyPrompt(): string {
  return readFileSync(path.join(process.cwd(), "prompts", `${VERIFY_PROMPT_VERSION}.md`), "utf8");
}

export function buildVerifyTool(): Anthropic.Tool {
  return toolFromZod(VERIFY_TOOL, "Record which sentences are supported by the profile.", verification);
}

export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export async function verifyKitText(
  client: MessagesClient,
  profile: ProfileEdit,
  texts: { cover_letter: string; outreach_body: string | null },
  postingText: string,
): Promise<{ issues: Issue[]; usage: ToolCallResult<Verification>["usage"]; model: string; sentences: string[] }> {
  const sentences = [...splitSentences(texts.cover_letter), ...splitSentences(texts.outreach_body ?? "")];
  const r = await callTool(client, {
    model: VERIFY_MODEL,
    max_tokens: 4096,
    system: [loadVerifyPrompt(), buildProfileBlock(profile)],
    tool: buildVerifyTool(),
    schema: verification,
    content: [
      "<job_posting>", postingText, "</job_posting>", "",
      "<sentences>",
      ...sentences.map((s, i) => `${i}. ${s}`),
      "</sentences>",
    ].join("\n"),
  });
  const issues: Issue[] = r.data.sentences
    .filter((s) => s.status === "unsupported")
    .map((s) => ({
      check: "verifier",
      where: `sentence ${s.index}`,
      detail: `${sentences[s.index] ?? "?"} — ${s.note ?? "unsupported"}`,
      level: "block" as const,
    }));
  return { issues, usage: r.usage, model: r.model, sentences };
}
