import { z } from "zod";
import { htmlToText } from "@/lib/ingest/html";
import type { Adapter } from "@/lib/ingest/types";

const schema = z.array(z.object({
  id: z.string(),
  text: z.string(),
  hostedUrl: z.string(),
  applyUrl: z.string().nullish(),
  createdAt: z.number().nullish(),
  categories: z.object({ location: z.string().optional(), team: z.string().optional(), commitment: z.string().optional() }).optional(),
  descriptionPlain: z.string().nullish(),
  description: z.string().nullish(),
  lists: z.array(z.object({ text: z.string(), content: z.string() })).optional(),
  additionalPlain: z.string().nullish(),
  workplaceType: z.string().nullish(),
}));

export const lever: Adapter = {
  kind: "lever",
  async fetch(site, _config, http) {
    const res = await http(`https://api.lever.co/v0/postings/${encodeURIComponent(site)}?mode=json`);
    if (!res.ok) throw new Error(`lever ${site}: HTTP ${res.status}`);
    const jobs = schema.parse(await res.json());
    return jobs.map((j) => {
      const lists = (j.lists ?? []).map((l) => `${l.text}\n${htmlToText(l.content)}`).join("\n\n");
      const body = [j.descriptionPlain ?? htmlToText(j.description ?? ""), lists, j.additionalPlain ?? ""].filter(Boolean).join("\n\n");
      return {
        external_id: j.id,
        url: j.hostedUrl,
        apply_url: j.applyUrl ?? j.hostedUrl,
        title: j.text,
        company_name: null,
        location: j.categories?.location ?? null,
        remote_hint: j.workplaceType ? /remote/i.test(j.workplaceType) : null,
        posted_at: j.createdAt ? new Date(j.createdAt).toISOString() : null,
        text: `${j.text}\n${[j.categories?.location, j.categories?.commitment, j.workplaceType].filter(Boolean).join(" · ")}\n\n${body}`.trim(),
        raw: j,
      };
    });
  },
};
