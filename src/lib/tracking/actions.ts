"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabase } from "@/lib/supabase/server";
import { TERMINAL, daysBetween, responseKind, status } from "@/lib/tracking/schema";

// Status change = the user logging what happened. Moving past 'applied'
// for the first time records the first response; terminal states record
// closed_at. A reply is inferred from the status when the user does not
// say which kind it was.
export async function setApplicationStatus(formData: FormData): Promise<void> {
  const id = z.string().uuid().parse(formData.get("id"));
  const next = status.parse(formData.get("status"));
  const kindInput = responseKind.safeParse(formData.get("response_kind"));
  const { data: cur } = await supabase.from("application").select("status, sent_at, first_response_at").eq("id", id).single();
  if (!cur) return;

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status: next, updated_at: now };

  const impliesResponse = next !== "applied" && next !== "ghosted" && next !== "withdrawn";
  if (impliesResponse && !cur.first_response_at) {
    patch.first_response_at = now;
    patch.days_to_response = daysBetween(cur.sent_at, now);
    patch.response_kind = kindInput.success
      ? kindInput.data
      : next === "rejected" ? "human_reject" : next === "interview" || next === "final" ? "interview_invite" : "interest";
  } else if (kindInput.success) {
    patch.response_kind = kindInput.data;
  }
  if (TERMINAL.has(next)) patch.closed_at = now;
  else patch.closed_at = null;

  await supabase.from("application").update(patch).eq("id", id);
  revalidatePath("/applications");
  revalidatePath("/stats");
}

export async function saveApplicationNotes(formData: FormData): Promise<void> {
  const id = z.string().uuid().parse(formData.get("id"));
  const notes = String(formData.get("notes") ?? "").trim() || null;
  await supabase.from("application").update({ notes, updated_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/applications");
}
