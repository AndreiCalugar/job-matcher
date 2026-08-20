import type { ProfileEdit } from "@/lib/cv/schema";
import { profileCorpus, resolvePath } from "@/lib/kit/paths";
import type { KitParse } from "@/lib/kit/schema";

// Anti-fabrication gate, layer 1: deterministic. Runs on every generated
// kit before anything is stored. Any `block` issue → the kit is rejected
// and recorded in blocked_generation. These checks are narrow on purpose:
// each one catches a specific way a model invents.

export type Issue = { check: string; where: string; detail: string; level: "block" | "warn" };

export function deterministicGate(
  profile: ProfileEdit,
  kit: KitParse,
  postingText: string,
  // Text the user supplied themselves (recipient name/role, their own
  // name). Allowed in generated prose; it is not a claim about the CV.
  opts: { allowTerms?: string[] } = {},
): Issue[] {
  const issues: Issue[] = [];
  const profCorpus = profileCorpus(profile);
  const profTokens = tokenSet(profCorpus);
  const postTokens = tokenSet(`${postingText}\n${(opts.allowTerms ?? []).join("\n")}`);
  const profNumbers = numberSet(profCorpus);
  const postNumbers = numberSet(postingText);

  // 1. Every cv_change addresses a real path, and `current` is what is
  //    actually there. Invented "current" text is the cheapest fabrication.
  kit.cv_changes.forEach((c, i) => {
    const where = `cv_changes[${i}]`;
    const node = resolvePath(profile, c.path);
    if (node === undefined) {
      issues.push({ check: "path", where, detail: `path '${c.path}' does not exist in the profile`, level: "block" });
      return;
    }
    if (c.current !== "") {
      const actual = typeof node === "string" ? node : JSON.stringify(node);
      if (!norm(actual).includes(norm(c.current))) {
        issues.push({ check: "current", where, detail: `'current' is not the text at '${c.path}'`, level: "block" });
      }
    }
    // 2. Rephrasing may not strengthen. A strengthening verb that appears in
    //    `suggested` but not in `current` and not in the profile entry being
    //    edited (the bullet or its parent role). "Led" at Nordpay does not
    //    license "led" at Finlo.
    const scope = typeof node === "string" ? node : JSON.stringify(node);
    const parent = parentEntry(profile, c.path);
    for (const verb of STRENGTHENERS) {
      const re = new RegExp(`\\b${verb}\\b`, "i");
      if (re.test(c.suggested) && !re.test(c.current) && !re.test(scope) && !re.test(parent)) {
        issues.push({ check: "strengthen", where, detail: `'${verb}' introduced by the suggestion; not in the profile entry at '${c.path}'`, level: "block" });
      }
    }
  });

  // 3. Every claim traces to a path that exists.
  kit.claims.forEach((cl, i) => {
    if (resolvePath(profile, cl.source_path) === undefined) {
      issues.push({ check: "claim_path", where: `claims[${i}]`, detail: `source_path '${cl.source_path}' does not exist`, level: "block" });
    }
  });

  // 4. Numbers in generated prose must exist in the profile or the posting.
  //    "5 years", "18%", "three engineers": the commonest invention.
  const prose: [string, string][] = [
    ["cover_letter", kit.cover_letter],
    ["outreach_body", kit.outreach_body ?? ""],
    ...kit.cv_changes.map((c, i): [string, string] => [`cv_changes[${i}].suggested`, c.suggested]),
  ];
  for (const [where, text] of prose) {
    for (const n of numberSet(text)) {
      if (!profNumbers.has(n) && !postNumbers.has(n)) {
        issues.push({ check: "number", where, detail: `'${n}' appears in neither the profile nor the posting`, level: "block" });
      }
    }
    // 5. Capitalised terms (companies, technologies, places) must exist in
    //    the profile or posting. Sentence-initial words are skipped; a
    //    short stoplist covers letter furniture.
    for (const term of properNouns(text)) {
      const t = term.toLowerCase();
      if (profTokens.has(t) || postTokens.has(t) || STOPLIST.has(t)) continue;
      issues.push({ check: "term", where, detail: `'${term}' appears in neither the profile nor the posting`, level: "block" });
    }
  }

  return dedupe(issues);
}

export function gatePassed(issues: Issue[]): boolean {
  return !issues.some((i) => i.level === "block");
}

// --- helpers ---------------------------------------------------------------

const STRENGTHENERS = ["led", "lead", "owned", "architected", "managed", "headed", "founded", "directed", "spearheaded", "pioneered"];

const STOPLIST = new Set([
  "i", "hiring", "team", "dear", "hi", "hello", "regards", "best", "kind", "sincerely", "thanks", "thank",
  "monday", "tuesday", "wednesday", "thursday", "friday", "january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december",
  "cv", "linkedin", "github", "english", "danish", "romanian", "german", "swedish", "norwegian", "dutch", "french", "spanish",
  "eu", "europe", "european", "nordics", "nordic",
]);

const NUMBER_WORDS: Record<string, string> = {
  one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", ten: "10", eleven: "11", twelve: "12",
};

function numberSet(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(/\d+(?:[.,]\d+)?/g)) out.add(m[0].replace(",", "."));
  for (const m of text.toLowerCase().matchAll(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/g)) out.add(NUMBER_WORDS[m[1]!]!);
  return out;
}

function tokenSet(text: string): Set<string> {
  return new Set(text.toLowerCase().match(/[a-z0-9][a-z0-9.+#-]*/g) ?? []);
}

// Capitalised tokens not at the start of a sentence or line.
function properNouns(text: string): string[] {
  const out: string[] = [];
  for (const sentence of text.split(/(?<=[.!?])\s+|\n+/)) {
    const words = sentence.trim().split(/\s+/);
    for (let i = 1; i < words.length; i++) {
      const w = words[i]!.replace(/^[("'“‘]+|[)"',.;:!?”’]+$/g, "");
      if (/^[A-Z][A-Za-z0-9.+#-]*$/.test(w) && w.length > 1) out.push(w.replace(/\.$/, ""));
    }
  }
  return out;
}

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

// Text of the top-level entry a path lives in: "experience[2].bullets[0]" →
// JSON of experience[2]. Top-level scalars return themselves.
function parentEntry(profile: ProfileEdit, p: string): string {
  const m = /^([a-z_]+\[\d+\])/.exec(p);
  const node = resolvePath(profile, m ? m[1]! : p.split(".")[0]!);
  return node === undefined ? "" : typeof node === "string" ? node : JSON.stringify(node);
}

function dedupe(issues: Issue[]): Issue[] {
  const seen = new Set<string>();
  return issues.filter((i) => {
    const k = `${i.check}|${i.where}|${i.detail}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
