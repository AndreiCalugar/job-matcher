"use server";

import { revalidatePath } from "next/cache";
import { scoreStoredJob } from "@/lib/match/pipeline";

export async function scoreJob(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const force = formData.get("force") === "1";
  if (!id) return;
  await scoreStoredJob(id, { force });
  revalidatePath("/");
  revalidatePath(`/jobs/${id}`);
}
