import "server-only";
import { z } from "zod";
import { supabase } from "@/lib/supabase/server";
import { jobRow, type JobRow } from "@/lib/jobs/schema";

// Newest first; served by job_first_seen_idx. 200 is a Phase 1 ceiling, not
// pagination — revisit when the morning queue exists.
export async function listJobs(): Promise<JobRow[]> {
  const { data, error } = await supabase
    .from("job")
    .select("id, url, raw, content_hash, first_seen, last_seen, source:source_id(kind)")
    .order("first_seen", { ascending: false })
    .limit(200);
  if (error) throw new Error(`listJobs: ${error.message}`);
  // A row that fails the schema is a bug in our writer, not bad user input —
  // fail loudly so it is seen in Phase 1 rather than silently dropped.
  return z.array(jobRow).parse(data);
}
