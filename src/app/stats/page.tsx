import { Shell } from "@/components/shell";
import { CalibrationChart } from "@/components/tracking/calibration-chart";
import { listApplications, listMatchGaps } from "@/lib/tracking/queries";
import { requireUser } from "@/lib/auth/session";
import { getProfile } from "@/lib/cv/queries";
import { calibration, gapFrequency, medianDaysToResponse, rateBy, volumeByWeek } from "@/lib/tracking/stats";

export const dynamic = "force-dynamic";

// Statistics: the part a chat window cannot replace. Every number here is
// a plain aggregation over the user's own tracked applications.
export default async function StatsPage() {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  const [apps, matchGaps] = profile ? await Promise.all([listApplications(profile.id), listMatchGaps(profile.id)]) : [[], []];
  const bands = calibration(apps);
  const byAngle = rateBy(apps, (a) => a.angle);
  const bySource = rateBy(apps, (a) => a.job.source?.kind ?? null);
  const ghostBySource = rateBy(apps.filter((a) => a.status === "ghosted" || a.first_response_at), (a) => a.job.source?.kind ?? null);
  const median = medianDaysToResponse(apps);
  const weeks = volumeByWeek(apps);
  const gaps = gapFrequency(matchGaps);
  const pct = (r: number | null) => (r == null ? "—" : `${Math.round(r * 100)}%`);

  return (
    <Shell current="stats">
      <h1 className="font-display text-display font-semibold text-ink">Statistics</h1>
      <p className="mt-2 max-w-[68ch] text-body text-graphite">
        The score is a prediction. This page tests it against what actually happened. Nothing here is interpreted for you.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(360px,600px)_1fr]">
        <CalibrationChart bands={bands} />
        <div className="grid content-start gap-6">
          <section className="rounded-lg border border-rule bg-surface p-4">
            <h2 className="eyebrow mb-3">Headline</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-small">
              <dt className="text-graphite">Sent</dt><dd className="font-mono text-ink">{apps.length}</dd>
              <dt className="text-graphite">Responded</dt><dd className="font-mono text-ink">{apps.filter((a) => a.first_response_at).length} · {pct(apps.length ? apps.filter((a) => a.first_response_at).length / apps.length : null)}</dd>
              <dt className="text-graphite">Ghosted</dt><dd className="font-mono text-ink">{apps.filter((a) => a.status === "ghosted").length}</dd>
              <dt className="text-graphite">Median days to first response</dt><dd className="font-mono text-ink">{median ?? "—"}</dd>
            </dl>
          </section>
          <RateTable title="Response rate by angle" rows={byAngle} pct={pct} />
          <RateTable title="Response rate by source" rows={bySource} pct={pct} />
        </div>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <section className="rounded-lg border border-rule bg-surface p-4">
          <h2 className="eyebrow mb-3">Volume by week</h2>
          {weeks.length === 0 ? <Empty /> : (
            <table className="w-full text-small">
              <thead><tr className="[&>th]:eyebrow [&>th]:h-8 [&>th]:text-left"><th>Week</th><th className="text-right">Sent</th><th className="text-right">Responded</th></tr></thead>
              <tbody>{weeks.map((w) => (
                <tr key={w.week} className="h-8 border-t border-rule"><td className="font-mono text-ink">{w.week}</td><td className="text-right font-mono text-graphite">{w.sent}</td><td className="text-right font-mono text-graphite">{w.responded}</td></tr>
              ))}</tbody>
            </table>
          )}
        </section>
        <section className="rounded-lg border border-rule bg-surface p-4">
          <h2 className="eyebrow mb-1">Most frequent gaps</h2>
          <p className="mb-3 text-small text-graphite">Across stretch, weak and mismatch matches. The learning roadmap you did not write.</p>
          {gaps.length === 0 ? <Empty /> : (
            <table className="w-full text-small">
              <thead><tr className="[&>th]:eyebrow [&>th]:h-8 [&>th]:text-left"><th>Skill</th><th className="text-right">Gaps</th><th className="text-right">Critical</th></tr></thead>
              <tbody>{gaps.map((g) => (
                <tr key={g.skill} className="h-8 border-t border-rule"><td className="text-ink">{g.skill}</td><td className="text-right font-mono text-graphite">{g.count}</td><td className="text-right font-mono text-graphite">{g.critical}</td></tr>
              ))}</tbody>
            </table>
          )}
        </section>
      </div>
      {ghostBySource.length ? (
        <section className="mt-6 max-w-[600px] rounded-lg border border-rule bg-surface p-4">
          <h2 className="eyebrow mb-1">Ghost rate by source</h2>
          <p className="mb-3 text-small text-graphite">Of applications that have resolved (responded or ghosted). Reveals which boards carry stale postings.</p>
          <table className="w-full text-small"><tbody>{ghostBySource.map((r) => (
            <tr key={r.key} className="h-8 border-t border-rule"><td className="font-mono text-ink">{r.key}</td><td className="text-right font-mono text-graphite">{r.sent - r.responded} / {r.sent} ghosted</td></tr>
          ))}</tbody></table>
        </section>
      ) : null}
    </Shell>
  );
}

function RateTable({ title, rows, pct }: { title: string; rows: { key: string; sent: number; responded: number; rate: number | null }[]; pct: (r: number | null) => string }) {
  return (
    <section className="rounded-lg border border-rule bg-surface p-4">
      <h2 className="eyebrow mb-3">{title}</h2>
      {rows.length === 0 ? <Empty /> : (
        <table className="w-full text-small">
          <tbody>{rows.map((r) => (
            <tr key={r.key} className="h-8 border-t border-rule first:border-0">
              <td className="font-mono text-ink">{r.key.replace(/_/g, " ")}</td>
              <td className="text-right font-mono text-graphite">{r.responded} / {r.sent}</td>
              <td className="w-[56px] text-right font-mono text-ink">{pct(r.rate)}</td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </section>
  );
}

function Empty() {
  return <p className="text-small text-graphite">No sent applications yet.</p>;
}
