import type { SourceKind } from "@/lib/ingest/types";

// Careers URL → (platform, identifier). CLAUDE.md "Resolving a company to a
// board token". Pure; tested.
export type Detected = { kind: SourceKind; identifier: string; company_guess: string };

const RULES: { kind: SourceKind; re: RegExp }[] = [
  { kind: "greenhouse", re: /(?:boards|job-boards)\.greenhouse\.io\/([a-z0-9_-]+)/i },
  { kind: "greenhouse", re: /boards-api\.greenhouse\.io\/v1\/boards\/([a-z0-9_-]+)/i },
  { kind: "lever", re: /jobs\.lever\.co\/([a-z0-9_-]+)/i },
  { kind: "lever", re: /api\.lever\.co\/v0\/postings\/([a-z0-9_-]+)/i },
  { kind: "ashby", re: /jobs\.ashbyhq\.com\/([a-z0-9_-]+)/i },
  { kind: "ashby", re: /api\.ashbyhq\.com\/posting-api\/job-board\/([a-z0-9_-]+)/i },
  { kind: "workable", re: /apply\.workable\.com\/([a-z0-9_-]+)/i },
  { kind: "recruitee", re: /([a-z0-9-]+)\.recruitee\.com/i },
  { kind: "personio", re: /([a-z0-9-]+)\.jobs\.personio\.(?:de|com)/i },
];

export function detectAts(input: string): Detected | null {
  const url = input.trim();
  for (const { kind, re } of RULES) {
    const m = re.exec(url);
    if (m?.[1]) {
      const identifier = m[1].toLowerCase();
      return { kind, identifier, company_guess: identifier.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) };
    }
  }
  return null;
}
