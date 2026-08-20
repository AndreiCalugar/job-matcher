import { z } from "zod";

// Fixed id seeded by migration 20260820070248. The manual channel is a
// system constant; the app never looks it up.
export const MANUAL_SOURCE_ID = "00000000-0000-0000-0000-000000000001";

// What the paste form submits. Validated server-side before anything is
// stored; the client gets the same messages back under `fieldErrors`.
export const pasteInput = z.object({
  text: z
    .string()
    .trim()
    .min(80, "Paste the full posting. Under 80 characters is not enough to parse."),
  url: z
    .string()
    .trim()
    .url("Enter a full URL starting with http:// or https://, or leave it empty.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});
export type PasteInput = z.infer<typeof pasteInput>;

// Shape of job.raw for source.kind = 'manual'. Phase 2's parser reads this.
// Versioned so a later change to the shape does not silently break re-parses.
export const manualRaw = z.object({
  kind: z.literal("manual"),
  v: z.literal(1),
  text: z.string(),
  url: z.string().url().optional(),
});
export type ManualRaw = z.infer<typeof manualRaw>;

// The row as read back for the list. Zod here too: the DB is a boundary.
export const jobRow = z.object({
  id: z.string().uuid(),
  url: z.string().nullable(),
  raw: manualRaw,
  content_hash: z.string(),
  first_seen: z.string(),
  last_seen: z.string(),
  source: z.object({ kind: z.string() }),
});
export type JobRow = z.infer<typeof jobRow>;
