import "@/lib/server-guard";
import { z } from "zod";
import { supabase } from "@/lib/supabase/server";
import { JOB_ROW_COLUMNS, jobRow, type JobRow } from "@/lib/jobs/schema";

// Newest first; served by job_first_seen_idx. 200 is a Phase 1 ceiling, not
// pagination — revisit when the morning queue exists.
// Feed postings are shared; manual pastes are visible only to their owner.
export async function listJobs(profileId: string | null): Promise<JobRow[]> {
  const { data, error } = await supabase
    .from("job")
    .select(JOB_ROW_COLUMNS)
    .or(profileId ? `owner_profile_id.is.null,owner_profile_id.eq.${profileId}` : "owner_profile_id.is.null")
    // Closed = vanished from its feed. Kept for history, out of the queue.
    .is("closed_at", null)
    .order("first_seen", { ascending: false })
    .limit(300);
  if (error) throw new Error(`listJobs: ${error.message}`);
  // A row that fails the schema is a bug in our writer, not bad user input —
  // fail loudly so it is seen in Phase 1 rather than silently dropped.
  return z.array(jobRow).parse(data);
}

// profileId null = unscoped (cron/internal). With a profile, a job owned by
// someone else is "not found" rather than "forbidden": no existence leak.
export async function getJob(id: string, profileId?: string | null): Promise<JobRow | null> {
  const { data, error } = await supabase.from("job").select(`${JOB_ROW_COLUMNS}, owner_profile_id`).eq("id", id).maybeSingle();
  if (error) throw new Error(`getJob: ${error.message}`);
  if (!data) return null;
  const owner = (data as { owner_profile_id: string | null }).owner_profile_id;
  if (profileId !== undefined && owner !== null && owner !== profileId) return null;
  return jobRow.parse(data);
}
