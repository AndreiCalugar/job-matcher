import type { ProfileEdit } from "@/lib/cv/schema";

// ATS-safe plain export: single column, standard headings, no layout.
// Generated from the reviewed profile in code — no model, so nothing to
// fabricate. Optional `emphasis` lists skills to surface first (from the
// posting's must-haves); it reorders, never adds.
export function atsExport(profile: ProfileEdit, opts: { name?: string | null; emphasis?: string[] } = {}): string {
  const L: string[] = [];
  const push = (s = "") => L.push(s);

  if (opts.name) push(opts.name.toUpperCase());
  if (profile.headline) push(profile.headline);
  push();

  if (profile.summary) {
    push("SUMMARY");
    push(profile.summary);
    push();
  }

  const emphasis = (opts.emphasis ?? []).map((s) => s.toLowerCase());
  const skills = [...profile.skills].sort((a, b) => {
    const ai = emphasis.indexOf(a.name.toLowerCase());
    const bi = emphasis.indexOf(b.name.toLowerCase());
    return (ai === -1 ? 1e9 : ai) - (bi === -1 ? 1e9 : bi);
  });
  if (skills.length) {
    push("SKILLS");
    push(skills.map((s) => (s.years != null ? `${s.name} (${s.years} yrs)` : s.name)).join(", "));
    push();
  }

  if (profile.experience.length) {
    push("EXPERIENCE");
    for (const x of profile.experience) {
      const when = `${x.start ?? ""} - ${x.current ? "Present" : (x.end ?? "")}`.trim();
      push(`${x.title} | ${x.company}${x.location ? ` | ${x.location}` : ""} | ${when}`);
      for (const b of x.bullets) push(`- ${b}`);
      if (x.stack.length) push(`Technologies: ${x.stack.join(", ")}`);
      push();
    }
  }

  if (profile.projects.length) {
    push("PROJECTS");
    for (const p of profile.projects) {
      push(`${p.name}${p.role ? ` | ${p.role}` : ""}${p.url ? ` | ${p.url}` : ""}`);
      push(`- ${p.description}`);
      if (p.stack.length) push(`Technologies: ${p.stack.join(", ")}`);
      push();
    }
  }

  if (profile.education.length) {
    push("EDUCATION");
    for (const e of profile.education) {
      push(`${[e.degree, e.field].filter(Boolean).join(", ") || "—"} | ${e.institution} | ${e.start ?? ""} - ${e.end ?? ""}`.replace(/\s\|\s-\s*$/, ""));
    }
    push();
  }

  if (profile.languages.length) {
    push("LANGUAGES");
    push(profile.languages.map((l) => `${l.name} (${l.level})`).join(", "));
    push();
  }

  return L.join("\n").trim() + "\n";
}
