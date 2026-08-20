import "@/lib/server-guard";
import { extractText, getDocumentProxy } from "unpdf";
import { normalise } from "@/lib/cv/normalise";

// PDF → plain text. Designed CVs (columns, sidebars, text-in-images) come
// out in reading-order soup; that is exactly what an ATS sees, which is
// the point of DESIGN.md's "ATS-safe export" later. The user reviews the
// parsed result anyway; that screen is non-skippable.
export async function pdfToText(bytes: Uint8Array): Promise<{ text: string; pages: number }> {
  const pdf = await getDocumentProxy(bytes);
  const { text, totalPages } = await extractText(pdf, { mergePages: true });
  return { text: normalise(text), pages: totalPages };
}
