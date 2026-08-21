import { z } from "zod";
import { htmlToText } from "@/lib/ingest/html";
import type { Adapter } from "@/lib/ingest/types";

const schema = z.object({
  jobs: z.array(z.object({
    id: z.string(),
    title: z.string(),
    jobUrl: z.string(),
    // Live boards send null where the docs say optional; accept both.
    applyUrl: z.string().nullish(),
    location: z.string().nullish(),
    isRemote: z.boolean().nullish(),
    publishedAt: z.string().nullish(),
    descriptionHtml: z.string().nullish(),
    descriptionPlain: z.string().nullish(),
    employmentType: z.string().nullish(),
    compensation: z.unknown().nullish(),
  })),
});

export const ashby: Adapter = {
  kind: "ashby",
  async fetch(name, _config, http) {
    const res = await http(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(name)}?includeCompensation=true`);
    if (!res.ok) throw new Error(`ashby ${name}: HTTP ${res.status}`);
    const { jobs } = schema.parse(await res.json());
    return jobs.map((j) => ({
      external_id: j.id,
      url: j.jobUrl,
      apply_url: j.applyUrl ?? j.jobUrl,
      title: j.title,
      company_name: null,
      location: j.location ?? null,
      remote_hint: j.isRemote ?? null,
      posted_at: j.publishedAt ?? null,
      text: `${j.title}\n${[j.location, j.employmentType, j.isRemote ? "Remote" : null].filter(Boolean).join(" · ")}\n\n${j.descriptionPlain ?? htmlToText(j.descriptionHtml ?? "")}`.trim(),
      raw: j,
    }));
  },
};
