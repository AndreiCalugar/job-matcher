import "@/lib/server-guard";
import { z } from "zod";
import { supabase } from "@/lib/supabase/server";
import { JOB_ROW_COLUMNS, jobRow, type JobRow } from "@/lib/jobs/schema";

// Newest first; served by job_first_seen_idx. 200 is a Phase 1 ceiling, not
// pagination — revisit when the morning queue exists.
export async function listJobs(): Promise<JobRow[]> {
  const { data, error } = await supabase
    .from("job")
    .select(JOB_ROW_COLUMNS)
    // Closed = vanished from its feed. Kept for history, out of the queue.
    .is("closed_at", null)
    .order("first_seen", { ascending: false })
    .limit(300);
  if (error) throw new Error(`listJobs: ${error.message}`);
  // A row that fails the schema is a bug in our writer, not bad user input —
  // fail loudly so it is seen in Phase 1 rather than silently dropped.
  return z.array(jobRow).parse(data);
}

export async function getJob(id: string): Promise<JobRow | null> {
  const { data, error } = await supabase.from("job").select(JOB_ROW_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`getJob: ${error.message}`);
  return data ? jobRow.parse(data) : null;
}
