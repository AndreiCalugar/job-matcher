import Link from "next/link";
import { redirect } from "next/navigation";
import { Shell } from "@/components/shell";
import { Badge } from "@/components/jobs/jobs-table";
import { UploadForm } from "@/components/profile/upload-form";
import { getProfile } from "@/lib/cv/queries";
import { formatDate } from "@/lib/jobs/format";

export const dynamic = "force-dynamic";
// Strong-model parse of a CV takes 20–40s; default function limits are lower.
export const maxDuration = 120;

export default async function ProfilePage() {
  const profile = await getProfile();

  if (!profile) {
    return (
      <Shell current="profile">
        <h1 className="font-display text-display font-semibold text-ink">Profile</h1>
        <p className="mt-2 max-w-[68ch] text-body text-graphite">
          Upload your CV once. It is parsed into a structured profile that you review and correct; that
          corrected profile is what every job is scored against.
        </p>
        <section className="mt-8 max-w-[640px] rounded-lg border border-rule bg-surface p-4">
          <UploadForm />
        </section>
      </Shell>
    );
  }

  // Non-skippable: a parsed but unreviewed profile always lands on review.
  if (!profile.human_corrected) redirect("/profile/review");

  return (
    <Shell current="profile">
      <header className="flex items-start justify-between gap-6">
        <div>
          <h1 className="font-display text-display font-semibold text-ink">{profile.headline ?? "Profile"}</h1>
          <p className="mt-1 font-mono text-small text-graphite">
            reviewed {profile.corrected_at ? formatDate(profile.corrected_at) : "—"} · parser {profile.parser_version}
          </p>
        </div>
        <Link href="/profile/review" className="inline-flex h-8 items-center rounded-md border border-rule px-3 text-body font-medium text-ink hover:bg-surface">
          Edit profile
        </Link>
      </header>

      {profile.summary ? <p className="mt-6 max-w-[68ch] text-body text-ink">{profile.summary}</p> : null}

      <div className="mt-8 grid gap-8 md:grid-cols-[minmax(360px,1fr)_minmax(300px,420px)]">
        <section>
          <h2 className="eyebrow mb-2">Experience</h2>
          <ul className="divide-y divide-rule rounded-lg border border-rule bg-surface">
            {profile.experience.map((x, i) => (
              <li key={i} className="px-4 py-3">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-body font-medium text-ink">
                    {x.title} <span className="text-graphite">· {x.company}</span>
                  </span>
                  <span className="shrink-0 font-mono text-small text-graphite">
                    {x.start ?? "?"} → {x.current ? "now" : (x.end ?? "?")}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  <Badge>{x.employment_type}</Badge>
                  {x.stack.map((s) => (
                    <Badge key={s}>{s}</Badge>
                  ))}
                </div>
                {x.bullets.length > 0 ? (
                  <ul className="mt-2 max-w-[68ch] list-disc pl-4 text-small text-ink">
                    {x.bullets.map((b, j) => (
                      <li key={j}>{b}</li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>

          {profile.projects.length > 0 ? (
            <>
              <h2 className="eyebrow mt-8 mb-2">Projects</h2>
              <ul className="divide-y divide-rule rounded-lg border border-rule bg-surface">
                {profile.projects.map((x, i) => (
                  <li key={i} className="px-4 py-3">
                    <span className="text-body font-medium text-ink">{x.name}</span>
                    {x.role ? <span className="text-graphite"> · {x.role}</span> : null}
                    <p className="mt-1 max-w-[68ch] text-small text-ink">{x.description}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {x.stack.map((s) => (
                        <Badge key={s}>{s}</Badge>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>

        <aside className="flex flex-col gap-8">
          <section>
            <h2 className="eyebrow mb-2">Skills · {profile.skills.length}</h2>
            <div className="overflow-x-auto rounded-lg border border-rule bg-surface">
              <table className="w-full text-small">
                <tbody>
                  {profile.skills.map((s) => (
                    <tr key={s.name} className="h-8 border-b border-rule last:border-0">
                      <td className="px-3 text-ink">{s.name}</td>
                      <td className="px-3 font-mono text-graphite">{s.category}</td>
                      <td className="px-3 font-mono text-graphite">{s.proficiency}</td>
                      <td className="px-3 text-right font-mono text-graphite">{s.years != null ? `${s.years}y` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section>
            <h2 className="eyebrow mb-2">Education</h2>
            <ul className="divide-y divide-rule rounded-lg border border-rule bg-surface">
              {profile.education.map((e, i) => (
                <li key={i} className="flex items-baseline justify-between gap-4 px-3 py-2 text-small">
                  <span className="text-ink">
                    {e.degree ?? e.field ?? "—"} <span className="text-graphite">· {e.institution}</span>
                  </span>
                  <span className="font-mono text-graphite">{e.start ?? "?"}–{e.end ?? "?"}</span>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h2 className="eyebrow mb-2">Languages</h2>
            <div className="flex flex-wrap gap-1">
              {profile.languages.map((l) => (
                <Badge key={l.name}>
                  {l.name} · {l.level}
                </Badge>
              ))}
            </div>
          </section>
          <details className="rounded-lg border border-rule bg-surface p-4">
            <summary className="eyebrow cursor-pointer">Upload a different CV</summary>
            <p className="mt-2 mb-4 text-small text-graphite">
              Creates a new profile that you review again. The current one is kept.
            </p>
            <UploadForm />
          </details>
        </aside>
      </div>
    </Shell>
  );
}
