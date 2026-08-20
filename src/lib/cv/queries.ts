import "@/lib/server-guard";
import { supabase } from "@/lib/supabase/server";
import { profileRow, type ProfileRow } from "@/lib/cv/schema";

export const PROFILE_COLUMNS =
  "id, headline, summary, experience, skills, projects, education, languages, raw_cv, raw_cv_filename, human_corrected, corrected_at, parsed_at, parser_version, updated_at";

// One user, so "the profile" is the most recent row. A re-upload creates a
// new row rather than overwriting a corrected one — nothing is lost.
export async function getProfile(): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from("profile")
    .select(PROFILE_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`getProfile: ${error.message}`);
  return data ? profileRow.parse(data) : null;
}
