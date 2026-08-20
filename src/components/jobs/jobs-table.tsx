import type { JobRow } from "@/lib/jobs/schema";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Dense list per DESIGN.md §4: 40px rows, sticky eyebrow header, hairlines,
// no zebra, every figure in mono. No score column yet — that is Phase 4, and
// rendering a placeholder gauge would be decoration.
export function JobsTable({ jobs }: { jobs: JobRow[] }) {
  if (jobs.length === 0) {
    return (
      <div className="rounded-lg border border-rule bg-surface px-4 py-12 text-center">
        <p className="text-body text-ink">Paste a job posting to store it.</p>
        <p className="mt-1 text-small text-graphite">
          Stored postings appear here, newest first.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-rule bg-surface">
      <Table className="text-small">
        <TableHeader className="sticky top-0 bg-surface [&_tr]:border-b [&_tr]:border-rule-strong">
          <TableRow className="hover:bg-transparent">
            <TableHead className="eyebrow h-10 w-[104px]">Stored</TableHead>
            <TableHead className="eyebrow h-10 w-[88px]">Source</TableHead>
            <TableHead className="eyebrow h-10">Posting</TableHead>
            <TableHead className="eyebrow h-10 w-[140px]">URL</TableHead>
            <TableHead className="eyebrow h-10 w-[72px] text-right">Chars</TableHead>
            <TableHead className="eyebrow h-10 w-[88px]">Hash</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map((job) => (
            <TableRow key={job.id} className="h-10 border-rule hover:bg-surface-sunken/40">
              <TableCell className="font-mono text-graphite">
                <time dateTime={job.first_seen}>{formatDate(job.first_seen)}</time>
              </TableCell>
              <TableCell>
                <span className="inline-block rounded-sm border border-rule bg-surface-sunken px-1.5 font-mono text-micro uppercase leading-[18px] tracking-[0.08em] text-graphite">
                  {job.source.kind}
                </span>
              </TableCell>
              <TableCell className="max-w-0">
                <span className="block truncate text-ink" title={firstLine(job.raw.text)}>
                  {firstLine(job.raw.text)}
                </span>
              </TableCell>
              <TableCell className="max-w-0">
                {job.url ? (
                  <a
                    href={job.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="block truncate font-mono text-graphite underline-offset-2 hover:text-ink hover:underline"
                    title={job.url}
                  >
                    {host(job.url)}
                  </a>
                ) : (
                  <span className="font-mono text-graphite">—</span>
                )}
              </TableCell>
              <TableCell className="text-right font-mono text-graphite">
                {job.raw.text.length.toLocaleString("en-GB")}
              </TableCell>
              <TableCell className="font-mono text-graphite" title={job.content_hash}>
                {job.content_hash.slice(0, 8)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ISO date, fixed-width by construction, locale-independent across server
// and client so it never mismatches on hydration.
function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

function firstLine(text: string): string {
  const line = text.split("\n").find((l) => l.trim().length > 0) ?? "";
  return line.trim().slice(0, 140);
}

function host(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}
