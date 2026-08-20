import { z } from "zod";
import { htmlToText } from "@/lib/ingest/html";
import type { Adapter } from "@/lib/ingest/types";

const schema = z.object({
  jobs: z.array(z.object({
    id: z.number(),
    title: z.string(),
    absolute_url: z.string(),
    updated_at: z.string().optional(),
    first_published: z.string().optional(),
    location: z.object({ name: z.string() }).optional(),
    content: z.string().optional(), // HTML, entity-escaped by Greenhouse
    company_name: z.string().optional(),
  })),
});

export const greenhouse: Adapter = {
  kind: "greenhouse",
  async fetch(token, _config, http) {
    const res = await http(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(token)}/jobs?content=true`);
    if (!res.ok) throw new Error(`greenhouse ${token}: HTTP ${res.status}`);
    const { jobs } = schema.parse(await res.json());
    return jobs.map((j) => ({
      external_id: String(j.id),
      url: j.absolute_url,
      apply_url: j.absolute_url,
      title: j.title,
      company_name: j.company_name ?? null,
      location: j.location?.name ?? null,
      remote_hint: /remote/i.test(j.location?.name ?? "") ? true : null,
      posted_at: j.first_published ?? j.updated_at ?? null,
      // Greenhouse double-escapes: content is HTML with entities encoded.
      text: `${j.title}\n${j.location?.name ?? ""}\n\n${htmlToText(htmlToText(j.content ?? ""))}`.trim(),
      raw: j,
    }));
  },
};
