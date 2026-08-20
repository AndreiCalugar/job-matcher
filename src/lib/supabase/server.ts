import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

// One client per server process. Phase 1 has no users and no sessions, so
// there is nothing per-request about it; the service role is the only
// principal and RLS (enabled, no policies) keeps the anon key useless.
export const supabase = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
