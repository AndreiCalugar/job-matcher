import { z } from "zod";
import type { JobRow } from "@/lib/jobs/schema";

export const searchProfileRow = z.object({
  id: z.string().uuid(),
  name: z.string(),
  titles: z.array(z.string()),
  countries: z.array(z.string()),
  remote_policy: z.array(z.string()),
  seniority: z.array(z.string()),
  employment_type: z.array(z.string()),
  comp_floor: z.coerce.number().nullable(),
  comp_currency: z.string().nullable(),
  exclude_keywords: z.array(z.string()),
  exclude_companies: z.array(z.string()),
  enabled: z.boolean(),
});
export type SearchProfileRow = z.infer<typeof searchProfileRow>;

type JobLike = Pick<JobRow, "title" | "country" | "remote_policy" | "seniority" | "employment_type" | "company_name"> & { text: string };

// Cheap, deterministic pre-filter on parsed fields. Decides which ingested
// jobs earn a strong-tier scoring call. Empty list = no constraint.
// Returns the reason a job was rejected, or null if it passes.
export function rejectReason(job: JobLike, sp: SearchProfileRow): string | null {
  const title = (job.title ?? "").toLowerCase();
  const text = job.text.toLowerCase();
  const company = (job.company_name ?? "").toLowerCase();

  if (sp.titles.length && !sp.titles.some((t) => title.includes(t.toLowerCase()))) return "title";
  for (const kw of sp.exclude_keywords) {
    const k = kw.toLowerCase();
    if (k && (title.includes(k) || text.includes(k))) return `excluded keyword: ${kw}`;
  }
  for (const c of sp.exclude_companies) {
    if (c && company.includes(c.toLowerCase())) return `excluded company: ${c}`;
  }
  if (sp.countries.length) {
    const inCountry = job.country ? sp.countries.map((c) => c.toUpperCase()).includes(job.country.toUpperCase()) : false;
    const remoteOk = job.remote_policy === "remote";
    if (!inCountry && !remoteOk) return "country";
  }
  if (sp.remote_policy.length && job.remote_policy && job.remote_policy !== "unclear" && !sp.remote_policy.includes(job.remote_policy)) return "remote policy";
  if (sp.seniority.length && job.seniority && job.seniority !== "unclear" && !sp.seniority.includes(job.seniority)) return "seniority";
  if (sp.employment_type.length && job.employment_type && !["unclear", "either"].includes(job.employment_type) && !sp.employment_type.includes(job.employment_type)) return "employment type";
  return null;
}

export function passesAny(job: JobLike, profiles: SearchProfileRow[]): boolean {
  return profiles.filter((p) => p.enabled).some((p) => rejectReason(job, p) === null);
}
