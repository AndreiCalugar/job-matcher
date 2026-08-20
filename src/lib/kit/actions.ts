"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { generateKitForJob, type KitOutcome } from "@/lib/kit/pipeline";
import { angle } from "@/lib/kit/schema";
import { supabase } from "@/lib/supabase/server";

export type GenerateState = { status: "idle" } | KitOutcome;

export async function generateKitAction(_prev: GenerateState, formData: FormData): Promise<GenerateState> {
  const jobId = String(formData.get("job_id") ?? "");
  if (!jobId) return { status: "failed", error: "missing job id" };
  const name = String(formData.get("recipient_name") ?? "").trim();
  const role = String(formData.get("recipient_role") ?? "").trim();
  const channel = z.enum(["email", "linkedin", "form", "other"]).safeParse(formData.get("channel"));
  const requested = angle.safeParse(formData.get("angle"));
  const recipient = name ? { name, role: role || null, channel: channel.success ? channel.data : ("email" as const) } : null;
  const outcome = await generateKitForJob(jobId, { recipient, angle: requested.success ? requested.data : null });
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/jobs/${jobId}/kit`);
  return outcome;
}

// Accept/reject one CV change. The decision is data: which suggestions the
// user takes is a signal about the model.
export async function setChangeAccepted(formData: FormData): Promise<void> {
  const kitId = String(formData.get("kit_id") ?? "");
  const index = Number(formData.get("index"));
  const accepted = formData.get("accepted") === "1";
  const jobId = String(formData.get("job_id") ?? "");
  const { data } = await supabase.from("application_kit").select("cv_changes").eq("id", kitId).single();
  if (!data) return;
  const changes = (data.cv_changes as { accepted: boolean | null }[]).map((c, i) => (i === index ? { ...c, accepted } : c));
  await supabase.from("application_kit").update({ cv_changes: changes }).eq("id", kitId);
  revalidatePath(`/jobs/${jobId}/kit`);
}

// Save the user's edited letter/outreach. edited_by_user flips as soon as
// the text differs from what was generated.
export async function saveKitText(formData: FormData): Promise<void> {
  const kitId = String(formData.get("kit_id") ?? "");
  const jobId = String(formData.get("job_id") ?? "");
  const cover = String(formData.get("cover_letter") ?? "");
  const outreach = formData.get("outreach_body");
  const { data } = await supabase.from("application_kit").select("cover_letter, outreach_body").eq("id", kitId).single();
  if (!data) return;
  const edited = cover !== data.cover_letter || (outreach != null && String(outreach) !== (data.outreach_body ?? ""));
  await supabase
    .from("application_kit")
    .update({ cover_letter: cover, outreach_body: outreach == null ? data.outreach_body : String(outreach), edited_by_user: edited || undefined })
    .eq("id", kitId);
  revalidatePath(`/jobs/${jobId}/kit`);
}

// The human pressed send, elsewhere. Record exactly what went out.
export async function markSent(formData: FormData): Promise<void> {
  const kitId = String(formData.get("kit_id") ?? "");
  const jobId = String(formData.get("job_id") ?? "");
  const body = String(formData.get("final_sent_body") ?? "");
  await supabase
    .from("application_kit")
    .update({ final_sent_body: body, sent_at: new Date().toISOString() })
    .eq("id", kitId);
  revalidatePath(`/jobs/${jobId}/kit`);
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/");
}
