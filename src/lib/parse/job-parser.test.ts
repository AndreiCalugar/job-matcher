import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import {
  MODEL,
  PARSER_VERSION,
  ParseError,
  TOOL_NAME,
  buildTool,
  loadPrompt,
  parseJobText,
  type MessagesClient,
} from "./job-parser";
import { jobParse, jobParseJsonSchema } from "./schema";

// NOTE: posting-001.expected.json is hand-authored as the *target* output for
// the prompt. It doubles as (a) the canned API response for the pipeline test
// and (b) a Zod round-trip check. It is not a recording of a live call.
const FIXTURES = path.join(__dirname, "__fixtures__");
const posting = readFileSync(path.join(FIXTURES, "posting-001.txt"), "utf8");
const expected = JSON.parse(readFileSync(path.join(FIXTURES, "posting-001.expected.json"), "utf8"));

function fakeClient(input: unknown, opts?: { omitTool?: boolean }): MessagesClient & { calls: Anthropic.MessageCreateParamsNonStreaming[] } {
  const calls: Anthropic.MessageCreateParamsNonStreaming[] = [];
  return {
    calls,
    messages: {
      create: async (params) => {
        calls.push(params);
        // Only the fields the parser reads are realistic; the rest exist to
        // satisfy the SDK's Message type.
        const content = opts?.omitTool
          ? [{ type: "text", text: "Sure, here is the job:", citations: null }]
          : [{ type: "tool_use", id: "toolu_1", name: TOOL_NAME, input, caller: { type: "direct" } }];
        return {
          container: null,
          id: "msg_1",
          type: "message",
          role: "assistant",
          model: MODEL,
          content,
          stop_reason: opts?.omitTool ? "end_turn" : "tool_use",
          stop_sequence: null,
          stop_details: null,
          context_management: null,
          usage: {
            input_tokens: 1200,
            output_tokens: 400,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 900,
            cache_creation: null,
            server_tool_use: null,
            service_tier: null,
            inference_geo: null,
            iterations: null,
            speed: null,
          },
        } as unknown as Anthropic.Message;
      },
    },
  };
}

describe("tool schema", () => {
  it("is strict-compatible: closed objects, full required lists, no unsupported keywords", () => {
    const schema = JSON.stringify(jobParseJsonSchema());
    expect(schema).toContain('"additionalProperties":false');
    for (const kw of ["minLength", "maxLength", "minimum", "maximum", "format", "pattern"]) {
      expect(schema, `contains ${kw}`).not.toContain(`"${kw}"`);
    }
    const tool = buildTool();
    expect(tool.strict).toBe(true);
    const props = Object.keys((tool.input_schema as { properties: object }).properties);
    expect((tool.input_schema as { required: string[] }).required.sort()).toEqual(props.sort());
  });

  it("fixture validates against the Zod schema", () => {
    expect(jobParse.parse(expected)).toEqual(expected);
  });
});

describe("prompt", () => {
  it("loads the versioned file and the version is stamped into parser_version", () => {
    expect(loadPrompt()).toContain("record_job");
    expect(PARSER_VERSION).toBe(`job-parse.v2/${MODEL}`);
  });
});

describe("parseJobText", () => {
  it("forces the tool, sends the posting, returns validated output and usage", async () => {
    const client = fakeClient(expected);
    const result = await parseJobText(client, posting, "https://example.com/j/1");

    expect(result.parse).toEqual(expected);
    expect(result.usage).toMatchObject({ input_tokens: 1200, output_tokens: 400, cache_read_tokens: 900 });

    const call = client.calls[0]!;
    expect(call.tool_choice).toEqual({ type: "tool", name: TOOL_NAME });
    expect(call.model).toBe(MODEL);
    expect(String(call.messages[0]!.content)).toContain("URL: https://example.com/j/1");
    expect(String(call.messages[0]!.content)).toContain("Senior Frontend Engineer");
  });

  it("rejects a response whose tool input fails the schema", async () => {
    const bad = { ...expected, seniority: "rockstar", country: "Denmark" };
    await expect(parseJobText(fakeClient(bad), posting, null)).rejects.toMatchObject({
      name: "ToolCallError",
      stage: "validation",
    } satisfies Partial<ParseError>);
  });

  it("rejects a response with no tool call", async () => {
    await expect(parseJobText(fakeClient(expected, { omitTool: true }), posting, null)).rejects.toMatchObject({
      stage: "no_tool_use",
    });
  });
});
