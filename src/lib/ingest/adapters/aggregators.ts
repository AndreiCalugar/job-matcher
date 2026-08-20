import { z } from "zod";
import { htmlToText } from "@/lib/ingest/html";
import type { Adapter } from "@/lib/ingest/types";

// Keyless aggregators. `identifier` is a query string the source
// understands; config may carry page limits.

export const arbeitnow: Adapter = {
  kind: "arbeitnow",
  async fetch(_identifier, config, http) {
    const pages = Number(config.pages ?? 5);
    const schema = z.object({
      data: z.array(z.object({
        slug: z.string(), company_name: z.string(), title: z.string(), description: z.string(),
        remote: z.boolean(), url: z.string(), location: z.string().nullable().optional(),
        created_at: z.number().optional(),
      })),
    });
    const out = [];
    for (let page = 1; page <= pages; page++) {
      const res = await http(`https://www.arbeitnow.com/api/job-board-api?page=${page}`);
      if (!res.ok) break;
      const { data } = schema.parse(await res.json());
      for (const j of data) {
        out.push({
          external_id: j.slug, url: j.url, apply_url: j.url, title: j.title, company_name: j.company_name,
          location: j.location ?? null, remote_hint: j.remote,
          posted_at: j.created_at ? new Date(j.created_at * 1000).toISOString() : null,
          text: `${j.title}\n${j.company_name} · ${j.location ?? ""}${j.remote ? " · Remote" : ""}\n\n${htmlToText(j.description)}`.trim(),
          raw: j,
        });
      }
    }
    return out;
  },
};

export const jobicy: Adapter = {
  kind: "jobicy",
  async fetch(identifier, config, http) {
    // identifier: comma-separated tags, e.g. "react,typescript,node"
    const geo = String(config.geo ?? "europe");
    const schema = z.object({
      jobs: z.array(z.object({
        id: z.coerce.string(), url: z.string(), jobTitle: z.string(), companyName: z.string(),
        jobGeo: z.string().optional(), jobDescription: z.string(), pubDate: z.string().optional(),
      })),
    });
    const out = [];
    const seen = new Set<string>();
    for (const tag of identifier.split(",").map((t) => t.trim()).filter(Boolean)) {
      const res = await http(`https://jobicy.com/api/v2/remote-jobs?count=50&geo=${encodeURIComponent(geo)}&tag=${encodeURIComponent(tag)}`);
      if (!res.ok) continue;
      const parsed = schema.safeParse(await res.json());
      if (!parsed.success) continue;
      for (const j of parsed.data.jobs) {
        if (seen.has(j.id)) continue;
        seen.add(j.id);
        out.push({
          external_id: j.id, url: j.url, apply_url: j.url, title: j.jobTitle, company_name: j.companyName,
          location: j.jobGeo ?? "Remote", remote_hint: true, posted_at: j.pubDate ? new Date(j.pubDate).toISOString() : null,
          text: `${j.jobTitle}\n${j.companyName} · ${j.jobGeo ?? "Remote"}\n\n${htmlToText(j.jobDescription)}`.trim(),
          raw: j,
        });
      }
    }
    return out;
  },
};

export const remoteok: Adapter = {
  kind: "remoteok",
  async fetch(_identifier, _config, http) {
    const res = await http("https://remoteok.com/api");
    if (!res.ok) throw new Error(`remoteok: HTTP ${res.status}`);
    const arr = z.array(z.record(z.string(), z.unknown())).parse(await res.json());
    const item = z.object({
      id: z.coerce.string(), company: z.string(), position: z.string(), description: z.string(),
      location: z.string().optional(), url: z.string(), date: z.string().optional(), apply_url: z.string().optional(),
    });
    const out = [];
    for (const rawItem of arr.slice(1)) { // [0] is a legal notice
      const p = item.safeParse(rawItem);
      if (!p.success) continue;
      const j = p.data;
      out.push({
        external_id: j.id, url: j.url, apply_url: j.apply_url ?? j.url, title: j.position, company_name: j.company,
        location: j.location || "Remote", remote_hint: true, posted_at: j.date ?? null,
        text: `${j.position}\n${j.company} · ${j.location || "Remote"}\n\n${htmlToText(j.description)}`.trim(),
        raw: j,
      });
    }
    return out;
  },
};
