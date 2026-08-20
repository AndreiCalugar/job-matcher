/**
 * One-off: pull candidate postings for the eval set from keyless public
 * boards, filter to the Phase 1 persona (React/TS/Node/.NET, EU or remote),
 * and write evals/fixtures/jobs.json + a readable POSTINGS.md to rank from.
 *
 *   npm run eval:fetch -- --count 24
 *
 * This is NOT the Phase 6 ingest. No cron, no dedupe against the DB, no
 * source rows. It exists so the eval set can be built before Phase 6.
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

const ROOT = path.resolve(__dirname);
const UA = "job-matcher eval fetch (+https://github.com/AndreiCalugar/job-matcher)";
const countArg = process.argv.indexOf("--count");
const COUNT = countArg > -1 ? Number(process.argv[countArg + 1]) : 24;

type Posting = { id: string; title: string; company: string; url: string; location: string; source: string; text: string };

const STACK = /\b(react|typescript|next\.?js|node(\.js)?|full[- ]?stack|front[- ]?end|\.net|c#|dotnet)\b/i;
const TITLE_OK = /\b(engineer|developer|programmer|software)\b/i;
const TITLE_BAD = /\b(intern|werkstudent\w*|working student|junior|manager|director|vp|head of|principal|architect|qa|test|data (scientist|engineer)|machine learning|devops|sre|security|mobile|ios|android|flutter|php|ruby|rails|wordpress|salesforce|sap|embedded|unity|game|java|windows|desktop|design engineer|rpa|automation)\b/i;
// EU + Nordics + remote. UK deliberately excluded (not in the target set).
const EU_HINT = /\b(remote|worldwide|anywhere|europe|eu|emea|denmark|copenhagen|aarhus|sweden|stockholm|norway|oslo|finland|helsinki|netherlands|amsterdam|germany|berlin|munich|hamburg|austria|vienna|switzerland|zurich|ireland|dublin|spain|madrid|barcelona|portugal|lisbon|france|paris|belgium|brussels|poland|warsaw|romania|bucharest|cluj|czech|prague|estonia|tallinn|italy|milan)\b/i;
const UK_ONLY = /\b(london|cardiff|manchester|edinburgh|united kingdom|\buk\b|england)\b/i;

async function arbeitnow(): Promise<Posting[]> {
  const schema = z.object({
    data: z.array(z.object({
      slug: z.string(), company_name: z.string(), title: z.string(), description: z.string(),
      remote: z.boolean(), url: z.string(), location: z.string().nullable().optional(),
    })),
  });
  const out: Posting[] = [];
  for (let page = 1; page <= 12; page++) {
    const res = await fetch(`https://www.arbeitnow.com/api/job-board-api?page=${page}`, { headers: { "User-Agent": UA } });
    if (!res.ok) break;
    const { data } = schema.parse(await res.json());
    for (const j of data) {
      out.push({
        id: `an-${j.slug.slice(0, 48)}`, title: j.title, company: j.company_name, url: j.url,
        location: `${j.location ?? ""}${j.remote ? " (remote)" : ""}`.trim(), source: "arbeitnow", text: html2text(j.description),
      });
    }
    await sleep(600);
  }
  return out;
}

async function remoteok(): Promise<Posting[]> {
  const res = await fetch("https://remoteok.com/api", { headers: { "User-Agent": UA } });
  if (!res.ok) return [];
  const arr = z.array(z.record(z.string(), z.unknown())).parse(await res.json());
  const item = z.object({
    id: z.coerce.string(), slug: z.string(), company: z.string(), position: z.string(), description: z.string(),
    location: z.string().optional(), url: z.string(), tags: z.array(z.string()).optional(),
  });
  const out: Posting[] = [];
  for (const raw of arr.slice(1)) {
    const p = item.safeParse(raw);
    if (!p.success) continue;
    const j = p.data;
    out.push({
      id: `rok-${j.id}`, title: j.position, company: j.company, url: j.url,
      location: j.location || "Remote", source: "remoteok", text: html2text(j.description),
    });
  }
  return out;
}

async function jobicy(): Promise<Posting[]> {
  const schema = z.object({
    jobs: z.array(z.object({
      id: z.coerce.string(), url: z.string(), jobTitle: z.string(), companyName: z.string(),
      jobGeo: z.string().optional(), jobDescription: z.string(), jobType: z.union([z.string(), z.array(z.string())]).optional(),
    })),
  });
  const out: Posting[] = [];
  for (const tag of ["react", "typescript", "node", "full-stack", "frontend", "dotnet"]) {
    const res = await fetch(`https://jobicy.com/api/v2/remote-jobs?count=50&geo=europe&tag=${tag}`, { headers: { "User-Agent": UA } });
    if (!res.ok) continue;
    const parsed = schema.safeParse(await res.json());
    if (!parsed.success) continue;
    for (const j of parsed.data.jobs) {
      out.push({
        id: `jb-${j.id}`, title: j.jobTitle, company: j.companyName, url: j.url,
        location: `${j.jobGeo ?? "Europe"} (remote)`, source: "jobicy", text: html2text(j.jobDescription),
      });
    }
    await sleep(600);
  }
  return out;
}

function html2text(html: string): string {
  return html
    .replace(/<\s*(br|\/p|\/div|\/li|\/h[1-6]|\/tr)\s*>/gi, "\n")
    .replace(/<\s*li\s*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&rsquo;|&lsquo;/g, "'")
    .replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const all = [...(await arbeitnow()), ...(await remoteok()), ...(await jobicy())];
  const seen = new Set<string>();
  const picked = all.filter((p) => {
    const key = `${p.company}|${p.title}`.toLowerCase();
    if (seen.has(key)) return false;
    if (!TITLE_OK.test(p.title) || TITLE_BAD.test(p.title)) return false;
    // Stack in the title, or at least two distinct stack terms in the body.
    const hits = new Set((`${p.title} ${p.text}`.match(new RegExp(STACK.source, "gi")) ?? []).map((h) => h.toLowerCase().replace(/\.js$/, "").replace(/[- ]/g, "")));
    if (!STACK.test(p.title) && hits.size < 2) return false;
    if (!EU_HINT.test(`${p.location} ${p.text.slice(0, 1500)}`)) return false;
    if (UK_ONLY.test(p.location) && !/remote|europe|\beu\b/i.test(p.location)) return false;
    if (p.text.length < 600 || p.text.length > 12000) return false;
    seen.add(key);
    return true;
  });
  // Spread across sources; then first COUNT.
  const bySource = new Map<string, Posting[]>();
  for (const p of picked) bySource.set(p.source, [...(bySource.get(p.source) ?? []), p]);
  const final: Posting[] = [];
  while (final.length < COUNT && [...bySource.values()].some((l) => l.length)) {
    for (const list of bySource.values()) {
      const next = list.shift();
      if (next && final.length < COUNT) final.push(next);
    }
  }

  writeFileSync(path.join(ROOT, "fixtures/jobs.json"), JSON.stringify(final.map(({ source: _s, location: _l, ...j }) => j), null, 1));
  const md = [
    "# Postings to rank",
    "",
    `${final.length} postings, fetched ${new Date().toISOString().slice(0, 10)} from ${[...new Set(final.map((p) => p.source))].join(", ")}.`,
    "",
    "Read each, then write the ids into `ranking.json` best-first — \"if I applied properly, how likely is a first interview?\". No ties.",
    "",
    "| # | id | title | company | location | chars |",
    "|---|---|---|---|---|---|",
    ...final.map((p, i) => `| ${i + 1} | \`${p.id}\` | ${p.title} | ${p.company} | ${p.location} | ${p.text.length} |`),
    "",
    ...final.flatMap((p) => [`---`, ``, `## ${p.id}`, ``, `**${p.title}** — ${p.company} · ${p.location}  `, `${p.url}`, ``, p.text, ``]),
  ].join("\n");
  writeFileSync(path.join(ROOT, "fixtures/POSTINGS.md"), md);
  console.log(`fetched ${all.length}, matched ${picked.length}, wrote ${final.length} → evals/fixtures/jobs.json, POSTINGS.md`);
  console.table(final.map((p) => ({ id: p.id, title: p.title.slice(0, 40), company: p.company.slice(0, 24), location: p.location.slice(0, 28), source: p.source })));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
