import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell } from "@/components/shell";
import { CalibrationBar } from "@/components/match/calibration-bar";
import { GenerateForm } from "@/components/kit/generate-form";
import { KitView } from "@/components/kit/kit-view";
import { getProfile } from "@/lib/cv/queries";
import { getJob } from "@/lib/jobs/queries";
import { getLatestKit, getRecentBlocks } from "@/lib/kit/queries";
import { getMatchForJob } from "@/lib/match/queries";
import { requireUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
// Generate (strong tier) + verify (cheap tier) in one action.
export const maxDuration = 180;

export default async function KitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const profile = await getProfile(user.id);
  const job = await getJob(id, profile?.id ?? null);
  if (!job) notFound();
  const [match, kit] = profile
    ? await Promise.all([getMatchForJob(id, profile.id), getLatestKit(id, profile.id)])
    : [null, null];
  const blocks = match && !kit ? await getRecentBlocks(match.id) : [];

  return (
    <Shell current="jobs">
      <Link href={`/jobs/${id}`} className="text-small text-graphite hover:text-ink">
        ← {job.title ?? "Job"}
      </Link>
      <header className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-display font-semibold text-ink">Application kit</h1>
          <p className="mt-1 text-body text-graphite">
            {job.title} · {[job.company_name, job.location].filter(Boolean).join(" · ")}
          </p>
        </div>
        {match ? <CalibrationBar score={match.score} verdict={match.verdict} size="detail" /> : null}
      </header>

      {!match ? (
        <p className="mt-8 text-body text-graphite">
          Score this job first.{" "}
          <Link href={`/jobs/${id}`} className="text-ink underline underline-offset-2">
            Back to the job →
          </Link>
        </p>
      ) : !profile?.human_corrected ? (
        <p className="mt-8 text-body text-graphite">Confirm your profile before generating material.</p>
      ) : (
        <>
          <section className="mt-8 rounded-lg border border-rule bg-surface p-4">
            <h2 className="eyebrow mb-4">{kit ? "Regenerate" : "Generate"}</h2>
            <GenerateForm jobId={id} hasKit={!!kit} />
            {blocks.length > 0 ? (
              <div className="mt-4 border-t border-rule pt-3">
                <h3 className="eyebrow mb-1">Recent blocked attempts</h3>
                <ul className="font-mono text-micro text-graphite">
                  {blocks.map((b) => (
                    <li key={b.id}>
                      {b.created_at.slice(0, 16).replace("T", " ")} — {b.reasons.length} unsupported: {b.reasons.map((r) => r.detail).join(" · ").slice(0, 200)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
          {kit ? (
            <div className="mt-8">
              <KitView kit={kit} jobId={id} applyUrl={job.url} />
            </div>
          ) : null}
        </>
      )}
    </Shell>
  );
}
