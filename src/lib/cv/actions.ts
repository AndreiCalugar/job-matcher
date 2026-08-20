"use server";

import Anthropic from "@anthropic-ai/sdk";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PARSER_VERSION, parseCvText } from "@/lib/cv/cv-parser";
import { pdfToText } from "@/lib/cv/extract";
import { normalise } from "@/lib/cv/normalise";
import { profileEdit } from "@/lib/cv/schema";
import { requireUser } from "@/lib/auth/session";
import { computeSkillYears } from "@/lib/cv/years";
import { ToolCallError } from "@/lib/llm/tool-call";
import { supabase } from "@/lib/supabase/server";

export type UploadState =
  | { status: "idle" }
  | { status: "invalid"; message: string }
  | { status: "error"; message: string };

const MIN_CHARS = 300;

// CV in (PDF file or pasted text) → parsed profile row → redirect to the
// non-skippable review screen. One strong-model call; failure leaves no row.
export async function uploadCv(_prev: UploadState, formData: FormData): Promise<UploadState> {
  const user = await requireUser();
  const file = formData.get("file");
  const pasted = String(formData.get("text") ?? "").trim();

  let text = "";
  let filename: string | null = null;
  if (file instanceof File && file.size > 0) {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return { status: "invalid", message: "Upload a PDF, or paste the text instead." };
    }
    if (file.size > 10 * 1024 * 1024) return { status: "invalid", message: "PDF is over 10 MB. Export a smaller one." };
    try {
      const { text: extracted, pages } = await pdfToText(new Uint8Array(await file.arrayBuffer()));
      text = extracted;
      filename = file.name;
      if (text.length < MIN_CHARS) {
        return {
          status: "invalid",
          message: `Only ${text.length} characters of text found in ${pages} page(s). The PDF is probably image-based; paste the text instead.`,
        };
      }
    } catch (e) {
      return { status: "error", message: `Could not read the PDF: ${e instanceof Error ? e.message : String(e)}` };
    }
  } else {
    text = normalise(pasted);
    if (text.length < MIN_CHARS) {
      return { status: "invalid", message: `Paste the full CV. ${text.length} characters is too short to parse.` };
    }
  }

  let parsed;
  try {
    parsed = await parseCvText(new Anthropic(), text);
  } catch (e) {
    return { status: "error", message: `Parsing failed: ${describe(e)}. Nothing was saved; try again.` };
  }

  const p = parsed.parse;
  const inserted = await supabase
    .from("profile")
    .insert({
      user_id: user.id,
      headline: p.headline,
      summary: p.summary,
      experience: p.experience,
      // Years come from role dates, not from the model.
      skills: p.skills.map((s) => ({ ...s, years: computeSkillYears(p.experience, s.name) })),
      projects: p.projects,
      education: p.education,
      languages: p.languages,
      raw_cv: text,
      raw_cv_filename: filename,
      parsed_at: new Date().toISOString(),
      parser_version: PARSER_VERSION,
    })
    .select("id")
    .single();
  if (inserted.error) return { status: "error", message: `Could not save profile: ${inserted.error.message}` };

  await supabase.from("usage_event").insert({
    kind: "cv_parsed",
    user_id: user.id,
    profile_id: inserted.data.id,
    model: parsed.model,
    input_tokens: parsed.usage.input_tokens,
    output_tokens: parsed.usage.output_tokens,
    cache_read_tokens: parsed.usage.cache_read_tokens,
    cache_creation_tokens: parsed.usage.cache_creation_tokens,
    latency_ms: parsed.usage.latency_ms,
  });

  revalidatePath("/profile");
  // gaps_noticed is parse-only guidance for the review screen, carried in
  // the URL rather than persisted: it describes the draft, not the record.
  redirect(`/profile/review?gaps=${encodeURIComponent(JSON.stringify(p.gaps_noticed))}`);
}

export type SaveState = { status: "idle" } | { status: "saved" } | { status: "invalid"; message: string } | { status: "error"; message: string };

// The correction screen's submit. The whole edited profile arrives as JSON
// in one field; Zod is the gate. Marks human_corrected — from here on this
// row is ground truth and no parser overwrites it.
export async function saveProfile(_prev: SaveState, formData: FormData): Promise<SaveState> {
  const user = await requireUser();
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { status: "invalid", message: "Missing profile id." };
  const owner = await supabase.from("profile").select("user_id").eq("id", id.data).single();
  if (owner.data?.user_id !== user.id) return { status: "error", message: "Not your profile." };

  let json: unknown;
  try {
    json = JSON.parse(String(formData.get("profile") ?? ""));
  } catch {
    return { status: "invalid", message: "Form data was not valid JSON." };
  }
  const edit = profileEdit.safeParse(json);
  if (!edit.success) {
    const first = edit.error.issues[0];
    return { status: "invalid", message: `${first?.path.join(".") ?? "profile"}: ${first?.message ?? "invalid"}` };
  }

  const { error } = await supabase
    .from("profile")
    .update({
      ...edit.data,
      human_corrected: true,
      corrected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id.data);
  if (error) return { status: "error", message: `Save failed: ${error.message}` };

  revalidatePath("/profile");
  revalidatePath("/profile/review");
  return { status: "saved" };
}

function describe(e: unknown): string {
  if (e instanceof ToolCallError) return `${e.stage}: ${e.message}`;
  if (e instanceof Anthropic.APIError) return `api ${e.status}: ${e.message}`;
  if (e instanceof Error) return e.message;
  return String(e);
}
