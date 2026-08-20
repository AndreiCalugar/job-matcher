import "@/lib/server-guard";
import { z } from "zod";
import { KIT_COLUMNS, kitRow, type KitRow } from "@/lib/kit/schema";
import { supabase } from "@/lib/supabase/server";

export async function getLatestKit(jobId: string): Promise<KitRow | null> {
  const { data, error } = await supabase
    .from("application_kit")
    .select(KIT_COLUMNS)
    .eq("job_id", jobId)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`getLatestKit: ${error.message}`);
  return data ? kitRow.parse(data) : null;
}

export async function getKit(kitId: string): Promise<KitRow | null> {
  const { data, error } = await supabase.from("application_kit").select(KIT_COLUMNS).eq("id", kitId).maybeSingle();
  if (error) throw new Error(`getKit: ${error.message}`);
  return data ? kitRow.parse(data) : null;
}

const blocked = z.object({ id: z.string().uuid(), reasons: z.array(z.object({ check: z.string(), where: z.string(), detail: z.string() })), created_at: z.string() });
export async function getRecentBlocks(matchId: string) {
  const { data, error } = await supabase
    .from("blocked_generation")
    .select("id, reasons, created_at")
    .eq("match_id", matchId)
    .order("created_at", { ascending: false })
    .limit(3);
  if (error) throw new Error(`getRecentBlocks: ${error.message}`);
  return z.array(blocked).parse(data);
}
