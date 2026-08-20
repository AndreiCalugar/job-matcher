"use server";

import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase/server";
import { contentHash } from "@/lib/jobs/hash";
import { MANUAL_SOURCE_ID, pasteInput, type ManualRaw } from "@/lib/jobs/schema";

export type PasteState =
  | { status: "idle" }
  | { status: "stored"; id: string }
  | { status: "duplicate"; id: string; firstSeen: string }
  | { status: "invalid"; fieldErrors: { text?: string; url?: string } }
  | { status: "error"; message: string };

// Server action: the only write path (CLAUDE.md "no client-side DB writes").
// Signature matches React's useActionState.
export async function storePastedJob(
  _prev: PasteState,
  formData: FormData,
): Promise<PasteState> {
  const parsed = pasteInput.safeParse({
    text: formData.get("text"),
    url: formData.get("url"),
  });
  if (!parsed.success) {
    const f = parsed.error.flatten().fieldErrors;
    return {
      status: "invalid",
      fieldErrors: { text: f.text?.[0], url: f.url?.[0] },
    };
  }

  const { text, url } = parsed.data;
  const hash = contentHash(text);

  // Idempotency check before insert. For the manual channel external_id IS
  // the content hash, so the unique constraint would reject a duplicate
  // anyway — but reading first lets us tell the user it already exists and
  // bump last_seen instead of surfacing a constraint error.
  const existing = await supabase
    .from("job")
    .select("id, first_seen")
    .eq("source_id", MANUAL_SOURCE_ID)
    .eq("external_id", hash)
    .maybeSingle();

  if (existing.error) {
    return { status: "error", message: `Lookup failed: ${existing.error.message}` };
  }
  if (existing.data) {
    const touched = await supabase
      .from("job")
      .update({ last_seen: new Date().toISOString() })
      .eq("id", existing.data.id);
    if (touched.error) {
      return { status: "error", message: `Update failed: ${touched.error.message}` };
    }
    revalidatePath("/");
    return { status: "duplicate", id: existing.data.id, firstSeen: existing.data.first_seen };
  }

  const raw: ManualRaw = { kind: "manual", v: 1, text, ...(url ? { url } : {}) };
  const inserted = await supabase
    .from("job")
    .insert({
      source_id: MANUAL_SOURCE_ID,
      external_id: hash,
      content_hash: hash,
      url: url ?? null,
      raw,
    })
    .select("id")
    .single();

  if (inserted.error) {
    return { status: "error", message: `Insert failed: ${inserted.error.message}` };
  }
  revalidatePath("/");
  return { status: "stored", id: inserted.data.id };
}
