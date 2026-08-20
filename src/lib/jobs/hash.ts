import { createHash } from "node:crypto";

// Stable identity for a posting's text. Whitespace and case differences
// between two copies of the same ad (LinkedIn vs the ATS, a re-paste with a
// trailing newline) must not produce two rows. Anything stronger — stripping
// boilerplate, fuzzy matching — belongs to Phase 6 where it can be measured.
export function contentHash(text: string): string {
  const normalised = text.toLowerCase().replace(/\s+/g, " ").trim();
  return createHash("sha256").update(normalised).digest("hex");
}
