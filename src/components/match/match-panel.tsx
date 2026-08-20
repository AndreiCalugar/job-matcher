import Link from "next/link";
import { CalibrationBar } from "@/components/match/calibration-bar";
import { Button } from "@/components/ui/button";
import { scoreJob } from "@/lib/match/actions";
import type { MatchRow } from "@/lib/match/schema";
import { formatDate } from "@/lib/jobs/format";

// Match breakdown for one job. The pre-mortem is content, not a warning:
// body size, ink, full weight (DESIGN.md §7). Gaps are the product.
export function MatchPanel({ jobId, match, canScore }: { jobId: string; match: MatchRow | null; canScore: boolean }) {
  if (!match) {
    return (
      <section className="rounded-lg border border-rule bg-surface p-4">
        <h2 className="eyebrow mb-2">Match</h2>
        {canScore ? (
          <form action={scoreJob} className="flex items-center gap-3">
            <input type="hidden" name="id" value={jobId} />
            <Button type="submit" size="sm">
              Score against profile
            </Button>
            <span className="text-small text-graphite">Strong-tier call, 30–60 seconds.</span>
          </form>
        ) : (
          <p className="text-small text-graphite">Confirm your profile to score this posting.</p>
        )}
      </section>
    );
  }

  const critical = match.gaps.filter((g) => g.severity === "critical").length;
  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <CalibrationBar score={match.score} verdict={match.verdict} size="detail" sweep />
        <p className="font-mono text-small text-graphite">
          {match.verdict} match — {match.gaps.length} gap{match.gaps.length === 1 ? "" : "s"}
          {critical ? `, ${critical} critical` : ""}
        </p>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div>
          <h3 className="eyebrow mb-2">Matched · {match.matched_skills.length}</h3>
          {match.matched_skills.length ? (
            <ul className="divide-y divide-rule rounded-lg border border-rule bg-surface">
              {match.matched_skills.map((m, i) => (
                <li key={i} className="px-4 py-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-body text-ink">{m.skill}</span>
                    <span className="font-mono text-micro uppercase tracking-[0.08em] text-graphite">{m.importance_in_job}</span>
                  </div>
                  <p className="mt-0.5 text-small text-graphite">{m.evidence_from_profile}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-small text-graphite">Nothing in the profile meets a stated requirement.</p>
          )}
        </div>
        <div>
          <h3 className="eyebrow mb-2">Gaps · {match.gaps.length}</h3>
          {match.gaps.length ? (
            <ul className="divide-y divide-rule rounded-lg border border-rule bg-surface">
              {match.gaps.map((g, i) => (
                <li key={i} className="px-4 py-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-body text-ink">{g.skill}</span>
                    <span className="font-mono text-micro uppercase tracking-[0.08em] text-graphite">
                      {g.severity} · {g.mitigable ? "mitigable" : "hard"}
                    </span>
                  </div>
                  <p className="mt-0.5 text-small text-ink">{g.how_to_address}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-small text-graphite">No gaps against stated requirements.</p>
          )}
        </div>
      </div>

      <h3 className="eyebrow mt-8 mb-2">Pre-mortem</h3>
      <p className="max-w-[68ch] text-body text-ink">{match.premortem}</p>

      <h3 className="eyebrow mt-8 mb-2">Reasoning</h3>
      <p className="max-w-[68ch] text-body text-graphite">{match.reasoning}</p>

      <div className="mt-6 flex items-center gap-3">
        <Link href={`/jobs/${jobId}/kit`} className="inline-flex h-8 items-center rounded-md bg-ink px-3 text-body font-medium text-paper">
          Generate kit →
        </Link>
      <form action={scoreJob} className="flex items-center gap-3">
        <input type="hidden" name="id" value={jobId} />
        <input type="hidden" name="force" value="1" />
        <Button type="submit" variant="outline" size="xs">
          Re-score
        </Button>
        <span className="font-mono text-micro text-graphite">
          {match.prompt_version} · {match.model_version} · {formatDate(match.computed_at)}
        </span>
      </form>
      </div>
    </section>
  );
}
