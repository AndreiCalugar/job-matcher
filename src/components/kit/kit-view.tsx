import { CopyButton } from "@/components/kit/copy-button";
import { Badge } from "@/components/jobs/jobs-table";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { markSent, saveKitText, setChangeAccepted } from "@/lib/kit/actions";
import { ANGLE_LABEL, type KitRow } from "@/lib/kit/schema";
import { formatDate } from "@/lib/jobs/format";

// One generated kit. Every section is something the user edits in their own
// tool and sends themselves (CLAUDE.md "Automate preparation, never
// submission"). The CV diff is advice with accept/reject; the letter is an
// editable draft; "Mark as sent" records what actually went out.
export function KitView({ kit, jobId, applyUrl }: { kit: KitRow; jobId: string; applyUrl: string | null }) {
  const accepted = kit.cv_changes.filter((c) => c.accepted === true).length;
  const decided = kit.cv_changes.filter((c) => c.accepted != null).length;
  const warnings = [...kit.gate_report.deterministic, ...kit.gate_report.verifier].filter((i) => i.level === "warn");
  const warningsFor = (where: string) => warnings.filter((w) => w.where === where);
  const proseWarnings = warnings.filter((w) => w.where.startsWith("sentence") || w.where === "cover_letter" || w.where === "outreach_body");
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center gap-2 font-mono text-micro text-graphite">
        <Badge>v{kit.version}</Badge>
        <Badge>{ANGLE_LABEL[kit.angle].toLowerCase()}</Badge>
        {kit.edited_by_user ? <Badge>edited</Badge> : null}
        {kit.sent_at ? <Badge>sent {formatDate(kit.sent_at)}</Badge> : null}
        <span>
          {kit.prompt_version} · {kit.model_version} · {formatDate(kit.generated_at)} · {kit.claims.length} claims traced
          {warnings.length ? ` · ${warnings.length} to check` : " · no warnings"}
        </span>
      </div>

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="eyebrow">
            CV changes · {kit.cv_changes.length}
            <span className="ml-2 font-mono normal-case tracking-normal">
              {accepted} accepted / {decided} decided
            </span>
          </h2>
          <p className="text-small text-graphite">Apply these in your own CV file. Reorder, reweight, rephrase — nothing here adds a claim.</p>
        </div>
        <ul className="divide-y divide-rule rounded-lg border border-rule bg-surface">
          {kit.cv_changes.map((c, i) => (
            <li key={i} className="grid gap-3 px-4 py-3 md:grid-cols-[120px_1fr_auto]">
              <div className="font-mono text-micro text-graphite">
                <div className="uppercase tracking-[0.08em]">{c.severity}</div>
                <div className="mt-1 break-all">{c.path}</div>
              </div>
              <div className="min-w-0">
                {c.current ? (
                  <p className="text-small text-graphite line-through decoration-rule-strong">{c.current}</p>
                ) : null}
                <p className="text-body text-ink">{c.suggested}</p>
                <p className="mt-1 text-small text-graphite">{c.reason}</p>
                {warningsFor(`cv_changes[${i}]`).map((w, k) => (
                  <p key={k} className="mt-1 text-small text-ink">
                    <span className="eyebrow">Check</span> {w.detail}
                  </p>
                ))}
              </div>
              <div className="flex items-start gap-1">
                {([true, false] as const).map((v) => (
                  <form key={String(v)} action={setChangeAccepted}>
                    <input type="hidden" name="kit_id" value={kit.id} />
                    <input type="hidden" name="job_id" value={jobId} />
                    <input type="hidden" name="index" value={i} />
                    <input type="hidden" name="accepted" value={v ? "1" : "0"} />
                    <Button type="submit" size="xs" variant={c.accepted === v ? "default" : "outline"}>
                      {v ? "Accept" : "Reject"}
                    </Button>
                  </form>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <form action={saveKitText} className="flex flex-col gap-6">
        <input type="hidden" name="kit_id" value={kit.id} />
        <input type="hidden" name="job_id" value={jobId} />
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="eyebrow">Cover letter</h2>
            <CopyButton text={kit.cover_letter} />
          </div>
          <Textarea name="cover_letter" defaultValue={kit.cover_letter} rows={14} className="max-w-[72ch] font-sans text-body" />
          {proseWarnings.length ? (
            <div className="mt-2 max-w-[72ch] rounded-lg border border-rule bg-surface p-3">
              <p className="eyebrow mb-1">Check these against your CV before sending</p>
              <ul className="text-small text-ink">
                {proseWarnings.map((w, k) => (
                  <li key={k} className="mt-1">{w.detail}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
        {kit.outreach_body ? (
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="eyebrow">
                Outreach · {kit.channel} · {kit.recipient_name}
                {kit.recipient_role ? ` (${kit.recipient_role})` : ""}
              </h2>
              <CopyButton text={kit.outreach_subject ? `${kit.outreach_subject}\n\n${kit.outreach_body}` : kit.outreach_body} />
            </div>
            {kit.outreach_subject ? <p className="mb-2 font-mono text-small text-ink">Subject: {kit.outreach_subject}</p> : null}
            <Textarea name="outreach_body" defaultValue={kit.outreach_body} rows={7} className="max-w-[72ch] font-sans text-body" />
          </section>
        ) : null}
        <div>
          <Button type="submit" variant="outline" size="sm">
            Save edits
          </Button>
        </div>
      </form>

      <section>
        <h2 className="eyebrow mb-2">Gap handling</h2>
        {kit.gap_handling.length ? (
          <ul className="divide-y divide-rule rounded-lg border border-rule bg-surface">
            {kit.gap_handling.map((g, i) => (
              <li key={i} className="px-4 py-2">
                <span className="text-body text-ink">{g.gap}</span>
                <p className="text-small text-graphite">{g.approach}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-small text-graphite">No critical or important gaps to handle.</p>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="eyebrow">ATS-safe export</h2>
          <CopyButton text={kit.ats_export} />
        </div>
        <p className="mb-2 max-w-[68ch] text-small text-graphite">
          Single column, standard headings, generated from your reviewed profile with this posting&apos;s must-haves first. Keep the designed CV for humans; send this where a machine reads first.
        </p>
        <pre className="max-h-[360px] overflow-auto whitespace-pre-wrap rounded-lg border border-rule bg-surface-sunken p-4 font-mono text-small text-ink">{kit.ats_export}</pre>
      </section>

      <section className="rounded-lg border border-rule bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="eyebrow">Send it yourself</h2>
          {applyUrl ? (
            <a href={applyUrl} target="_blank" rel="noreferrer noopener" className="inline-flex h-8 items-center rounded-md bg-ink px-3 text-body font-medium text-paper">
              Open application page ↗
            </a>
          ) : null}
        </div>
        <p className="mt-2 max-w-[68ch] text-small text-graphite">
          Nothing is submitted from here. Paste the letter into the form or email, then record what you actually sent — the difference between the draft and this is how the model learns.
        </p>
        <form action={markSent} className="mt-4 flex flex-col gap-3">
          <input type="hidden" name="kit_id" value={kit.id} />
          <input type="hidden" name="job_id" value={jobId} />
          <Textarea name="final_sent_body" defaultValue={kit.final_sent_body ?? kit.cover_letter} rows={8} className="max-w-[72ch] font-sans text-body" />
          <div>
            <Button type="submit" size="sm">
              {kit.sent_at ? "Update sent copy" : "Mark as sent"}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
