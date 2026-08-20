import "@/lib/server-guard";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { supabase } from "@/lib/supabase/server";

// Everything the service holds about one user, as plain JSON. Jobs are
// included only where the user pasted them; shared feed postings are
// public data and referenced by id from matches.
export async function exportUserData(userId: string) {
  const { data: profiles } = await supabase.from("profile").select("*").eq("user_id", userId);
  const profileIds = (profiles ?? []).map((p) => p.id);
  const by = (table: string, col = "profile_id") =>
    profileIds.length ? supabase.from(table).select("*").in(col, profileIds).then((r) => r.data ?? []) : Promise.resolve([]);
  const [search_profiles, matches, kits, applications, usage, manual_jobs, subscriptions] = await Promise.all([
    by("search_profile"), by("match"), by("application_kit"), by("application"), by("usage_event"), by("job", "owner_profile_id"), by("source_subscription"),
  ]);
  const appIds = applications.map((a: { id: string }) => a.id);
  const interview_rounds = appIds.length ? (await supabase.from("interview_round").select("*").in("application_id", appIds)).data ?? [] : [];
  return {
    exported_at: new Date().toISOString(),
    user_id: userId,
    profiles, search_profiles, manual_jobs, matches, application_kits: kits, applications, interview_rounds, usage_events: usage, source_subscriptions: subscriptions,
  };
}

// Hard delete. profile cascades to search_profile, match, application_kit,
// application (→ interview_round), usage_event, source_subscription, and
// owned manual jobs. Then the auth user itself. Nothing is soft-deleted.
export async function deleteUserCompletely(userId: string): Promise<void> {
  const { error: pErr } = await supabase.from("profile").delete().eq("user_id", userId);
  if (pErr) throw new Error(`delete profile: ${pErr.message}`);
  const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw new Error(`delete auth user: ${error.message}`);
}
