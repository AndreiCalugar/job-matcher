"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { detectAts } from "@/lib/ingest/detect";
import { getProfile } from "@/lib/cv/queries";
import { supabase } from "@/lib/supabase/server";

export type AddSourceState = { status: "idle" } | { status: "added"; kind: string; identifier: string } | { status: "error"; message: string };

// Paste a careers URL → detect platform → company + source rows.
export async function addCompanySource(_prev: AddSourceState, formData: FormData): Promise<AddSourceState> {
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
    .upsert({ kind: det.kind, identifier: det.identifier, company_id: company.data.id, enabled: true }, { onConflict: "kind,identifier" });
  if (src.error) return { status: "error", message: src.error.message };
  revalidatePath("/sources");
  return { status: "added", kind: det.kind, identifier: det.identifier };
}

const aggregatorInput = z.object({
  kind: z.enum(["arbeitnow", "jobicy", "remoteok"]),
  identifier: z.string().trim().default(""),
});
export async function addAggregatorSource(_prev: AddSourceState, formData: FormData): Promise<AddSourceState> {
  const parsed = aggregatorInput.safeParse({ kind: formData.get("kind"), identifier: formData.get("identifier") });
  if (!parsed.success) return { status: "error", message: "Pick an aggregator." };
  const { kind } = parsed.data;
  const identifier = parsed.data.identifier || (kind === "jobicy" ? "react,typescript,node" : "all");
  const config = kind === "jobicy" ? { geo: "europe" } : kind === "arbeitnow" ? { pages: 5 } : {};
  const { error } = await supabase.from("source").upsert({ kind, identifier, config, enabled: true }, { onConflict: "kind,identifier" });
  if (error) return { status: "error", message: error.message };
  revalidatePath("/sources");
  return { status: "added", kind, identifier };
}

export async function setSourceEnabled(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const enabled = formData.get("enabled") === "1";
  await supabase.from("source").update({ enabled }).eq("id", id);
  revalidatePath("/sources");
}

export async function deleteSource(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  // Jobs reference source with ON DELETE RESTRICT (Phase 1): disable instead of delete when it has jobs.
  const { count } = await supabase.from("job").select("id", { count: "exact", head: true }).eq("source_id", id);
  if ((count ?? 0) > 0) await supabase.from("source").update({ enabled: false }).eq("id", id);
  else await supabase.from("source").delete().eq("id", id);
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
  const profile = await getProfile();
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
    ? supabase.from("search_profile").update(row).eq("id", id)
    : supabase.from("search_profile").insert({ ...row, profile_id: profile.id });
  const { error } = await q;
  if (error) return { status: "error", message: error.message };
  revalidatePath("/search");
  return { status: "saved" };
}

export async function deleteSearchProfile(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  await supabase.from("search_profile").delete().eq("id", id);
  revalidatePath("/search");
}
