"use server";

import { revalidatePath } from "next/cache";
import { scoreStoredJob } from "@/lib/match/pipeline";
import { requireUser } from "@/lib/auth/session";
import { getProfile } from "@/lib/cv/queries";

export async function scoreJob(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const force = formData.get("force") === "1";
  if (!id) return;
  const user = await requireUser();
  const profile = await getProfile(user.id);
  if (!profile) return;
  await scoreStoredJob(id, profile.id, { force });
  revalidatePath("/");
  revalidatePath(`/jobs/${id}`);
}
