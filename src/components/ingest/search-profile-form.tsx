"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveSearchProfile, type SaveSearchState } from "@/lib/ingest/actions";
import type { SearchProfileRow } from "@/lib/ingest/filter";

const initial: SaveSearchState = { status: "idle" };

export function SearchProfileForm({ sp }: { sp?: SearchProfileRow }) {
  const [state, action, pending] = useActionState(saveSearchProfile, initial);
  const Check = ({ name, value, checked }: { name: string; value: string; checked?: boolean }) => (
    <label className="flex items-center gap-1.5 font-mono text-small text-ink">
      <input type="checkbox" name={name} value={value} defaultChecked={checked} className="accent-[var(--ink)]" /> {value}
    </label>
  );
  return (
    <form action={action} className="flex flex-col gap-4">
      {sp ? <input type="hidden" name="id" value={sp.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="flex flex-col gap-1">
          <span className="eyebrow">Name</span>
          <Input name="name" defaultValue={sp?.name ?? ""} placeholder="e.g. Nordic frontend, remote EU senior React" required />
        </label>
        <label className="flex items-end gap-2 pb-1 font-mono text-small text-ink">
          <input type="checkbox" name="enabled" defaultChecked={sp?.enabled ?? true} className="accent-[var(--ink)]" /> enabled
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="eyebrow">Title keywords (comma-separated; any must appear in the title)</span>
        <Input name="titles" defaultValue={sp?.titles.join(", ") ?? ""} placeholder="frontend, full-stack, fullstack, software engineer, react" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="eyebrow">Countries (ISO codes; fully remote jobs always pass)</span>
        <Input name="countries" defaultValue={sp?.countries.join(", ") ?? ""} placeholder="DK, SE, NO, FI, NL, DE, RO" className="font-mono" />
      </label>
      <fieldset className="flex flex-wrap gap-x-4 gap-y-2">
        <legend className="eyebrow mb-1">Remote policy (none = any)</legend>
        {["remote", "hybrid", "onsite"].map((v) => <Check key={v} name="remote_policy" value={v} checked={sp?.remote_policy.includes(v)} />)}
      </fieldset>
      <fieldset className="flex flex-wrap gap-x-4 gap-y-2">
        <legend className="eyebrow mb-1">Seniority (none = any)</legend>
        {["junior", "mid", "senior", "staff", "lead"].map((v) => <Check key={v} name="seniority" value={v} checked={sp?.seniority.includes(v)} />)}
      </fieldset>
      <fieldset className="flex flex-wrap gap-x-4 gap-y-2">
        <legend className="eyebrow mb-1">Employment type (none = any)</legend>
        {["permanent", "contract"].map((v) => <Check key={v} name="employment_type" value={v} checked={sp?.employment_type.includes(v)} />)}
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="eyebrow">Exclude keywords</span>
          <Input name="exclude_keywords" defaultValue={sp?.exclude_keywords.join(", ") ?? ""} placeholder="clearance, relocation required" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="eyebrow">Exclude companies</span>
          <Input name="exclude_companies" defaultValue={sp?.exclude_companies.join(", ") ?? ""} />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving" : sp ? "Save" : "Create"}
        </Button>
        {state.status === "saved" ? <span className="text-small text-graphite">Saved.</span> : null}
        {state.status === "error" ? <span className="text-small text-signal-destructive">{state.message}</span> : null}
      </div>
    </form>
  );
}
