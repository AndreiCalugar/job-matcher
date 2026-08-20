import Link from "next/link";
import { Shell } from "@/components/shell";
import { Badge } from "@/components/jobs/jobs-table";
import { CalibrationBar } from "@/components/match/calibration-bar";
import { StatusControl } from "@/components/tracking/status-control";
import { verdictFor } from "@/lib/match/bands";
import { formatDate } from "@/lib/jobs/format";
import { daysBetween } from "@/lib/tracking/schema";
import { listApplications } from "@/lib/tracking/queries";
import { statusCounts } from "@/lib/tracking/stats";

export const dynamic = "force-dynamic";

// The pipeline. Ghosted is a first-class state, not a gap in the data.
export default async function ApplicationsPage() {
  const apps = await listApplications();
  const counts = statusCounts(apps);
  const now = new Date().toISOString();
  return (
    <Shell current="applications">
      <header className="flex items-baseline justify-between">
        <h1 className="font-display text-display font-semibold text-ink">Applications</h1>
        <p className="font-mono text-small text-graphite">{apps.length} sent</p>
      </header>
      <div className="mt-3 flex flex-wrap gap-1">
        {Object.entries(counts).map(([s, n]) => (
          <Badge key={s}>{s} · {n}</Badge>
        ))}
      </div>

      {apps.length === 0 ? (
        <p className="mt-8 rounded-lg border border-rule bg-surface px-4 py-12 text-center text-body text-graphite">
          Mark a kit as sent to start tracking it here.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-rule bg-surface">
          <table className="w-full text-small">
            <thead className="sticky top-0 bg-surface [&_tr]:border-b [&_tr]:border-rule-strong">
              <tr className="[&>th]:eyebrow [&>th]:h-10 [&>th]:px-3 [&>th]:text-left">
                <th className="w-[120px]">Score</th>
                <th className="min-w-[220px]">Role</th>
                <th>Angle</th>
                <th>Sent</th>
                <th className="text-right">Days</th>
                <th>Response</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((a) => (
                <tr key={a.id} className="h-10 border-b border-rule last:border-0 [&>td]:px-3">
                  <td>{a.score_at_send != null ? <CalibrationBar score={a.score_at_send} verdict={verdictFor(a.score_at_send)} /> : <span className="font-mono text-graphite">—</span>}</td>
                  <td className="max-w-0">
                    <Link href={`/jobs/${a.job_id}/kit`} className="block truncate text-ink hover:underline underline-offset-2">{a.job.title ?? "—"}</Link>
                    <span className="block truncate text-micro text-graphite">{[a.job.company_name, a.channel, a.job.source?.kind].filter(Boolean).join(" · ")}</span>
                  </td>
                  <td className="font-mono text-micro text-graphite">{a.angle?.replace(/_/g, " ") ?? "—"}</td>
                  <td className="font-mono text-graphite">{formatDate(a.sent_at)}</td>
                  <td className="text-right font-mono text-graphite">{daysBetween(a.sent_at, a.first_response_at ?? now)}</td>
                  <td className="font-mono text-micro text-graphite">{a.first_response_at ? `${formatDate(a.first_response_at)} · ${a.response_kind?.replace(/_/g, " ") ?? ""}` : "none yet"}</td>
                  <td><StatusControl id={a.id} current={a.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Shell>
  );
}
