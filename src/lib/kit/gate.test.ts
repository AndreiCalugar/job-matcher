import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cvParse } from "@/lib/cv/schema";
import { deterministicGate, gatePassed } from "./gate";
import { profileCorpus, resolvePath } from "./paths";
import { kitParse, type KitParse } from "./schema";
import { splitSentences } from "./verifier";

const here = (...p: string[]) => path.join(__dirname, ...p);
const cv = cvParse.parse(JSON.parse(readFileSync(here("../cv/__fixtures__/cv-001.expected.json"), "utf8")));
const profile = {
  headline: cv.headline, summary: cv.summary, experience: cv.experience,
  skills: cv.skills.map((s) => ({ ...s, years: null })), projects: cv.projects, education: cv.education, languages: cv.languages,
};
const posting = readFileSync(here("../parse/__fixtures__/posting-001.txt"), "utf8");
const good: KitParse = kitParse.parse(JSON.parse(readFileSync(here("__fixtures__/kit-001.expected.json"), "utf8")));

const blocks = (kit: KitParse) => deterministicGate(profile, kit, posting).filter((i) => i.level === "block");

describe("paths", () => {
  it("resolves nested paths and rejects bad ones without throwing", () => {
    expect(resolvePath(profile, "experience[0].bullets[1]")).toContain("PostgreSQL");
    expect(resolvePath(profile, "summary")).toBe(profile.summary);
    expect(resolvePath(profile, "experience[9]")).toBeUndefined();
    expect(resolvePath(profile, "experience[0].nope")).toBeUndefined();
    expect(resolvePath(profile, "__proto__")).toBeUndefined();
    expect(resolvePath(profile, "constructor.prototype")).toBeUndefined();
    expect(resolvePath(profile, "posting")).toBe("posting");
  });
  it("builds a corpus containing every string", () => {
    const c = profileCorpus(profile);
    expect(c).toContain("Nordpay ApS");
    expect(c).toContain("Playwright");
  });
});

describe("deterministic gate — honest kit passes", () => {
  it("passes the fixture with zero blocks", () => {
    const issues = deterministicGate(profile, good, posting);
    expect(issues.filter((i) => i.level === "block")).toEqual([]);
    expect(gatePassed(issues)).toBe(true);
  });
});

describe("deterministic gate — fabrications are blocked", () => {
  it("blocks an invented number in the cover letter", () => {
    const kit = { ...good, cover_letter: good.cover_letter.replace("mentored two junior engineers", "mentored twelve junior engineers") };
    const b = blocks(kit);
    expect(b.some((i) => i.check === "number" && i.detail.includes("'12'"))).toBe(true);
  });

  it("blocks a technology the profile never mentions", () => {
    const kit = { ...good, cover_letter: good.cover_letter + "\n\nI also have production experience with Kafka and Terraform." };
    const b = blocks(kit);
    expect(b.map((i) => i.detail).join(" ")).toMatch(/Terraform/);
  });

  it("allows a term that is in the posting but not the profile (the posting's own words)", () => {
    // "Series B" / "Nordic" appear in the posting fixture; the letter may refer to them.
    const kit = { ...good, cover_letter: good.cover_letter + "\n\nYour Series B stage and Nordic merchant base are why I am writing." };
    expect(blocks(kit).filter((i) => i.check === "term")).toEqual([]);
  });

  it("allows the recipient's name and role when supplied by the user, and blocks them when not", () => {
    const kit = { ...good, cover_letter: good.cover_letter.replace("Hiring team,", "Hi Paul,") + "\n\nThanks for reading, Paul." };
    expect(blocks(kit).some((i) => i.detail.includes("'Paul'"))).toBe(true);
    const withRecipient = deterministicGate(profile, kit, posting, { allowTerms: ["Paul", "Engineering Manager"] }).filter((i) => i.level === "block");
    expect(withRecipient).toEqual([]);
  });

  it("blocks a cv_change whose path does not exist", () => {
    const kit = { ...good, cv_changes: [{ ...good.cv_changes[0]!, path: "experience[7].bullets[0]" }] };
    expect(blocks(kit).some((i) => i.check === "path")).toBe(true);
  });

  it("blocks a cv_change that misquotes the current text", () => {
    const kit = { ...good, cv_changes: [{ ...good.cv_changes[1]!, current: "Led the PostgreSQL migration programme." }] };
    expect(blocks(kit).some((i) => i.check === "current")).toBe(true);
  });

  it("blocks a rephrase that strengthens 'helped' into 'led'", () => {
    const kit = {
      ...good,
      cv_changes: [{ path: "experience[1].bullets[1]", current: "Built a Shopify integration in Node.js for an e-commerce client.", suggested: "Led the Shopify integration programme in Node.js for an e-commerce client.", reason: "x", severity: "polish" as const }],
    };
    // "Led" is at sentence start, so the number/term checks ignore it; the strengthener check must catch it.
    expect(blocks(kit).some((i) => i.check === "strengthen" && i.detail.includes("led"))).toBe(true);
  });

  it("allows a strengthening verb that the profile itself uses", () => {
    // profile bullet: "Led the rebuild of the merchant onboarding flow…"
    const kit = {
      ...good,
      cv_changes: [{ path: "experience[0].bullets[0]", current: "Led the rebuild of the merchant onboarding flow in Next.js and TypeScript, cutting drop-off by 18%.", suggested: "Led the Next.js/TypeScript rebuild of the merchant onboarding flow, cutting drop-off by 18%.", reason: "x", severity: "polish" as const }],
    };
    expect(blocks(kit).filter((i) => i.check === "strengthen")).toEqual([]);
  });

  it("blocks a claim whose source_path is invented", () => {
    const kit = { ...good, claims: [...good.claims, { claim: "shipped a Kafka pipeline", source_path: "experience[5].bullets[0]" }] };
    expect(blocks(kit).some((i) => i.check === "claim_path")).toBe(true);
  });

  it("blocks an invented percentage in a suggested CV line", () => {
    const kit = { ...good, cv_changes: [{ ...good.cv_changes[0]!, suggested: good.cv_changes[0]!.suggested + " Improved conversion by 40%." }] };
    expect(blocks(kit).some((i) => i.check === "number" && i.detail.includes("'40'"))).toBe(true);
  });
});

describe("verifier helpers", () => {
  it("splits prose into checkable sentences", () => {
    expect(splitSentences("Hiring team,\n\nI own the flow. I ran migrations! Done?")).toEqual(["Hiring team,", "I own the flow.", "I ran migrations!", "Done?"]);
  });
});

describe("ats export", () => {
  it("is single-column plain text built only from the profile, with emphasised skills first", async () => {
    const { atsExport } = await import("./ats-export");
    const out = atsExport(profile, { name: "Jordan Example", emphasis: ["KYC", "React"] });
    expect(out.startsWith("JORDAN EXAMPLE\n")).toBe(true);
    for (const h of ["SUMMARY", "SKILLS", "EXPERIENCE", "PROJECTS", "EDUCATION", "LANGUAGES"]) expect(out).toContain(`\n${h}\n`);
    const skillsLine = out.split("\n")[out.split("\n").indexOf("SKILLS") + 1]!;
    expect(skillsLine.startsWith("KYC, React")).toBe(true);
    expect(out).toContain("Senior Software Engineer | Nordpay ApS | Copenhagen | 2022-03 - Present");
    expect(out).not.toMatch(/<[a-z]+>/); // no markup
    // every non-heading line's words come from the profile or are furniture
    expect(out).toContain("- Mentored two junior engineers.");
  });
});
