import { Shell } from "@/components/shell";
import { JobsTable } from "@/components/jobs/jobs-table";
import { PasteForm } from "@/components/jobs/paste-form";
import { listJobs } from "@/lib/jobs/queries";

// Reads on every request: the list must reflect the write that just happened.
export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const jobs = await listJobs();

  return (
    <Shell>
      <header className="flex items-baseline justify-between">
        <h1 className="font-display text-display font-semibold text-ink">Jobs</h1>
        <p className="font-mono text-small text-graphite">
          {jobs.length.toLocaleString("en-GB")} stored
        </p>
      </header>

      {/* DESIGN.md §5: two-pane on desktop, stacked below 1024px. The list
          never collapses below 360px. */}
      <div className="mt-8 grid gap-6 md:grid-cols-[minmax(360px,1fr)_minmax(320px,420px)]">
        <section aria-labelledby="list-heading" className="min-w-0 md:order-1">
          <h2 id="list-heading" className="eyebrow mb-2">
            Stored postings
          </h2>
          <JobsTable jobs={jobs} />
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
