import "@/lib/server-guard";
import { z } from "zod";
import { supabase } from "@/lib/supabase/server";
import { APPLICATION_COLUMNS, applicationRow, type ApplicationRow } from "@/lib/tracking/schema";

export async function listApplications(profileId: string): Promise<ApplicationRow[]> {
  const { data, error } = await supabase.from("application").select(APPLICATION_COLUMNS).eq("profile_id", profileId).order("sent_at", { ascending: false }).limit(500);
  if (error) throw new Error(`listApplications: ${error.message}`);
  return z.array(applicationRow).parse(data);
}

export async function getApplicationForJob(jobId: string, profileId: string): Promise<ApplicationRow | null> {
  const { data, error } = await supabase.from("application").select(APPLICATION_COLUMNS).eq("job_id", jobId).eq("profile_id", profileId).order("sent_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(`getApplicationForJob: ${error.message}`);
  return data ? applicationRow.parse(data) : null;
}

const matchGaps = z.object({ verdict: z.string(), gaps: z.array(z.object({ skill: z.string(), severity: z.string() })) });
export async function listMatchGaps(profileId: string): Promise<z.infer<typeof matchGaps>[]> {
  const { data, error } = await supabase.from("match").select("verdict, gaps").eq("profile_id", profileId).limit(1000);
  if (error) throw new Error(`listMatchGaps: ${error.message}`);
  return z.array(matchGaps).parse(data);
}
