import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

// The one way this app talks to a model for data: a forced, strict tool
// call whose input is validated by the Zod schema that generated the tool.
// Prose is never parsed (CLAUDE.md "Output quality").

export type MessagesClient = {
  messages: { create: (params: Anthropic.MessageCreateParamsNonStreaming) => Promise<Anthropic.Message> };
};

export type ToolCallUsage = {
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
  latency_ms: number;
};

export type ToolCallResult<T> = { data: T; usage: ToolCallUsage; model: string };

export class ToolCallError extends Error {
  constructor(message: string, readonly stage: "no_tool_use" | "validation" | "refusal") {
    super(message);
    this.name = "ToolCallError";
  }
}

// Strict tool schemas accept a JSON Schema subset: no length/range/format
// constraints. Zod still enforces them at validation time, so nothing is
// lost — the model just is not told about them.
const UNSUPPORTED = new Set(["minLength", "maxLength", "minimum", "maximum", "format", "pattern"]);
export function stripUnsupported(node: unknown): unknown {
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

export function toolFromZod(name: string, description: string, schema: z.ZodType): Anthropic.Tool {
  const json = z.toJSONSchema(schema, { target: "draft-7" }) as Record<string, unknown>;
  delete json.$schema;
  return {
    name,
    description,
    strict: true,
    input_schema: stripUnsupported(json) as Anthropic.Tool.InputSchema,
  };
}

export async function callTool<S extends z.ZodType>(
  client: MessagesClient,
  params: {
    model: string;
    max_tokens: number;
    // One or more system blocks. Each gets a cache breakpoint, so a stable
    // prefix (prompt, then e.g. the profile) is read from cache on repeat
    // calls at ~10% of input price. Order: most stable first.
    system: string | string[];
    tool: Anthropic.Tool;
    schema: S;
    content: Anthropic.MessageParam["content"];
    // Adaptive thinking on strong-tier calls; omitted on cheap extraction.
    effort?: "low" | "medium" | "high";
    // Per-call overrides (eval harness); production callers omit them.
    modelOverride?: string;
  },
): Promise<ToolCallResult<z.infer<S>>> {
  const started = Date.now();
  const response = await client.messages.create({
    model: params.modelOverride ?? params.model,
    max_tokens: params.max_tokens,
    system: (Array.isArray(params.system) ? params.system : [params.system]).map((text) => ({
      type: "text" as const,
      text,
      cache_control: { type: "ephemeral" as const },
    })),
    tools: [params.tool],
    tool_choice: { type: "tool", name: params.tool.name },
    messages: [{ role: "user", content: params.content }],
    ...(params.effort ? { output_config: { effort: params.effort } } : {}),
  });
  const latency_ms = Date.now() - started;

  if (response.stop_reason === "refusal") {
    throw new ToolCallError(`Model refused: ${response.stop_details?.explanation ?? "no explanation"}`, "refusal");
  }
  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === params.tool.name,
  );
  if (!toolUse) {
    throw new ToolCallError(`No ${params.tool.name} call in response (stop_reason=${response.stop_reason})`, "no_tool_use");
  }
  const validated = params.schema.safeParse(toolUse.input);
  if (!validated.success) {
    throw new ToolCallError(`Schema validation failed: ${validated.error.message}`, "validation");
  }
  return {
    data: validated.data,
    model: response.model,
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      cache_read_tokens: response.usage.cache_read_input_tokens ?? 0,
      cache_creation_tokens: response.usage.cache_creation_input_tokens ?? 0,
      latency_ms,
    },
  };
}
