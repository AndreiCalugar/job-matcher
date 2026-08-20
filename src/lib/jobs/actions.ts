"use server";

import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase/server";
import { contentHash } from "@/lib/jobs/hash";
import { MANUAL_SOURCE_ID, pasteInput, type ManualRaw } from "@/lib/jobs/schema";
import { parseStoredJob } from "@/lib/parse/pipeline";
import { scoreStoredJob } from "@/lib/match/pipeline";
import { requireUser } from "@/lib/auth/session";
import { getProfile } from "@/lib/cv/queries";

export type PasteState =
  | { status: "idle" }
  | { status: "stored"; id: string; parse: "parsed" | "failed"; parseError?: string }
  | { status: "duplicate"; id: string; firstSeen: string }
  | { status: "invalid"; fieldErrors: { text?: string; url?: string } }
  | { status: "error"; message: string };

// Server action: the only write path (CLAUDE.md "no client-side DB writes").
// Signature matches React's useActionState.
export async function storePastedJob(
  _prev: PasteState,
  formData: FormData,
): Promise<PasteState> {
  const user = await requireUser();
  const profile = await getProfile(user.id);
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
  // Idempotent per owner: the same text pasted by two users is two rows,
  // each private to its owner. external_id carries the owner for that.
  const externalId = profile ? `${profile.id}:${hash}` : hash;
  const existing = await supabase
    .from("job")
    .select("id, first_seen")
    .eq("source_id", MANUAL_SOURCE_ID)
    .eq("external_id", externalId)
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
      owner_profile_id: profile?.id ?? null,
      external_id: externalId,
      content_hash: hash,
      url: url ?? null,
      raw,
    })
    .select("id")
    .single();

  if (inserted.error) {
    return { status: "error", message: `Insert failed: ${inserted.error.message}` };
  }
  // Parse inline: paste-to-ready-kit in under two minutes starts here. A
  // parse failure is reported but never blocks the store — the row exists,
  // the failure is dead-lettered, and "Parse" on the row retries.
  const outcome = await parseStoredJob(inserted.data.id);
  // Then score, if there is a reviewed profile. Skips silently otherwise;
  // the list shows why.
  if (outcome.status !== "failed" && profile) await scoreStoredJob(inserted.data.id, profile.id);
  revalidatePath("/");
  return {
    status: "stored",
    id: inserted.data.id,
    parse: outcome.status === "failed" ? "failed" : "parsed",
    ...(outcome.status === "failed" ? { parseError: outcome.error } : {}),
  };
}

// Retry (or force re-run) the parser for one row. Used by the row action and
// by the detail page.
export async function reparseJob(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const force = formData.get("force") === "1";
  if (!id) return;
  await parseStoredJob(id, { force });
  revalidatePath("/");
  revalidatePath(`/jobs/${id}`);
}
