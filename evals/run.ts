/**
 * Eval harness for the matcher (CLAUDE.md "Technical credibility §1").
 *
 *   npm run eval                 # score all fixture jobs, print rho
 *   npm run eval -- --min 0.6    # exit 1 below this correlation
 *
 * Inputs
 *   evals/fixtures/jobs.json     [{ id, title, company, url, text }]
 *   evals/fixtures/ranking.json  ["id-best", ..., "id-worst"]   (hand-ranked)
 *   the current reviewed profile from the database (never committed)
 *
 * Parses are cached in evals/.cache by content hash (a job ad is parsed
 * once, ever). Matches are NOT cached: the point is to re-run them when the
 * prompt changes. Results are written to evals/results/<prompt>-<ts>.json.
 */
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { profileRow } from "../src/lib/cv/schema";
import { contentHash } from "../src/lib/jobs/hash";
import { verdictFor } from "../src/lib/match/bands";
import { PROMPT_VERSION, scoreMatch } from "../src/lib/match/matcher";
import { spearmanFromRanking } from "../src/lib/match/spearman";
import { PARSER_VERSION, parseJobText } from "../src/lib/parse/job-parser";
import { jobParse } from "../src/lib/parse/schema";

const ROOT = path.resolve(__dirname);
const fixtureJobs = z
  .array(z.object({ id: z.string(), title: z.string().optional(), company: z.string().optional(), url: z.string().nullable().optional(), text: z.string().min(80) }))
  .parse(JSON.parse(readFileSync(path.join(ROOT, "fixtures/jobs.json"), "utf8")));
const ranking = z.array(z.string()).parse(JSON.parse(readFileSync(path.join(ROOT, "fixtures/ranking.json"), "utf8")));

const minArg = process.argv.indexOf("--min");
const MIN_RHO = minArg > -1 ? Number(process.argv[minArg + 1]) : null;

loadEnvLocal();
const anthropic = new Anthropic();
const sb = createClient(must("SUPABASE_URL"), must("SUPABASE_SERVICE_ROLE_KEY"));

async function main() {
  const { data, error } = await sb.from("profile").select("*").eq("human_corrected", true).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error || !data) throw new Error(`No reviewed profile in the database (${error?.message ?? "empty"}).`);
  const profile = profileRow.parse(data);
  const profileEdit = {
    headline: profile.headline, summary: profile.summary, experience: profile.experience, skills: profile.skills,
    projects: profile.projects, education: profile.education, languages: profile.languages,
  };

  const unranked = fixtureJobs.filter((j) => !ranking.includes(j.id)).map((j) => j.id);
  if (unranked.length) console.warn(`warning: ${unranked.length} fixture job(s) not in ranking.json: ${unranked.join(", ")}`);

  const cacheDir = path.join(ROOT, ".cache");
  mkdirSync(cacheDir, { recursive: true });

  const scores: Record<string, number> = {};
  const rows: { id: string; title: string; score: number; verdict: string; human_rank: number | null; gaps: number; critical: number; ms: number }[] = [];

  for (const job of fixtureJobs) {
    // Parse (cached by content hash + parser version)
    const key = `${contentHash(job.text)}.${PARSER_VERSION.replace(/[^a-z0-9.-]/gi, "_")}.json`;
    const cachePath = path.join(cacheDir, key);
    let parsed;
    if (existsSync(cachePath)) parsed = jobParse.parse(JSON.parse(readFileSync(cachePath, "utf8")));
    else {
      process.stdout.write(`parse  ${job.id} … `);
      parsed = (await parseJobText(anthropic, job.text, job.url ?? null)).parse;
      writeFileSync(cachePath, JSON.stringify(parsed, null, 1));
      console.log("ok");
    }

    process.stdout.write(`score  ${job.id} … `);
    const t0 = Date.now();
    const r = await scoreMatch(anthropic, profileEdit, {
      title: parsed.title, company_name: parsed.company_name, seniority: parsed.seniority, employment_type: parsed.employment_type,
      remote_policy: parsed.remote_policy, location: parsed.location, country: parsed.country, required_skills: parsed.required_skills,
      nice_to_have: parsed.nice_to_have, comp_min: parsed.comp_min, comp_max: parsed.comp_max, comp_currency: parsed.comp_currency,
      comp_period: parsed.comp_period, summary: parsed.summary, raw_text: job.text,
    });
    const ms = Date.now() - t0;
    console.log(`${r.match.score} (${ms}ms)`);
    scores[job.id] = r.match.score;
    const hr = ranking.indexOf(job.id);
    rows.push({
      id: job.id, title: parsed.title, score: r.match.score, verdict: verdictFor(r.match.score),
      human_rank: hr === -1 ? null : hr + 1, gaps: r.match.gaps.length,
      critical: r.match.gaps.filter((g) => g.severity === "critical").length, ms,
    });
  }

  const { rho, n, missing } = spearmanFromRanking(ranking, scores);
  rows.sort((a, b) => b.score - a.score);
  console.log("");
  console.table(rows.map((r, i) => ({ model_rank: i + 1, human_rank: r.human_rank, score: r.score, verdict: r.verdict, gaps: `${r.gaps} (${r.critical} crit)`, id: r.id, title: r.title.slice(0, 48) })));
  console.log(`\nprompt ${PROMPT_VERSION} · n=${n}${missing.length ? ` · missing from scores: ${missing.join(", ")}` : ""}`);
  console.log(`Spearman ρ = ${rho.toFixed(3)}`);

  const outDir = path.join(ROOT, "results");
  mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const out = path.join(outDir, `${PROMPT_VERSION}-${stamp}.json`);
  writeFileSync(out, JSON.stringify({ prompt_version: PROMPT_VERSION, parser_version: PARSER_VERSION, profile_id: profile.id, rho, n, rows }, null, 1));
  console.log(`written ${path.relative(process.cwd(), out)}`);

  if (MIN_RHO != null && rho < MIN_RHO) {
    console.error(`\nFAIL: ρ ${rho.toFixed(3)} < ${MIN_RHO}`);
    process.exit(1);
  }
}

function must(k: string): string {
  const v = process.env[k];
  if (!v) throw new Error(`Missing env ${k}`);
  return v;
}

// Minimal .env.local loader so the script runs outside Next.
function loadEnvLocal() {
  const p = path.resolve(ROOT, "..", ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const i = line.indexOf("=");
    if (i < 1 || line.startsWith("#")) continue;
    const k = line.slice(0, i).trim();
    if (!(k in process.env)) process.env[k] = line.slice(i + 1).trim();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
