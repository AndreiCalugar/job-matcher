import "server-only";
import { z } from "zod";
import { supabase } from "@/lib/supabase/server";

const failure = z.object({ id: z.string().uuid(), error: z.string(), created_at: z.string() });

export async function getParseFailures(jobId: string) {
  const { data, error } = await supabase
    .from("failed_ingest")
    .select("id, error, created_at")
    .eq("job_id", jobId)
    .eq("stage", "parse")
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) throw new Error(`getParseFailures: ${error.message}`);
  return z.array(failure).parse(data);
}
