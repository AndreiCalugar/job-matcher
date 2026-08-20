"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addAggregatorSource, addCompanySource, type AddSourceState } from "@/lib/ingest/actions";

const initial: AddSourceState = { status: "idle" };

export function AddCompanyForm() {
  const [state, action, pending] = useActionState(addCompanySource, initial);
  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="eyebrow">Careers page URL</span>
        <Input name="url" placeholder="https://boards.greenhouse.io/company  ·  jobs.lever.co/company  ·  jobs.ashbyhq.com/company" className="font-mono text-small" required />
      </label>
      <label className="flex flex-col gap-1">
        <span className="eyebrow">Company name (optional)</span>
        <Input name="name" placeholder="Defaults to the board token" />
      </label>
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Adding" : "Subscribe"}
        </Button>
        <Msg state={state} />
      </div>
    </form>
  );
}

export function AddAggregatorForm() {
  const [state, action, pending] = useActionState(addAggregatorSource, initial);
  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
        <label className="flex flex-col gap-1">
          <span className="eyebrow">Board</span>
          <select name="kind" className="h-8 rounded-md border border-rule bg-surface px-2 font-mono text-small text-ink" defaultValue="jobicy">
            <option value="jobicy">jobicy (remote, EU)</option>
            <option value="arbeitnow">arbeitnow (DACH + remote)</option>
            <option value="remoteok">remoteok</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="eyebrow">Query (jobicy: comma-separated tags)</span>
          <Input name="identifier" placeholder="react,typescript,node" className="font-mono text-small" />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending ? "Adding" : "Add query"}
        </Button>
        <Msg state={state} />
      </div>
    </form>
  );
}

function Msg({ state }: { state: AddSourceState }) {
  if (state.status === "added") return <p className="text-small text-graphite">Added {state.kind}/{state.identifier}. It runs on the next ingest.</p>;
  if (state.status === "error") return <p className="text-small text-signal-destructive">{state.message}</p>;
  return null;
}
