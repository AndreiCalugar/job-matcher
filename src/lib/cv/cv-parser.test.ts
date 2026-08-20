import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { MODEL, PARSER_VERSION, TOOL_NAME, buildTool, parseCvText } from "./cv-parser";
import { normalise } from "./normalise";
import { cvParse, profileEdit } from "./schema";
import { computeSkillYears } from "./years";
import type { MessagesClient } from "@/lib/llm/tool-call";

// cv-001 is a synthetic CV in the shape of the Phase 1 persona. Nothing in
// it is a real person. expected.json is hand-authored (a target, not a
// recording) and is intentionally partial on skills.
const F = path.join(__dirname, "__fixtures__");
const cv = readFileSync(path.join(F, "cv-001.txt"), "utf8");
const NOW = new Date("2026-08-20T00:00:00Z");
const expected = JSON.parse(readFileSync(path.join(F, "cv-001.expected.json"), "utf8"));

function fake(input: unknown): MessagesClient & { calls: Anthropic.MessageCreateParamsNonStreaming[] } {
  const calls: Anthropic.MessageCreateParamsNonStreaming[] = [];
  return {
    calls,
    messages: {
      create: async (params) => {
        calls.push(params);
        return {
          id: "msg", type: "message", role: "assistant", model: MODEL, stop_reason: "tool_use", stop_sequence: null, stop_details: null, container: null, context_management: null,
          content: [{ type: "tool_use", id: "t", name: TOOL_NAME, input, caller: { type: "direct" } }],
          usage: { input_tokens: 3000, output_tokens: 2500, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
        } as unknown as Anthropic.Message;
      },
    },
  };
}

describe("cv schema", () => {
  it("fixture validates, and with computed years it round-trips through profileEdit", () => {
    const parsed = cvParse.parse(expected);
    const { full_name: _n, location: _l, gaps_noticed: _g, ...rest } = parsed;
    const stored = { ...rest, skills: rest.skills.map((s) => ({ ...s, years: computeSkillYears(rest.experience, s.name, NOW) })) };
    expect(profileEdit.parse(stored)).toEqual(stored);
  });

  it("tool schema is strict and has no unsupported keywords", () => {
    const tool = buildTool();
    const s = JSON.stringify(tool.input_schema);
    expect(tool.strict).toBe(true);
    expect(s).toContain('"additionalProperties":false');
    for (const kw of ["minLength", "minimum", "maximum", "format"]) expect(s).not.toContain(`"${kw}"`);
  });
});

describe("parseCvText", () => {
  it("uses the strong tier with effort, forces the tool, returns validated data", async () => {
    const client = fake(expected);
    const r = await parseCvText(client, cv);
    expect(r.parse.experience).toHaveLength(3);
    expect(r.parse.experience[1]!.employment_type).toBe("freelance");
    expect(PARSER_VERSION).toBe(`cv-parse.v2/${MODEL}`);
    const call = client.calls[0]!;
    expect(call.model).toBe("claude-opus-5");
    expect(call.tool_choice).toEqual({ type: "tool", name: TOOL_NAME });
    expect(call.output_config).toEqual({ effort: "high" });
    expect(String(call.messages[0]!.content)).toContain("Nordpay ApS");
  });

  it("rejects out-of-enum values from the model", async () => {
    const bad = { ...expected, languages: [{ name: "Danish", level: "ok-ish" }] };
    await expect(parseCvText(fake(bad), cv)).rejects.toMatchObject({ stage: "validation" });
  });
});

describe("computeSkillYears", () => {
  const exp = cvParse.parse(expected).experience;
  it("unions overlapping roles instead of summing them", () => {
    // React: Finlo 2019-08→2022-02, freelance 2020-06→now, Nordpay 2022-03→now.
    // Union is one continuous span 2019-08 → 2026-08 = 7.0y, not ~11y.
    expect(computeSkillYears(exp, "React", NOW)).toBe(7);
  });
  it("sums disjoint spans and matches case-insensitively", () => {
    // PostgreSQL only at Nordpay: 2022-03 → 2026-08 = 4y 5m = 4.4y
    expect(computeSkillYears(exp, "postgresql", NOW)).toBe(4.4);
  });
  it("returns null when no dated role lists the skill", () => {
    expect(computeSkillYears(exp, "Kubernetes", NOW)).toBeNull();
  });
  it("ignores roles with unparseable dates", () => {
    const broken = [{ ...exp[0]!, start: "someday" }];
    expect(computeSkillYears(broken, "React", NOW)).toBeNull();
  });
});

describe("normalise", () => {
  it("collapses PDF extraction artifacts without touching content", () => {
    expect(normalise("A  B\t\n\n\n\nC \r\nD")).toBe("A B\n\nC\nD");
  });
});
