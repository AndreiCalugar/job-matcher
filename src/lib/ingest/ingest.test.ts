import { describe, expect, it } from "vitest";
import { ashby } from "./adapters/ashby";
import { greenhouse } from "./adapters/greenhouse";
import { lever } from "./adapters/lever";
import { detectAts } from "./detect";
import { passesAny, rejectReason, type SearchProfileRow } from "./filter";
import { htmlToText } from "./html";
import { normalisedPosting, type Http } from "./types";

const fakeHttp = (body: unknown, status = 200): Http => async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("detectAts", () => {
  it("resolves careers URLs to platform + identifier", () => {
    expect(detectAts("https://boards.greenhouse.io/pleo")).toEqual({ kind: "greenhouse", identifier: "pleo", company_guess: "Pleo" });
    expect(detectAts("https://job-boards.greenhouse.io/acme-corp/jobs/123")).toMatchObject({ kind: "greenhouse", identifier: "acme-corp" });
    expect(detectAts("https://jobs.lever.co/wolt?team=Eng")).toMatchObject({ kind: "lever", identifier: "wolt" });
    expect(detectAts("https://jobs.ashbyhq.com/Linear")).toMatchObject({ kind: "ashby", identifier: "linear" });
    expect(detectAts("https://apply.workable.com/sumup/")).toMatchObject({ kind: "workable", identifier: "sumup" });
    expect(detectAts("https://acme.recruitee.com/o/dev")).toMatchObject({ kind: "recruitee", identifier: "acme" });
    expect(detectAts("https://acme.jobs.personio.de/")).toMatchObject({ kind: "personio", identifier: "acme" });
    expect(detectAts("https://www.linkedin.com/jobs/view/123")).toBeNull();
    expect(detectAts("https://example.com/careers")).toBeNull();
  });
});

describe("htmlToText", () => {
  it("turns markup into readable plain text", () => {
    const out = htmlToText("<h2>About</h2><p>We build &amp; ship.</p><ul><li>React</li><li>Node&nbsp;js</li></ul><script>x()</script>");
    expect(out).toBe("About\nWe build & ship.\n• React\n• Node js");
  });
});

describe("adapters normalise to one shape", () => {
  it("greenhouse (double-escaped content)", async () => {
    const payload = { jobs: [{ id: 42, title: "Senior Engineer", absolute_url: "https://boards.greenhouse.io/pleo/jobs/42", location: { name: "Copenhagen (Remote)" }, first_published: "2026-08-01T00:00:00Z", content: "&lt;p&gt;Build &amp;amp; ship&lt;/p&gt;" }] };
    const out = await greenhouse.fetch("pleo", {}, fakeHttp(payload));
    expect(out).toHaveLength(1);
    const p = normalisedPosting.parse(out[0]);
    expect(p.external_id).toBe("42");
    expect(p.remote_hint).toBe(true);
    expect(p.text).toContain("Build & ship");
    expect(p.raw).toEqual(payload.jobs[0]);
  });
  it("lever (lists + plain description)", async () => {
    const payload = [{ id: "abc", text: "Backend Engineer", hostedUrl: "https://jobs.lever.co/wolt/abc", createdAt: 1754006400000, categories: { location: "Berlin", commitment: "Full-time" }, descriptionPlain: "Own services.", lists: [{ text: "Requirements", content: "<li>Go</li><li>Kafka</li>" }], workplaceType: "hybrid" }];
    const [p] = await lever.fetch("wolt", {}, fakeHttp(payload));
    expect(normalisedPosting.parse(p).text).toContain("• Go");
    expect(p!.remote_hint).toBe(false);
    expect(p!.posted_at).toBe("2025-08-01T00:00:00.000Z");
  });
  it("ashby", async () => {
    const payload = { jobs: [{ id: "x1", title: "Product Engineer", jobUrl: "https://jobs.ashbyhq.com/linear/x1", isRemote: true, location: "EU", descriptionPlain: "Ship.", publishedAt: "2026-08-10T00:00:00Z" }] };
    const [p] = await ashby.fetch("linear", {}, fakeHttp(payload));
    expect(normalisedPosting.parse(p).remote_hint).toBe(true);
  });
  it("surfaces HTTP failures as errors (the runner logs them on the source)", async () => {
    await expect(greenhouse.fetch("nope", {}, fakeHttp({}, 404))).rejects.toThrow(/HTTP 404/);
  });
});

describe("search profile filter", () => {
  const sp: SearchProfileRow = {
    id: "00000000-0000-0000-0000-000000000001", name: "EU React", enabled: true,
    titles: ["frontend", "full-stack", "fullstack", "software engineer"], countries: ["DK", "NL", "DE"], remote_policy: ["remote", "hybrid"],
    seniority: ["mid", "senior"], employment_type: [], comp_floor: null, comp_currency: null,
    exclude_keywords: ["clearance"], exclude_companies: ["Crypto Bros"],
  };
  const base = { title: "Senior Frontend Engineer", country: "DK", remote_policy: "hybrid" as const, seniority: "senior" as const, employment_type: "permanent" as const, company_name: "Pleo", text: "React and TypeScript" };

  it("passes a matching job", () => expect(rejectReason(base, sp)).toBeNull());
  it("rejects on title", () => expect(rejectReason({ ...base, title: "Data Scientist" }, sp)).toBe("title"));
  it("lets fully remote jobs through the country filter", () => expect(rejectReason({ ...base, country: "PT", remote_policy: "remote" }, sp)).toBeNull());
  it("rejects wrong country when not remote", () => expect(rejectReason({ ...base, country: "PT" }, sp)).toBe("country"));
  it("rejects onsite when only remote/hybrid wanted", () => expect(rejectReason({ ...base, remote_policy: "onsite" }, sp)).toBe("remote policy"));
  it("does not reject on 'unclear' fields", () => expect(rejectReason({ ...base, seniority: "unclear", remote_policy: "unclear" }, sp)).toBeNull());
  it("rejects excluded keywords and companies", () => {
    expect(rejectReason({ ...base, text: "Requires security clearance" }, sp)).toMatch(/excluded keyword/);
    expect(rejectReason({ ...base, company_name: "Crypto Bros GmbH" }, sp)).toMatch(/excluded company/);
  });
  it("passesAny ignores disabled profiles", () => {
    expect(passesAny(base, [{ ...sp, enabled: false }])).toBe(false);
    expect(passesAny(base, [{ ...sp, enabled: false }, sp])).toBe(true);
  });
});
