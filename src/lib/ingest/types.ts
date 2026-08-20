import { z } from "zod";

// What every adapter returns. Everything else (parsing, scoring, dedupe)
// works off this shape and never sees a source's native payload again —
// that lives untouched in job.raw.
export const normalisedPosting = z.object({
  external_id: z.string().min(1),
  url: z.string().url(),
  apply_url: z.string().url().nullable(),
  title: z.string().min(1),
  company_name: z.string().nullable(),
  location: z.string().nullable(),
  remote_hint: z.boolean().nullable(),
  posted_at: z.string().nullable(), // ISO
  text: z.string().min(1),          // plain text; HTML stripped
  raw: z.unknown(),                 // native payload, stored verbatim
});
export type NormalisedPosting = z.infer<typeof normalisedPosting>;

export const sourceKind = z.enum(["manual", "greenhouse", "lever", "ashby", "workable", "recruitee", "personio", "adzuna", "jsearch", "arbeitnow", "remoteok", "jobicy"]);
export type SourceKind = z.infer<typeof sourceKind>;

export type Adapter = {
  kind: SourceKind;
  // identifier: board token / slug / query string, per CLAUDE.md table
  fetch: (identifier: string, config: Record<string, unknown>, http: Http) => Promise<NormalisedPosting[]>;
};

// Injected so tests never hit the network.
export type Http = (url: string, init?: RequestInit) => Promise<Response>;

export const USER_AGENT = "job-matcher ingest (+https://github.com/AndreiCalugar/job-matcher)";

export function defaultHttp(): Http {
  return (url, init) => fetch(url, { ...init, headers: { "User-Agent": USER_AGENT, Accept: "application/json", ...(init?.headers ?? {}) } });
}
