import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { reparseJob } from "@/lib/jobs/actions";
import { firstLine, formatComp, formatDate } from "@/lib/jobs/format";
import type { JobRow } from "@/lib/jobs/schema";

// Dense list per DESIGN.md §4: 40px rows, sticky eyebrow header, hairlines,
// no zebra, every figure in mono. No score column yet — that is Phase 4, and
// rendering a placeholder gauge would be decoration.
export function JobsTable({ jobs }: { jobs: JobRow[] }) {
  if (jobs.length === 0) {
    return (
      <div className="rounded-lg border border-rule bg-surface px-4 py-12 text-center">
        <p className="text-body text-ink">Paste a job posting to store it.</p>
        <p className="mt-1 text-small text-graphite">Stored postings appear here, newest first.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-rule bg-surface">
      <Table className="text-small">
        <TableHeader className="sticky top-0 bg-surface [&_tr]:border-b [&_tr]:border-rule-strong">
          <TableRow className="hover:bg-transparent">
            <TableHead className="eyebrow h-10 w-[104px]">Stored</TableHead>
            <TableHead className="eyebrow h-10">Role</TableHead>
            <TableHead className="eyebrow h-10 w-[72px]">Level</TableHead>
            <TableHead className="eyebrow h-10 w-[72px]">Remote</TableHead>
            <TableHead className="eyebrow h-10 w-[128px] text-right">Comp</TableHead>
            <TableHead className="eyebrow h-10 w-[56px] text-right">Flags</TableHead>
            <TableHead className="eyebrow h-10 w-[88px]">Parse</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map((job) => (
            <TableRow key={job.id} className="h-10 border-rule hover:bg-surface-sunken/40">
              <TableCell className="font-mono text-graphite">
                <time dateTime={job.first_seen}>{formatDate(job.first_seen)}</time>
              </TableCell>
              <TableCell className="max-w-0">
                <Link href={`/jobs/${job.id}`} className="block truncate text-ink hover:underline underline-offset-2">
                  {job.title ?? firstLine(job.raw.text)}
                </Link>
                {job.company_name || job.location ? (
                  <span className="block truncate text-micro text-graphite">
                    {[job.company_name, job.location, job.country].filter(Boolean).join(" · ")}
                  </span>
                ) : null}
              </TableCell>
              <TableCell className="font-mono text-graphite">{job.seniority ?? "—"}</TableCell>
              <TableCell className="font-mono text-graphite">{job.remote_policy ?? "—"}</TableCell>
              <TableCell className="text-right font-mono text-graphite">{formatComp(job)}</TableCell>
              <TableCell className="text-right font-mono text-graphite">
                {job.red_flags ? job.red_flags.length : "—"}
              </TableCell>
              <TableCell>
                {job.parsed_at ? (
                  <Badge>parsed</Badge>
                ) : (
                  <form action={reparseJob}>
                    <input type="hidden" name="id" value={job.id} />
                    <Button type="submit" variant="outline" size="xs">
                      Parse
                    </Button>
                  </form>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block rounded-sm border border-rule bg-surface-sunken px-1.5 font-mono text-micro uppercase leading-[18px] tracking-[0.08em] text-graphite">
      {children}
    </span>
  );
}
