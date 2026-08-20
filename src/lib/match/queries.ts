import "@/lib/server-guard";
import { z } from "zod";
import { MATCH_COLUMNS, matchRow, type MatchRow } from "@/lib/match/schema";
import { PROMPT_VERSION } from "@/lib/match/matcher";
import { supabase } from "@/lib/supabase/server";

// Latest match for one job at the current prompt version (what the UI
// shows). Older prompt versions stay in the table for replay/comparison.
export async function getMatchForJob(jobId: string): Promise<MatchRow | null> {
  const { data, error } = await supabase
    .from("match")
    .select(MATCH_COLUMNS)
    .eq("job_id", jobId)
    .eq("prompt_version", PROMPT_VERSION)
    .order("computed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`getMatchForJob: ${error.message}`);
  return data ? matchRow.parse(data) : null;
}

// job_id → match, for the list. One query, not N.
export async function getMatchesByJob(jobIds: string[]): Promise<Map<string, MatchRow>> {
  if (jobIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from("match")
    .select(MATCH_COLUMNS)
    .in("job_id", jobIds)
    .eq("prompt_version", PROMPT_VERSION)
    .order("computed_at", { ascending: false });
  if (error) throw new Error(`getMatchesByJob: ${error.message}`);
  const map = new Map<string, MatchRow>();
  for (const row of z.array(matchRow).parse(data)) if (!map.has(row.job_id)) map.set(row.job_id, row);
  return map;
}
