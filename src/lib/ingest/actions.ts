"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { detectAts } from "@/lib/ingest/detect";
import { getProfile } from "@/lib/cv/queries";
import { requireUser } from "@/lib/auth/session";
import { supabase } from "@/lib/supabase/server";

async function currentProfileId(): Promise<string | null> {
  const user = await requireUser();
  return (await getProfile(user.id))?.id ?? null;
}

async function subscribe(profileId: string, sourceId: string) {
  await supabase.from("source_subscription").upsert({ profile_id: profileId, source_id: sourceId }, { onConflict: "profile_id,source_id" });
}

export type AddSourceState = { status: "idle" } | { status: "added"; kind: string; identifier: string } | { status: "error"; message: string };

// Paste a careers URL → detect platform → company + source rows.
export async function addCompanySource(_prev: AddSourceState, formData: FormData): Promise<AddSourceState> {
  const profileId = await currentProfileId();
  if (!profileId) return { status: "error", message: "Add your CV first." };
  const url = String(formData.get("url") ?? "").trim();
  const nameInput = String(formData.get("name") ?? "").trim();
  const det = detectAts(url);
  if (!det) return { status: "error", message: "Could not recognise an ATS in that URL. Supported: Greenhouse, Lever, Ashby, Workable, Recruitee, Personio." };
  if (!["greenhouse", "lever", "ashby"].includes(det.kind)) {
    return { status: "error", message: `${det.kind} detected but its adapter is not built yet (Greenhouse, Lever, Ashby are).` };
  }
  const name = nameInput || det.company_guess;
  const company = await supabase
    .from("company")
    .upsert({ name, ats_kind: det.kind, ats_identifier: det.identifier }, { onConflict: "ats_kind,ats_identifier" })
    .select("id")
    .single();
  if (company.error) return { status: "error", message: company.error.message };
  const src = await supabase
    .from("source")
    .upsert({ kind: det.kind, identifier: det.identifier, company_id: company.data.id, enabled: true }, { onConflict: "kind,identifier" })
    .select("id")
    .single();
  if (src.error) return { status: "error", message: src.error.message };
  await subscribe(profileId, src.data.id);
  revalidatePath("/sources");
  return { status: "added", kind: det.kind, identifier: det.identifier };
}

const aggregatorInput = z.object({
  kind: z.enum(["arbeitnow", "jobicy", "remoteok"]),
  identifier: z.string().trim().default(""),
});
export async function addAggregatorSource(_prev: AddSourceState, formData: FormData): Promise<AddSourceState> {
  const profileId = await currentProfileId();
  if (!profileId) return { status: "error", message: "Add your CV first." };
  const parsed = aggregatorInput.safeParse({ kind: formData.get("kind"), identifier: formData.get("identifier") });
  if (!parsed.success) return { status: "error", message: "Pick an aggregator." };
  const { kind } = parsed.data;
  const identifier = parsed.data.identifier || (kind === "jobicy" ? "react,typescript,node" : "all");
  const config = kind === "jobicy" ? { geo: "europe" } : kind === "arbeitnow" ? { pages: 5 } : {};
  const { data, error } = await supabase.from("source").upsert({ kind, identifier, config, enabled: true }, { onConflict: "kind,identifier" }).select("id").single();
  if (error) return { status: "error", message: error.message };
  await subscribe(profileId, data.id);
  revalidatePath("/sources");
  return { status: "added", kind, identifier };
}

// Shared feeds: a user can only unsubscribe. A feed with no subscribers
// left is disabled so the cron stops polling it.
export async function setSourceEnabled(formData: FormData): Promise<void> {
  await deleteSource(formData);
}

export async function deleteSource(formData: FormData): Promise<void> {
  const profileId = await currentProfileId();
  const id = String(formData.get("id") ?? "");
  if (!profileId || !id) return;
  await supabase.from("source_subscription").delete().eq("profile_id", profileId).eq("source_id", id);
  const { count } = await supabase.from("source_subscription").select("source_id", { count: "exact", head: true }).eq("source_id", id);
  if ((count ?? 0) === 0) await supabase.from("source").update({ enabled: false }).eq("id", id);
  revalidatePath("/sources");
}

// ---- search profiles --------------------------------------------------------

const list = (v: FormDataEntryValue | null) => String(v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const spInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1),
  titles: z.array(z.string()),
  countries: z.array(z.string().length(2).transform((s) => s.toUpperCase())),
  remote_policy: z.array(z.enum(["remote", "hybrid", "onsite"])),
  seniority: z.array(z.enum(["junior", "mid", "senior", "staff", "lead"])),
  employment_type: z.array(z.enum(["permanent", "contract"])),
  exclude_keywords: z.array(z.string()),
  exclude_companies: z.array(z.string()),
  enabled: z.boolean(),
});
export type SaveSearchState = { status: "idle" } | { status: "saved" } | { status: "error"; message: string };

export async function saveSearchProfile(_prev: SaveSearchState, formData: FormData): Promise<SaveSearchState> {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  if (!profile) return { status: "error", message: "Add your CV first; search profiles belong to a profile." };
  const parsed = spInput.safeParse({
    id: formData.get("id") || undefined,
    name: formData.get("name"),
    titles: list(formData.get("titles")),
    countries: list(formData.get("countries")),
    remote_policy: formData.getAll("remote_policy"),
    seniority: formData.getAll("seniority"),
    employment_type: formData.getAll("employment_type"),
    exclude_keywords: list(formData.get("exclude_keywords")),
    exclude_companies: list(formData.get("exclude_companies")),
    enabled: formData.get("enabled") === "on",
  });
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return { status: "error", message: `${i?.path.join(".")}: ${i?.message}` };
  }
  const { id, ...row } = parsed.data;
  const q = id
    ? supabase.from("search_profile").update(row).eq("id", id).eq("profile_id", profile.id)
    : supabase.from("search_profile").insert({ ...row, profile_id: profile.id });
  const { error } = await q;
  if (error) return { status: "error", message: error.message };
  revalidatePath("/search");
  return { status: "saved" };
}

export async function deleteSearchProfile(formData: FormData): Promise<void> {
  const profileId = await currentProfileId();
  const id = String(formData.get("id") ?? "");
  if (!profileId) return;
  await supabase.from("search_profile").delete().eq("id", id).eq("profile_id", profileId);
  revalidatePath("/search");
}
