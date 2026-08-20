import "@/lib/server-guard";
import { z } from "zod";
import { ADAPTERS } from "@/lib/ingest/adapters";
import { passesAny, searchProfileRow } from "@/lib/ingest/filter";
import { defaultHttp, normalisedPosting, type Http, type NormalisedPosting } from "@/lib/ingest/types";
import { contentHash } from "@/lib/jobs/hash";
import { JOB_ROW_COLUMNS, jobRow } from "@/lib/jobs/schema";
import { PROMPT_VERSION as MATCH_PROMPT } from "@/lib/match/matcher";
import { scoreStoredJob } from "@/lib/match/pipeline";
import { PARSER_VERSION } from "@/lib/parse/job-parser";
import { parseStoredJob } from "@/lib/parse/pipeline";
import { supabase } from "@/lib/supabase/server";
import { shouldGhost } from "@/lib/tracking/stats";
import { listReviewedProfileIds } from "@/lib/cv/queries";

// The unattended loop. Runs from GitHub Actions on a schedule and from
// `npm run ingest` locally. Every stage survives one bad item: a source
// that fails is logged on the source row and skipped; a job that fails to
// parse is dead-lettered by the parse pipeline; a job that fails to score
// is dead-lettered by the match pipeline. The run never throws past a
// source boundary.

export type RunOptions = {
  http?: Http;
  scoreCap?: number;     // max strong-tier scoring calls per run
  parseCap?: number;     // max parse calls per run
  log?: (line: string) => void;
  onlySourceId?: string;
};

export type RunReport = {
  sources: { id: string; kind: string; identifier: string; status: "ok" | "error" | "empty"; seen: number; inserted: number; touched: number; closed: number; error?: string }[];
  parsed: number;
  parseFailed: number;
  ghosted: number;
  scored: number;
  scoreSkippedByFilter: number;
  scoreFailed: number;
};

const sourceRow = z.object({
  id: z.string().uuid(), kind: z.string(), identifier: z.string(), enabled: z.boolean(),
  company_id: z.string().uuid().nullable(), config: z.record(z.string(), z.unknown()),
});

export async function runIngest(opts: RunOptions = {}): Promise<RunReport> {
  const http = opts.http ?? defaultHttp();
  const log = opts.log ?? (() => {});
  const report: RunReport = { sources: [], parsed: 0, parseFailed: 0, ghosted: 0, scored: 0, scoreSkippedByFilter: 0, scoreFailed: 0 };

  // ---- 0. ghost sweep: applied, no response, past the user's threshold ----
  const { data: prof } = await supabase.from("profile").select("ghost_after_days").eq("human_corrected", true).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const ghostAfter = prof?.ghost_after_days ?? 21;
  const { data: openApps } = await supabase.from("application").select("id, status, sent_at, first_response_at").eq("status", "applied");
  const now0 = new Date();
  const toGhost = (openApps ?? []).filter((a) => shouldGhost(a, ghostAfter, now0)).map((a) => a.id);
  if (toGhost.length) {
    await supabase.from("application").update({ status: "ghosted", closed_at: now0.toISOString(), updated_at: now0.toISOString() }).in("id", toGhost);
    report.ghosted = toGhost.length;
    log(`ghosted ${toGhost.length} application(s) after ${ghostAfter} days`);
  }

  // ---- 1. fetch every enabled feed/query source ---------------------------
  let q = supabase.from("source").select("id, kind, identifier, enabled, company_id, config").eq("enabled", true).neq("kind", "manual");
  if (opts.onlySourceId) q = q.eq("id", opts.onlySourceId);
  const { data: sourcesData, error: sErr } = await q;
  if (sErr) throw new Error(`sources: ${sErr.message}`);
  const sources = z.array(sourceRow).parse(sourcesData);

  for (const src of sources) {
    const adapter = ADAPTERS[src.kind as keyof typeof ADAPTERS];
    const entry: RunReport["sources"][number] = { id: src.id, kind: src.kind, identifier: src.identifier, status: "ok", seen: 0, inserted: 0, touched: 0, closed: 0 };
    report.sources.push(entry);
    if (!adapter) {
      entry.status = "error";
      entry.error = `no adapter for kind '${src.kind}'`;
      await logRun(src.id, entry);
      continue;
    }
    let postings: NormalisedPosting[];
    try {
      postings = z.array(normalisedPosting).parse(await adapter.fetch(src.identifier, src.config, http));
    } catch (e) {
      entry.status = "error";
      entry.error = e instanceof Error ? e.message : String(e);
      log(`source ${src.kind}/${src.identifier}: ${entry.error}`);
      await logRun(src.id, entry);
      continue;
    }
    entry.seen = postings.length;
    if (postings.length === 0) entry.status = "empty";

    const now = new Date().toISOString();
    const seenExternalIds: string[] = [];
    for (const p of postings) {
      seenExternalIds.push(p.external_id);
      const hash = contentHash(p.text);
      // Idempotent on (source_id, external_id).
      const existing = await supabase.from("job").select("id").eq("source_id", src.id).eq("external_id", p.external_id).maybeSingle();
      if (existing.data) {
        await supabase.from("job").update({ last_seen: now, closed_at: null }).eq("id", existing.data.id);
        entry.touched++;
        continue;
      }
      // Same ad from another source (aggregator vs ATS): touch, don't duplicate.
      const dup = await supabase.from("job").select("id").eq("content_hash", hash).maybeSingle();
      if (dup.data) {
        await supabase.from("job").update({ last_seen: now }).eq("id", dup.data.id);
        entry.touched++;
        continue;
      }
      const ins = await supabase.from("job").insert({
        source_id: src.id,
        company_id: src.company_id,
        external_id: p.external_id,
        url: p.url,
        content_hash: hash,
        raw: { kind: src.kind, v: 1, text: p.text, url: p.url, payload: p.raw },
        title: p.title,               // provisional; the parser overwrites
        company_name: p.company_name, // provisional; the parser overwrites
        location: p.location,
        posted_at: p.posted_at,
        first_seen: now,
        last_seen: now,
      });
      if (ins.error) {
        log(`insert ${src.kind}/${p.external_id}: ${ins.error.message}`);
        await supabase.from("failed_ingest").insert({ stage: "fetch", error: ins.error.message, payload: { source_id: src.id, external_id: p.external_id } });
        continue;
      }
      entry.inserted++;
    }

    // Postings that left the feed are closed (not deleted). Only when the
    // fetch succeeded and returned something, so a broken feed never
    // closes a whole company's jobs.
    if (entry.status === "ok") {
      const { data: open } = await supabase.from("job").select("id, external_id").eq("source_id", src.id).is("closed_at", null);
      const gone = (open ?? []).filter((j) => !seenExternalIds.includes(j.external_id)).map((j) => j.id);
      if (gone.length) {
        await supabase.from("job").update({ closed_at: now }).in("id", gone);
        entry.closed = gone.length;
      }
    }
    await logRun(src.id, entry);
    log(`source ${src.kind}/${src.identifier}: seen ${entry.seen}, new ${entry.inserted}, touched ${entry.touched}, closed ${entry.closed}`);
  }

  // ---- 2. parse anything unparsed (cheap tier), newest first ---------------
  const parseCap = opts.parseCap ?? 200;
  const { data: unparsed } = await supabase
    .from("job")
    .select("id")
    .or(`parser_version.is.null,parser_version.neq.${PARSER_VERSION}`)
    .is("closed_at", null)
    .order("first_seen", { ascending: false })
    .limit(parseCap);
  for (const j of unparsed ?? []) {
    const r = await parseStoredJob(j.id);
    if (r.status === "parsed") report.parsed++;
    else if (r.status === "failed") report.parseFailed++;
  }
  log(`parsed ${report.parsed}, failed ${report.parseFailed}`);

  // ---- 3. score, per reviewed profile, what its search profiles allow ------
  // Shared feed jobs only; each user's manual pastes are scored on paste.
  const scoreCap = opts.scoreCap ?? 25; // per profile per run
  const { data: candidates } = await supabase
    .from("job")
    .select(JOB_ROW_COLUMNS)
    .not("parsed_at", "is", null)
    .is("closed_at", null)
    .is("owner_profile_id", null)
    .order("first_seen", { ascending: false })
    .limit(400);
  const jobs = (candidates ?? []).map((r) => jobRow.parse(r));

  for (const profileId of await listReviewedProfileIds()) {
    const { data: spData } = await supabase.from("search_profile").select("*").eq("enabled", true).eq("profile_id", profileId);
    const profiles = z.array(searchProfileRow).parse(spData ?? []);
    if (profiles.length === 0) {
      log(`profile ${profileId.slice(0, 8)}: no enabled search profile — nothing auto-scored`);
      continue;
    }
    const { data: scoredRows } = await supabase.from("match").select("job_id").eq("prompt_version", MATCH_PROMPT).eq("profile_id", profileId);
    const already = new Set((scoredRows ?? []).map((m) => m.job_id));
    let budget = scoreCap;
    let scored = 0, skipped = 0, failed = 0;
    for (const job of jobs) {
      if (budget <= 0) break;
      if (already.has(job.id)) continue;
      if (!passesAny({ ...job, text: job.raw.text }, profiles)) { skipped++; continue; }
      const r = await scoreStoredJob(job.id, profileId);
      if (r.status === "scored") { scored++; budget--; }
      else if (r.status === "failed") failed++;
      else if (r.status === "skipped") { log(`profile ${profileId.slice(0, 8)}: scoring skipped: ${r.reason}`); break; }
    }
    report.scored += scored; report.scoreSkippedByFilter += skipped; report.scoreFailed += failed;
    log(`profile ${profileId.slice(0, 8)}: scored ${scored}, skipped by filter ${skipped}, failed ${failed}`);
  }
  return report;
}

async function logRun(sourceId: string, e: RunReport["sources"][number]) {
  await supabase.from("source").update({
    last_run_at: new Date().toISOString(),
    last_run_status: e.status,
    last_error: e.error ?? null,
    last_run_new: e.inserted,
    last_run_seen: e.seen,
  }).eq("id", sourceId);
}
