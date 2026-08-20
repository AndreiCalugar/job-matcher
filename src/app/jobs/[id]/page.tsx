import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell } from "@/components/shell";
import { Badge } from "@/components/jobs/jobs-table";
import { Button } from "@/components/ui/button";
import { reparseJob } from "@/lib/jobs/actions";
import { formatComp, formatDate, host } from "@/lib/jobs/format";
import { getJob } from "@/lib/jobs/queries";
import { getParseFailures } from "@/lib/parse/queries";
import { getProfile } from "@/lib/cv/queries";
import { getMatchForJob } from "@/lib/match/queries";
import { MatchPanel } from "@/components/match/match-panel";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Parsed record for one posting. No score, no verdict — those are Phase 4.
// Red flags are content, rendered at body size in ink (DESIGN.md §7).
export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await getJob(id);
  if (!job) notFound();
  const [failures, profile, match] = await Promise.all([
    job.parsed_at ? Promise.resolve([]) : getParseFailures(id),
    getProfile(),
    getMatchForJob(id),
  ]);
  const canScore = !!profile?.human_corrected && !!job.parsed_at;

  return (
    <Shell current="jobs">
      <Link href="/" className="text-small text-graphite hover:text-ink">
        ← Jobs
      </Link>

      <header className="mt-2 flex items-start justify-between gap-6">
        <div className="min-w-0">
          <h1 className="font-display text-display font-semibold text-ink">
            {job.title ?? "Unparsed posting"}
          </h1>
          <p className="mt-1 text-body text-graphite">
            {[job.company_name, job.location, job.country].filter(Boolean).join(" · ") || "—"}
          </p>
        </div>
        <dl className="grid shrink-0 grid-cols-[auto_auto] gap-x-4 gap-y-1 font-mono text-small text-graphite">
          <dt className="eyebrow">Stored</dt>
          <dd>{formatDate(job.first_seen)}</dd>
          <dt className="eyebrow">Source</dt>
          <dd>{job.source.kind}</dd>
          {job.url ? (
            <>
              <dt className="eyebrow">URL</dt>
              <dd>
                <a href={job.url} target="_blank" rel="noreferrer noopener" className="hover:text-ink hover:underline">
                  {host(job.url)}
                </a>
              </dd>
            </>
          ) : null}
        </dl>
      </header>

      {job.parsed_at ? (
        <div className="mt-8">
          <MatchPanel jobId={job.id} match={match} canScore={canScore} />
        </div>
      ) : null}

      {job.parsed_at ? (
        <div className="mt-8 grid gap-6 md:grid-cols-[minmax(360px,1fr)_minmax(300px,380px)]">
          <section className="min-w-0">
            <h2 className="eyebrow mb-2">Summary</h2>
            <p className="max-w-[68ch] text-body text-ink">{job.summary ?? "—"}</p>

            <h2 className="eyebrow mt-8 mb-2">Required skills</h2>
            <SkillTable skills={job.required_skills ?? []} />

            {job.nice_to_have && job.nice_to_have.length > 0 ? (
              <>
                <h2 className="eyebrow mt-8 mb-2">Nice to have</h2>
                <p className="text-body text-ink">{job.nice_to_have.map((s) => s.name).join(", ")}</p>
              </>
            ) : null}

            <h2 className="eyebrow mt-8 mb-2">Red flags</h2>
            {job.red_flags && job.red_flags.length > 0 ? (
              <ul className="divide-y divide-rule rounded-lg border border-rule bg-surface">
                {job.red_flags.map((f, i) => (
                  <li key={i} className="flex gap-4 px-4 py-3">
                    <span className="w-[140px] shrink-0 font-mono text-small text-graphite">
                      {f.kind}
                      <span className="block text-micro uppercase tracking-[0.08em]">{f.severity}</span>
                    </span>
                    <q className="max-w-[68ch] text-body text-ink">{f.evidence}</q>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-body text-graphite">None detected.</p>
            )}
          </section>

          <aside className="rounded-lg border border-rule bg-surface p-4 md:self-start">
            <h2 className="eyebrow mb-4">Posting facts</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-small">
              <Fact k="Seniority" v={job.seniority} />
              <Fact k="Type" v={job.employment_type} />
              <Fact k="Remote" v={job.remote_policy} />
              <Fact k="Comp" v={formatComp(job)} />
              <Fact k="Language" v={job.language} />
              <Fact k="Parser" v={job.parser_version} />
              <Fact k="Parsed" v={job.parsed_at ? formatDate(job.parsed_at) : null} />
            </dl>
            <form action={reparseJob} className="mt-4">
              <input type="hidden" name="id" value={job.id} />
              <input type="hidden" name="force" value="1" />
              <Button type="submit" variant="outline" size="sm">
                Re-parse
              </Button>
            </form>
          </aside>
        </div>
      ) : (
        <section className="mt-8 rounded-lg border border-rule bg-surface p-4">
          <div className="flex items-center gap-3">
            <Badge>unparsed</Badge>
            <form action={reparseJob}>
              <input type="hidden" name="id" value={job.id} />
              <Button type="submit" size="sm">
                Parse now
              </Button>
            </form>
          </div>
          {failures.length > 0 ? (
            <div className="mt-4">
              <h2 className="eyebrow mb-2">Parse failures</h2>
              <ul className="font-mono text-small text-graphite">
                {failures.map((f) => (
                  <li key={f.id}>
                    {formatDate(f.created_at)} — {f.error}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      )}

      <section className="mt-8">
        <h2 className="eyebrow mb-2">Raw posting</h2>
        <pre className="max-h-[480px] overflow-auto whitespace-pre-wrap rounded-lg border border-rule bg-surface-sunken p-4 font-sans text-small text-ink">
          {job.raw.text}
        </pre>
      </section>
    </Shell>
  );
}

function Fact({ k, v }: { k: string; v: string | null | undefined }) {
  return (
    <>
      <dt className="eyebrow self-center">{k}</dt>
      <dd className="font-mono text-ink">{v ?? "—"}</dd>
    </>
  );
}

function SkillTable({ skills }: { skills: NonNullable<import("@/lib/jobs/schema").JobRow["required_skills"]> }) {
  if (skills.length === 0) return <p className="text-body text-graphite">None extracted.</p>;
  return (
    <ul className="divide-y divide-rule rounded-lg border border-rule bg-surface">
      {skills.map((s) => (
        <li key={s.name} className="flex h-10 items-center gap-4 px-4">
          <span className="flex-1 text-body text-ink">{s.name}</span>
          <span className="w-[56px] font-mono text-small text-graphite">{s.importance}</span>
          <span className="w-[40px] text-right font-mono text-small text-graphite">
            {s.years_wanted != null ? `${s.years_wanted}y` : "—"}
          </span>
        </li>
      ))}
    </ul>
  );
}
