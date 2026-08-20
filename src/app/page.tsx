import { Shell } from "@/components/shell";
import { JobsTable } from "@/components/jobs/jobs-table";
import { PasteForm } from "@/components/jobs/paste-form";
import { listJobs } from "@/lib/jobs/queries";
import { getProfile } from "@/lib/cv/queries";
import { getMatchesByJob } from "@/lib/match/queries";
import Link from "next/link";

// Reads on every request: the list must reflect the write that just happened.
export const dynamic = "force-dynamic";
// Paste → parse → score runs inline in one action; strong-tier scoring
// takes 30–60s.
export const maxDuration = 120;

export default async function JobsPage() {
  const [jobs, profile] = await Promise.all([listJobs(), getProfile()]);
  const matches = await getMatchesByJob(jobs.map((j) => j.id));
  const canScore = !!profile?.human_corrected;

  return (
    <Shell current="jobs">
      <header className="flex items-baseline justify-between">
        <h1 className="font-display text-display font-semibold text-ink">Jobs</h1>
        <p className="font-mono text-small text-graphite">
          {jobs.length.toLocaleString("en-GB")} stored
        </p>
      </header>

      {/* DESIGN.md §5: two-pane on desktop, stacked below 1024px. The list
          never collapses below 360px. */}
      <div className="mt-8 grid gap-6 md:grid-cols-[minmax(360px,1fr)_minmax(300px,380px)]">
        <section aria-labelledby="list-heading" className="min-w-0 md:order-1">
          <h2 id="list-heading" className="eyebrow mb-2">
            Stored postings
          </h2>
          {!canScore ? (
            <p className="mb-3 rounded-lg border border-rule bg-surface px-4 py-3 text-small text-graphite">
              {profile ? "Confirm your profile to enable scoring." : "Add your CV to enable scoring."}{" "}
              <Link href="/profile" className="text-ink underline underline-offset-2">
                Profile →
              </Link>
            </p>
          ) : null}
          <JobsTable jobs={jobs} matches={matches} canScore={canScore} />
        </section>

        <section
          aria-labelledby="paste-heading"
          className="rounded-lg border border-rule bg-surface p-4 md:order-2 md:self-start"
        >
          <h2 id="paste-heading" className="eyebrow mb-4">
            Add posting
          </h2>
          <PasteForm />
        </section>
      </div>
    </Shell>
  );
}
