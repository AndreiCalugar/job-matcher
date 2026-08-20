import { Shell } from "@/components/shell";
import { requireUser } from "@/lib/auth/session";
import { getProfile } from "@/lib/cv/queries";
import { Badge } from "@/components/jobs/jobs-table";
import { AddAggregatorForm, AddCompanyForm } from "@/components/ingest/source-forms";
import { Button } from "@/components/ui/button";
import { deleteSource, setSourceEnabled } from "@/lib/ingest/actions";
import { listSources } from "@/lib/ingest/queries";

export const dynamic = "force-dynamic";

// Run log + subscriptions. Know a feed broke without discovering it three
// weeks later (CLAUDE.md "Failure discipline").
export default async function SourcesPage() {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  const sources = profile ? await listSources(profile.id) : [];
  return (
    <Shell current="sources">
      <h1 className="font-display text-display font-semibold text-ink">Sources</h1>
      <p className="mt-2 max-w-[68ch] text-body text-graphite">
        Company feeds are polled every six hours by the ingest job. New postings are parsed; those matching a search profile are scored.
      </p>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <section className="rounded-lg border border-rule bg-surface p-4">
          <h2 className="eyebrow mb-3">Subscribe to a company</h2>
          <AddCompanyForm />
        </section>
        <section className="rounded-lg border border-rule bg-surface p-4">
          <h2 className="eyebrow mb-3">Add an aggregator query</h2>
          <AddAggregatorForm />
        </section>
      </div>

      <section className="mt-8">
        <h2 className="eyebrow mb-2">Subscribed · {sources.length}</h2>
        {sources.length === 0 ? (
          <p className="rounded-lg border border-rule bg-surface px-4 py-8 text-center text-body text-graphite">Paste a careers URL to subscribe to a company.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-rule bg-surface">
            <table className="w-full text-small">
              <thead className="border-b border-rule-strong">
                <tr className="[&>th]:eyebrow [&>th]:h-10 [&>th]:px-3 [&>th]:text-left">
                  <th>Source</th>
                  <th>Identifier</th>
                  <th>Last run</th>
                  <th className="text-right">Seen</th>
                  <th className="text-right">New</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sources.map((s) => (
                  <tr key={s.id} className="h-10 border-b border-rule last:border-0 [&>td]:px-3">
                    <td>
                      <Badge>{s.kind}</Badge>
                      {s.company ? <span className="ml-2 text-ink">{s.company.name}</span> : null}
                    </td>
                    <td className="font-mono text-graphite">{s.identifier}</td>
                    <td className="font-mono text-graphite">{s.last_run_at ? s.last_run_at.slice(0, 16).replace("T", " ") : "never"}</td>
                    <td className="text-right font-mono text-graphite">{s.last_run_seen ?? "—"}</td>
                    <td className="text-right font-mono text-graphite">{s.last_run_new ?? "—"}</td>
                    <td>
                      {!s.enabled ? (
                        <Badge>disabled</Badge>
                      ) : s.last_run_status === "error" ? (
                        <span className="font-mono text-micro text-signal-destructive" title={s.last_error ?? ""}>
                          error · {(s.last_error ?? "").slice(0, 60)}
                        </span>
                      ) : (
                        <Badge>{s.last_run_status ?? "pending"}</Badge>
                      )}
                    </td>
                    <td className="text-right">
                      <div className="inline-flex gap-1">
                        <form action={setSourceEnabled}>
                          <input type="hidden" name="id" value={s.id} />
                          <input type="hidden" name="enabled" value={s.enabled ? "0" : "1"} />
                          <Button type="submit" size="xs" variant="ghost">
                            {s.enabled ? "Disable" : "Enable"}
                          </Button>
                        </form>
                        <form action={deleteSource}>
                          <input type="hidden" name="id" value={s.id} />
                          <Button type="submit" size="xs" variant="ghost" className="text-graphite hover:text-signal-destructive">
                            Remove
                          </Button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </Shell>
  );
}
