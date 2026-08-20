import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { cvParse } from "@/lib/cv/schema";
import type { MessagesClient } from "@/lib/llm/tool-call";
import { jobParse } from "@/lib/parse/schema";
import { BANDS, COLLAPSE_BELOW, verdictFor } from "./bands";
import { MODEL, PROMPT_VERSION, TOOL_NAME, buildProfileBlock, buildTool, buildUserMessage, scoreMatch } from "./matcher";
import { matchParse } from "./schema";
import { ranks, spearman, spearmanFromRanking } from "./spearman";

const here = (...p: string[]) => path.join(__dirname, ...p);
const expected = JSON.parse(readFileSync(here("__fixtures__/match-001.expected.json"), "utf8"));
const job = jobParse.parse(JSON.parse(readFileSync(here("../parse/__fixtures__/posting-001.expected.json"), "utf8")));
const cv = cvParse.parse(JSON.parse(readFileSync(here("../cv/__fixtures__/cv-001.expected.json"), "utf8")));
const profile = {
  headline: cv.headline, summary: cv.summary, experience: cv.experience,
  skills: cv.skills.map((s) => ({ ...s, years: null })), projects: cv.projects, education: cv.education, languages: cv.languages,
};
const jobForMatch = { ...job, raw_text: readFileSync(here("../parse/__fixtures__/posting-001.txt"), "utf8") };

function fake(input: unknown) {
  const calls: Anthropic.MessageCreateParamsNonStreaming[] = [];
  const client: MessagesClient = {
    messages: {
      create: async (params) => {
        calls.push(params);
        return {
          id: "m", type: "message", role: "assistant", model: MODEL, stop_reason: "tool_use", stop_sequence: null, stop_details: null, container: null, context_management: null,
          content: [{ type: "tool_use", id: "t", name: TOOL_NAME, input, caller: { type: "direct" } }],
          usage: { input_tokens: 4000, output_tokens: 900, cache_creation_input_tokens: 1200, cache_read_input_tokens: 0 },
        } as unknown as Anthropic.Message;
      },
    },
  };
  return { client, calls };
}

describe("bands", () => {
  it("maps scores to bands at the documented thresholds", () => {
    expect(verdictFor(100)).toBe("strong");
    expect(verdictFor(75)).toBe("strong");
    expect(verdictFor(74.9)).toBe("stretch");
    expect(verdictFor(55)).toBe("stretch");
    expect(verdictFor(54)).toBe("weak");
    expect(verdictFor(35)).toBe("weak");
    expect(verdictFor(34)).toBe("mismatch");
    expect(verdictFor(0)).toBe("mismatch");
    expect(COLLAPSE_BELOW).toBe(BANDS.find((b) => b.verdict === "stretch")!.min);
  });
});

describe("spearman", () => {
  it("is 1 for identical order, -1 for reversed, 0-ish for unrelated", () => {
    expect(spearman([1, 2, 3, 4, 5], [10, 20, 30, 40, 50])).toBe(1);
    expect(spearman([1, 2, 3, 4, 5], [50, 40, 30, 20, 10])).toBe(-1);
    expect(Math.abs(spearman([1, 2, 3, 4], [2, 4, 1, 3]))).toBeLessThan(0.5);
  });
  it("uses average ranks for ties", () => {
    expect(ranks([10, 20, 20, 30])).toEqual([1, 2.5, 2.5, 4]);
  });
  it("matches a textbook example", () => {
    // Wikipedia's IQ vs hours-of-TV example: rho = -29/165 ≈ -0.1758
    const iq = [106, 100, 86, 101, 99, 103, 97, 113, 112, 110];
    const tv = [7, 27, 2, 50, 28, 29, 20, 12, 6, 17];
    expect(spearman(iq, tv)).toBeCloseTo(-0.1758, 3);
  });
  it("derives rho from a best-first id list and a score map, reporting missing ids", () => {
    const r = spearmanFromRanking(["a", "b", "c", "d"], { a: 90, b: 70, c: 40, d: 10 });
    expect(r).toEqual({ rho: 1, n: 4, missing: [] });
    const r2 = spearmanFromRanking(["a", "b", "c", "d"], { a: 10, b: 40, d: 90 });
    expect(r2.n).toBe(3);
    expect(r2.missing).toEqual(["c"]);
    expect(r2.rho).toBe(-1);
  });
});

describe("matcher", () => {
  it("fixture validates; tool is strict; message carries profile, parsed job and raw posting", async () => {
    expect(matchParse.parse(expected)).toEqual(expected);
    expect(buildTool().strict).toBe(true);
    expect(buildProfileBlock(profile)).toContain("Nordpay ApS");
    const msg = buildUserMessage(jobForMatch);
    expect(msg).not.toContain("<profile>");
    expect(msg).toContain('"title": "Senior Frontend Engineer (React/TypeScript)"');
    expect(msg).toContain("<job_posting>");
  });

  it("scores via the strong tier, forces the tool, returns validated match + usage", async () => {
    const { client, calls } = fake(expected);
    const r = await scoreMatch(client, profile, jobForMatch);
    expect(r.match.score).toBe(62);
    expect(r.usage.cache_creation_tokens).toBe(1200);
    expect(calls[0]!.model).toBe("claude-opus-5");
    expect(calls[0]!.tool_choice).toEqual({ type: "tool", name: TOOL_NAME });
    expect(PROMPT_VERSION).toBe("match.v1");
    // profile rides in the cached system prefix, after the prompt
    const sys = calls[0]!.system as { text: string; cache_control?: unknown }[];
    expect(sys).toHaveLength(2);
    expect(sys[1]!.text).toContain("<profile>");
    expect(sys.every((b) => b.cache_control)).toBe(true);
  });

  it("honours model/effort overrides for the eval harness", async () => {
    const { client, calls } = fake(expected);
    await scoreMatch(client, profile, jobForMatch, { model: "claude-sonnet-5", effort: "medium" });
    expect(calls[0]!.model).toBe("claude-sonnet-5");
    expect(calls[0]!.output_config).toEqual({ effort: "medium" });
  });

  it("rejects a score outside 0–100 or an unknown severity", async () => {
    await expect(scoreMatch(fake({ ...expected, score: 140 }).client, profile, jobForMatch)).rejects.toMatchObject({ stage: "validation" });
    await expect(
      scoreMatch(fake({ ...expected, gaps: [{ ...expected.gaps[0], severity: "fatal" }] }).client, profile, jobForMatch),
    ).rejects.toMatchObject({ stage: "validation" });
  });
});
