"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveProfile, type SaveState } from "@/lib/cv/actions";
import type { Education, Experience, Language, ProfileEdit, Project, Skill } from "@/lib/cv/schema";

// The non-skippable review screen. Every parsed field is editable; lists
// can be added to or removed from. State is the whole ProfileEdit object,
// submitted as one JSON field and Zod-validated server-side. Nothing here
// is clever on purpose: the user is correcting a record, and the form
// should look like the record.

const initial: SaveState = { status: "idle" };

export function ProfileEditor({ id, profile, gaps }: { id: string; profile: ProfileEdit; gaps: string[] }) {
  const [p, setP] = useState<ProfileEdit>(profile);
  const [state, action, pending] = useActionState(saveProfile, initial);

  const set = <K extends keyof ProfileEdit>(k: K, v: ProfileEdit[K]) => setP((prev) => ({ ...prev, [k]: v }));
  const updateAt = <K extends "experience" | "skills" | "projects" | "education" | "languages">(
    k: K,
    i: number,
    patch: Partial<ProfileEdit[K][number]>,
  ) => set(k, p[k].map((item, j) => (j === i ? { ...item, ...patch } : item)) as ProfileEdit[K]);
  const removeAt = <K extends "experience" | "skills" | "projects" | "education" | "languages">(k: K, i: number) =>
    set(k, p[k].filter((_, j) => j !== i) as ProfileEdit[K]);

  return (
    <form action={action} className="flex flex-col gap-8">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="profile" value={JSON.stringify(p)} />

      {gaps.length > 0 ? (
        <section className="rounded-lg border border-rule bg-surface p-4">
          <h2 className="eyebrow mb-2">The parser noticed</h2>
          <ul className="max-w-[68ch] list-disc pl-4 text-body text-ink">
            {gaps.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <Section title="Headline and summary">
        <Field label="Headline">
          <Input value={p.headline ?? ""} onChange={(e) => set("headline", e.target.value || null)} />
        </Field>
        <Field label="Summary">
          <Textarea rows={4} value={p.summary ?? ""} onChange={(e) => set("summary", e.target.value || null)} />
        </Field>
      </Section>

      <Section
        title="Experience"
        count={p.experience.length}
        onAdd={() => set("experience", [...p.experience, blankExperience()])}
      >
        {p.experience.map((x, i) => (
          <Card key={i} onRemove={() => removeAt("experience", i)}>
            <Row>
              <Field label="Title">
                <Input value={x.title} onChange={(e) => updateAt("experience", i, { title: e.target.value })} />
              </Field>
              <Field label="Company">
                <Input value={x.company} onChange={(e) => updateAt("experience", i, { company: e.target.value })} />
              </Field>
            </Row>
            <Row>
              <Field label="Start (YYYY-MM)">
                <Input className="font-mono" value={x.start ?? ""} onChange={(e) => updateAt("experience", i, { start: e.target.value || null })} />
              </Field>
              <Field label="End (YYYY-MM)">
                <Input
                  className="font-mono"
                  value={x.end ?? ""}
                  disabled={x.current}
                  onChange={(e) => updateAt("experience", i, { end: e.target.value || null })}
                />
              </Field>
              <Field label="Current">
                <Check checked={x.current} onChange={(v) => updateAt("experience", i, { current: v, end: v ? null : x.end })} />
              </Field>
              <Field label="Type">
                <Select
                  value={x.employment_type}
                  options={["permanent", "contract", "freelance", "internship", "unclear"]}
                  onChange={(v) => updateAt("experience", i, { employment_type: v as Experience["employment_type"] })}
                />
              </Field>
              <Field label="Location">
                <Input value={x.location ?? ""} onChange={(e) => updateAt("experience", i, { location: e.target.value || null })} />
              </Field>
            </Row>
            <Field label="Bullets (one per line)">
              <Textarea rows={Math.max(3, x.bullets.length + 1)} value={x.bullets.join("\n")} onChange={(e) => updateAt("experience", i, { bullets: lines(e.target.value) })} />
            </Field>
            <Field label="Stack (comma-separated)">
              <Input className="font-mono" value={x.stack.join(", ")} onChange={(e) => updateAt("experience", i, { stack: csv(e.target.value) })} />
            </Field>
          </Card>
        ))}
      </Section>

      <Section title="Skills" count={p.skills.length} onAdd={() => set("skills", [...p.skills, blankSkill()])}>
        <div className="overflow-x-auto rounded-lg border border-rule bg-surface">
          <table className="w-full text-small">
            <thead className="border-b border-rule-strong">
              <tr className="[&>th]:eyebrow [&>th]:h-10 [&>th]:px-2 [&>th]:text-left">
                <th>Name</th>
                <th>Category</th>
                <th>Proficiency</th>
                <th className="w-[72px]">Years</th>
                <th>Evidence (one per line)</th>
                <th className="w-[40px]" />
              </tr>
            </thead>
            <tbody>
              {p.skills.map((s, i) => (
                <tr key={i} className="border-b border-rule align-top last:border-0 [&>td]:px-2 [&>td]:py-1">
                  <td className="w-[180px]">
                    <Input value={s.name} onChange={(e) => updateAt("skills", i, { name: e.target.value })} />
                  </td>
                  <td className="w-[130px]">
                    <Select value={s.category} options={["language", "framework", "platform", "tool", "domain", "practice", "other"]} onChange={(v) => updateAt("skills", i, { category: v as Skill["category"] })} />
                  </td>
                  <td className="w-[130px]">
                    <Select value={s.proficiency} options={["expert", "proficient", "working", "familiar", "unclear"]} onChange={(v) => updateAt("skills", i, { proficiency: v as Skill["proficiency"] })} />
                  </td>
                  <td>
                    <Input className="font-mono" inputMode="decimal" value={s.years ?? ""} onChange={(e) => updateAt("skills", i, { years: e.target.value === "" ? null : Number(e.target.value) })} />
                  </td>
                  <td>
                    <Textarea rows={Math.max(1, s.evidence.length)} className="min-h-8 py-1" value={s.evidence.join("\n")} onChange={(e) => updateAt("skills", i, { evidence: lines(e.target.value) })} />
                  </td>
                  <td>
                    <RemoveButton onClick={() => removeAt("skills", i)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Projects" count={p.projects.length} onAdd={() => set("projects", [...p.projects, blankProject()])}>
        {p.projects.map((x, i) => (
          <Card key={i} onRemove={() => removeAt("projects", i)}>
            <Row>
              <Field label="Name">
                <Input value={x.name} onChange={(e) => updateAt("projects", i, { name: e.target.value })} />
              </Field>
              <Field label="URL">
                <Input className="font-mono" value={x.url ?? ""} onChange={(e) => updateAt("projects", i, { url: e.target.value || null })} />
              </Field>
              <Field label="Role">
                <Input value={x.role ?? ""} onChange={(e) => updateAt("projects", i, { role: e.target.value || null })} />
              </Field>
            </Row>
            <Field label="Description">
              <Textarea rows={2} value={x.description} onChange={(e) => updateAt("projects", i, { description: e.target.value })} />
            </Field>
            <Field label="Stack (comma-separated)">
              <Input className="font-mono" value={x.stack.join(", ")} onChange={(e) => updateAt("projects", i, { stack: csv(e.target.value) })} />
            </Field>
          </Card>
        ))}
      </Section>

      <Section title="Education" count={p.education.length} onAdd={() => set("education", [...p.education, blankEducation()])}>
        {p.education.map((x, i) => (
          <Card key={i} onRemove={() => removeAt("education", i)}>
            <Row>
              <Field label="Institution">
                <Input value={x.institution} onChange={(e) => updateAt("education", i, { institution: e.target.value })} />
              </Field>
              <Field label="Degree">
                <Input value={x.degree ?? ""} onChange={(e) => updateAt("education", i, { degree: e.target.value || null })} />
              </Field>
              <Field label="Field">
                <Input value={x.field ?? ""} onChange={(e) => updateAt("education", i, { field: e.target.value || null })} />
              </Field>
              <Field label="Start">
                <Input className="font-mono" value={x.start ?? ""} onChange={(e) => updateAt("education", i, { start: e.target.value || null })} />
              </Field>
              <Field label="End">
                <Input className="font-mono" value={x.end ?? ""} onChange={(e) => updateAt("education", i, { end: e.target.value || null })} />
              </Field>
            </Row>
          </Card>
        ))}
      </Section>

      <Section title="Languages" count={p.languages.length} onAdd={() => set("languages", [...p.languages, { name: "", level: "unclear" }])}>
        {p.languages.map((x, i) => (
          <Card key={i} onRemove={() => removeAt("languages", i)}>
            <Row>
              <Field label="Language">
                <Input value={x.name} onChange={(e) => updateAt("languages", i, { name: e.target.value })} />
              </Field>
              <Field label="Level">
                <Select value={x.level} options={["native", "fluent", "professional", "conversational", "basic", "unclear"]} onChange={(v) => updateAt("languages", i, { level: v as Language["level"] })} />
              </Field>
            </Row>
          </Card>
        ))}
      </Section>

      <div className="sticky bottom-0 -mx-4 flex items-center gap-3 border-t border-rule bg-paper px-4 py-3 md:-mx-6 md:px-6">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving" : "Confirm profile"}
        </Button>
        <p className="text-small text-graphite">
          {state.status === "saved"
            ? "Saved. This profile is now the reference for every match."
            : state.status === "invalid" || state.status === "error"
              ? <span className="text-signal-destructive">{state.message}</span>
              : "Confirming marks this profile as reviewed. Nothing is scored against it until then."}
        </p>
      </div>
    </form>
  );
}

// --- small pieces -----------------------------------------------------------

function Section({ title, count, onAdd, children }: { title: string; count?: number; onAdd?: () => void; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="eyebrow">
          {title}
          {count != null ? <span className="ml-2 font-mono normal-case tracking-normal">{count}</span> : null}
        </h2>
        {onAdd ? (
          <Button type="button" variant="ghost" size="xs" onClick={onAdd}>
            + Add
          </Button>
        ) : null}
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

function Card({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <div className="relative flex flex-col gap-3 rounded-lg border border-rule bg-surface p-4">
      <div className="absolute top-2 right-2">
        <RemoveButton onClick={onRemove} />
      </div>
      {children}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(140px,1fr))]">{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="eyebrow">{label}</span>
      {children}
    </label>
  );
}

function Select({ value, options, onChange }: { value: string; options: readonly string[]; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 w-full rounded-md border border-rule bg-surface px-2 font-mono text-small text-ink"
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function Check({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <span className="flex h-8 items-center">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-[var(--ink)]" />
    </span>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" variant="ghost" size="xs" onClick={onClick} aria-label="Remove" className="text-graphite hover:text-signal-destructive">
      Remove
    </Button>
  );
}

const lines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);
const csv = (s: string) => s.split(",").map((l) => l.trim()).filter(Boolean);

const blankExperience = (): Experience => ({
  company: "", title: "", start: null, end: null, current: false, location: null, employment_type: "unclear", bullets: [], stack: [],
});
const blankSkill = (): Skill => ({ name: "", category: "other", proficiency: "unclear", years: null, evidence: [] });
const blankProject = (): Project => ({ name: "", url: null, description: "", stack: [], role: null });
const blankEducation = (): Education => ({ institution: "", degree: null, field: null, start: null, end: null });
