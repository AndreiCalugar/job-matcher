/**
 * One-off for the Phase 1–7 → Phase 8 transition: rows created before auth
 * existed have no owner. Attach them to the (single) user who created them.
 *
 *   npm run claim -- you@example.com
 *
 * Refuses to run if more than one auth user exists: at that point orphan
 * rows could belong to anyone and must be handled by hand.
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const p = path.resolve(__dirname, "..", ".env.local");
if (existsSync(p)) for (const line of readFileSync(p, "utf8").split("\n")) {
  const i = line.indexOf("=");
  if (i > 0 && !line.startsWith("#") && !(line.slice(0, i) in process.env)) process.env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}

async function main() {
  const email = process.argv[2]?.toLowerCase();
  if (!email) throw new Error("usage: npm run claim -- you@example.com");
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: users, error } = await sb.auth.admin.listUsers({ perPage: 10 });
  if (error) throw error;
  if (users.users.length !== 1) throw new Error(`expected exactly one auth user, found ${users.users.length}; refusing`);
  const user = users.users[0]!;
  if (user.email?.toLowerCase() !== email) throw new Error(`the only user is ${user.email}, not ${email}`);

  const profiles = await sb.from("profile").update({ user_id: user.id }).is("user_id", null).select("id");
  const ids = (profiles.data ?? []).map((r) => r.id);
  const newest = (await sb.from("profile").select("id").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).single()).data!.id;
  const jobs = await sb.from("job").update({ owner_profile_id: newest }).eq("source_id", "00000000-0000-0000-0000-000000000001").is("owner_profile_id", null).select("id");
  const usage = await sb.from("usage_event").update({ user_id: user.id, profile_id: newest }).is("user_id", null).select("id");
  const sources = await sb.from("source").select("id").neq("kind", "manual");
  for (const s of sources.data ?? []) await sb.from("source_subscription").upsert({ profile_id: newest, source_id: s.id }, { onConflict: "profile_id,source_id" });
  console.log({ user: user.id, profiles_claimed: ids.length, manual_jobs_claimed: jobs.data?.length ?? 0, usage_claimed: usage.data?.length ?? 0, sources_subscribed: sources.data?.length ?? 0 });
}
main().catch((e) => { console.error(e); process.exit(1); });
