import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { reparseJob } from "@/lib/jobs/actions";
import { firstLine, formatComp } from "@/lib/jobs/format";
import type { JobRow } from "@/lib/jobs/schema";
import { PARSER_VERSION } from "@/lib/parse/job-parser";
import { CalibrationBar } from "@/components/match/calibration-bar";
import { scoreJob } from "@/lib/match/actions";
import { COLLAPSE_BELOW } from "@/lib/match/bands";
import type { MatchRow } from "@/lib/match/schema";

// Dense list per DESIGN.md §4: 40px rows, sticky eyebrow header, hairlines,
// no zebra, every figure in mono. No score column yet — that is Phase 4, and
// rendering a placeholder gauge would be decoration.
export function JobsTable({
  jobs,
  matches,
  canScore,
}: {
  jobs: JobRow[];
  matches: Map<string, MatchRow>;
  canScore: boolean;
}) {
  if (jobs.length === 0) {
    return (
      <div className="rounded-lg border border-rule bg-surface px-4 py-12 text-center">
        <p className="text-body text-ink">Paste a job posting to store it.</p>
        <p className="mt-1 text-small text-graphite">Stored postings appear here, newest first.</p>
      </div>
    );
  }

  // Morning-queue order: scored rows by score desc, then unscored by date.
  // Rows under the threshold are collapsed, not hidden (CLAUDE.md "Daily
  // loop" §3) — the user can audit what was filtered.
  const scoreOf = (j: JobRow) => matches.get(j.id)?.score ?? -1;
  const sorted = [...jobs].sort((a, b) => scoreOf(b) - scoreOf(a) || b.first_seen.localeCompare(a.first_seen));
  const visible = sorted.filter((j) => scoreOf(j) < 0 || scoreOf(j) >= COLLAPSE_BELOW);
  const collapsed = sorted.filter((j) => scoreOf(j) >= 0 && scoreOf(j) < COLLAPSE_BELOW);

  return (
    <>
      <Rows jobs={visible} matches={matches} canScore={canScore} />
      {collapsed.length > 0 ? (
        <details className="mt-3">
          <summary className="eyebrow cursor-pointer select-none">
            {collapsed.length} below {COLLAPSE_BELOW} — collapsed
          </summary>
          <div className="mt-2">
            <Rows jobs={collapsed} matches={matches} canScore={canScore} />
          </div>
        </details>
      ) : null}
    </>
  );
}

function Rows({ jobs, matches, canScore }: { jobs: JobRow[]; matches: Map<string, MatchRow>; canScore: boolean }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-rule bg-surface">
      <Table className="text-small">
        <TableHeader className="sticky top-0 bg-surface [&_tr]:border-b [&_tr]:border-rule-strong">
          <TableRow className="hover:bg-transparent">
            <TableHead className="eyebrow h-10 w-[120px]">Score</TableHead>
            <TableHead className="eyebrow h-10 min-w-[220px]">Role</TableHead>
            <TableHead className="eyebrow h-10 w-[72px]">Level</TableHead>
            <TableHead className="eyebrow h-10 w-[72px]">Remote</TableHead>
            <TableHead className="eyebrow h-10 w-[128px] text-right">Comp</TableHead>
            <TableHead className="eyebrow h-10 w-[56px] text-right">Flags</TableHead>
            <TableHead className="eyebrow h-10 w-[88px]">State</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map((job) => {
            const m = matches.get(job.id);
            return (
            <TableRow key={job.id} className="h-10 border-rule hover:bg-surface-sunken/40">
              <TableCell>
                {m ? (
                  <CalibrationBar score={m.score} verdict={m.verdict} />
                ) : canScore && job.parsed_at ? (
                  <form action={scoreJob}>
                    <input type="hidden" name="id" value={job.id} />
                    <Button type="submit" variant="outline" size="xs">
                      Score
                    </Button>
                  </form>
                ) : (
                  <span className="font-mono text-graphite">—</span>
                )}
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
                {job.parser_version === PARSER_VERSION ? (
                  <Badge>parsed</Badge>
                ) : (
                  // Never parsed, or parsed by an older prompt/model. Either
                  // way the current parser has not seen it.
                  <form action={reparseJob}>
                    <input type="hidden" name="id" value={job.id} />
                    <Button type="submit" variant="outline" size="xs">
                      {job.parsed_at ? "Re-parse" : "Parse"}
                    </Button>
                  </form>
                )}
              </TableCell>
            </TableRow>
            );
          })}
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
