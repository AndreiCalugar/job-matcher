import "@/lib/server-guard";
import { supabase } from "@/lib/supabase/server";
import { profileRow, type ProfileRow } from "@/lib/cv/schema";

export const PROFILE_COLUMNS =
  "id, headline, summary, experience, skills, projects, education, languages, raw_cv, raw_cv_filename, human_corrected, corrected_at, parsed_at, parser_version, updated_at";

// A user's current profile is their most recent row. A re-upload creates
// a new row rather than overwriting a corrected one — nothing is lost.
export async function getProfile(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from("profile")
    .select(PROFILE_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`getProfile: ${error.message}`);
  return data ? profileRow.parse(data) : null;
}

export async function getProfileById(id: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase.from("profile").select(PROFILE_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`getProfileById: ${error.message}`);
  return data ? profileRow.parse(data) : null;
}

// Every reviewed profile that has at least one enabled search profile:
// the cron scores for each of them.
export async function listReviewedProfileIds(): Promise<string[]> {
  const { data, error } = await supabase.from("profile").select("id, user_id").eq("human_corrected", true).order("created_at", { ascending: false });
  if (error) throw new Error(`listReviewedProfileIds: ${error.message}`);
  // newest row per user
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of data ?? []) {
    const k = p.user_id ?? p.id;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(p.id);
  }
  return out;
}
