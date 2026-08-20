import "@/lib/server-guard";
import { z } from "zod";
import { searchProfileRow, type SearchProfileRow } from "@/lib/ingest/filter";
import { supabase } from "@/lib/supabase/server";

export const sourceListRow = z.object({
  id: z.string().uuid(), kind: z.string(), identifier: z.string(), enabled: z.boolean(),
  config: z.record(z.string(), z.unknown()),
  last_run_at: z.string().nullable(), last_run_status: z.string().nullable(), last_error: z.string().nullable(),
  last_run_new: z.number().nullable(), last_run_seen: z.number().nullable(),
  company: z.object({ name: z.string() }).nullable(),
  created_at: z.string(),
});
export type SourceListRow = z.infer<typeof sourceListRow>;

export async function listSources(): Promise<SourceListRow[]> {
  const { data, error } = await supabase
    .from("source")
    .select("id, kind, identifier, enabled, config, last_run_at, last_run_status, last_error, last_run_new, last_run_seen, created_at, company:company_id(name)")
    .neq("kind", "manual")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listSources: ${error.message}`);
  return z.array(sourceListRow).parse(data);
}

export async function listSearchProfiles(): Promise<SearchProfileRow[]> {
  const { data, error } = await supabase.from("search_profile").select("*").order("created_at");
  if (error) throw new Error(`listSearchProfiles: ${error.message}`);
  return z.array(searchProfileRow).parse(data);
}
