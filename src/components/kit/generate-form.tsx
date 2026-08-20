"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { generateKitAction, type GenerateState } from "@/lib/kit/actions";
import { ANGLE_LABEL, type Angle } from "@/lib/kit/schema";

const initial: GenerateState = { status: "idle" };

// Recipient is typed in by hand, one at a time (ADR 001). No lookup.
export function GenerateForm({ jobId, hasKit }: { jobId: string; hasKit: boolean }) {
  const [state, action, pending] = useActionState(generateKitAction, initial);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="job_id" value={jobId} />
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_140px]">
        <label className="flex flex-col gap-1">
          <span className="eyebrow">Recipient name (optional)</span>
          <Input name="recipient_name" placeholder="Only if you know who you are writing to" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="eyebrow">Their role</span>
          <Input name="recipient_role" placeholder="e.g. Engineering Manager" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="eyebrow">Channel</span>
          <select name="channel" defaultValue="email" className="h-8 rounded-md border border-rule bg-surface px-2 font-mono text-small text-ink">
            <option value="email">email</option>
            <option value="linkedin">linkedin</option>
            <option value="form">form</option>
            <option value="other">other</option>
          </select>
        </label>
      </div>
      <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <legend className="eyebrow mb-1">Angle</legend>
        <label className="flex items-center gap-1.5 text-small text-ink">
          <input type="radio" name="angle" value="" defaultChecked className="accent-[var(--ink)]" /> Let the model choose
        </label>
        {(Object.keys(ANGLE_LABEL) as Angle[]).map((a) => (
          <label key={a} className="flex items-center gap-1.5 text-small text-ink">
            <input type="radio" name="angle" value={a} className="accent-[var(--ink)]" /> {ANGLE_LABEL[a]}
          </label>
        ))}
      </fieldset>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Generating and checking — about a minute" : hasKit ? "Generate another version" : "Generate kit"}
        </Button>
        <Status state={state} />
      </div>
      {state.status === "blocked" ? (
        <div className="rounded-lg border border-rule bg-surface p-4">
          <p className="text-small text-ink">
            Generation blocked: the draft stated {state.issues.length} fact{state.issues.length === 1 ? "" : "s"} that exist nowhere in your profile or the posting. Nothing was saved. Generate again; if the fact is true, add it to your profile first.
          </p>
          <ul className="mt-2 font-mono text-micro text-graphite">
            {state.issues.map((i, n) => (
              <li key={n}>
                {i.check} · {i.where} — {i.detail}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </form>
  );
}

function Status({ state }: { state: GenerateState }) {
  switch (state.status) {
    case "generated":
      return <p className="text-small text-graphite">Kit generated and checked.</p>;
    case "failed":
      return <p className="text-small text-signal-destructive">{state.error}. Try again.</p>;
    case "skipped":
      return <p className="text-small text-signal-destructive">Cannot generate: {state.reason.replace("_", " ")}.</p>;
    default:
      return null;
  }
}
