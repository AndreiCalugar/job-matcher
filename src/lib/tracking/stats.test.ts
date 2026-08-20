import { describe, expect, it } from "vitest";
import type { ApplicationRow } from "./schema";
import { calibration, gapFrequency, isoWeek, medianDaysToResponse, rateBy, shouldGhost, volumeByWeek } from "./stats";

const app = (o: Partial<ApplicationRow>): ApplicationRow => ({
  id: "00000000-0000-0000-0000-000000000001", kit_id: null, job_id: "00000000-0000-0000-0000-000000000002", match_id: null,
  status: "applied", channel: "email", angle: "domain_overlap", score_at_send: 70, verdict_at_send: "stretch",
  sent_at: "2026-08-01T00:00:00Z", first_response_at: null, response_kind: null, days_to_response: null, closed_at: null, notes: null,
  job: { title: "x", company_name: "y", url: null, source: { kind: "manual" } },
  ...o,
});

describe("calibration", () => {
  it("buckets by the same bands the UI uses and computes rate per band", () => {
    const apps = [
      app({ score_at_send: 80, first_response_at: "2026-08-05T00:00:00Z" }),
      app({ score_at_send: 78 }),
      app({ score_at_send: 60, first_response_at: "2026-08-09T00:00:00Z" }),
      app({ score_at_send: 20 }),
      app({ score_at_send: null }),
    ];
    const c = calibration(apps);
    expect(c.map((b) => b.verdict)).toEqual(["strong", "stretch", "weak", "mismatch"]);
    expect(c[0]).toMatchObject({ sent: 2, responded: 1, rate: 0.5 });
    expect(c[1]).toMatchObject({ sent: 1, responded: 1, rate: 1 });
    expect(c[2]).toMatchObject({ sent: 0, rate: null });
    expect(c[3]).toMatchObject({ sent: 1, responded: 0, rate: 0 });
  });
});

describe("rateBy / median / volume", () => {
  const apps = [
    app({ angle: "domain_overlap", first_response_at: "2026-08-04T00:00:00Z" }),
    app({ angle: "domain_overlap" }),
    app({ angle: "gap_acknowledged", sent_at: "2026-08-12T00:00:00Z", first_response_at: "2026-08-22T00:00:00Z" }),
  ];
  it("rates by angle, most-sent first", () => {
    expect(rateBy(apps, (a) => a.angle)).toEqual([
      { key: "domain_overlap", sent: 2, responded: 1, rate: 0.5 },
      { key: "gap_acknowledged", sent: 1, responded: 1, rate: 1 },
    ]);
  });
  it("median days to response from dates when not stored", () => {
    expect(medianDaysToResponse(apps)).toBe(6.5); // 3 and 10
    expect(medianDaysToResponse([app({})])).toBeNull();
  });
  it("volume by ISO week", () => {
    expect(isoWeek("2026-01-01T00:00:00Z")).toBe("2026-W01");
    expect(volumeByWeek(apps)).toEqual([
      { week: "2026-W31", sent: 2, responded: 1 },
      { week: "2026-W33", sent: 1, responded: 1 },
    ]);
  });
});

describe("gapFrequency", () => {
  it("counts gaps across non-strong matches, critical first on ties", () => {
    const out = gapFrequency([
      { verdict: "weak", gaps: [{ skill: "Kafka", severity: "critical" }, { skill: "Go", severity: "important" }] },
      { verdict: "mismatch", gaps: [{ skill: "kafka", severity: "critical" }] },
      { verdict: "strong", gaps: [{ skill: "Kafka", severity: "minor" }] }, // ignored
    ]);
    expect(out[0]).toEqual({ skill: "kafka", count: 2, critical: 2 });
    expect(out[1]).toEqual({ skill: "go", count: 1, critical: 0 });
  });
});

describe("shouldGhost", () => {
  const now = new Date("2026-08-30T00:00:00Z");
  it("ghosts applied-with-no-response after N days, nothing else", () => {
    expect(shouldGhost(app({ sent_at: "2026-08-01T00:00:00Z" }), 21, now)).toBe(true);
    expect(shouldGhost(app({ sent_at: "2026-08-15T00:00:00Z" }), 21, now)).toBe(false);
    expect(shouldGhost(app({ sent_at: "2026-08-01T00:00:00Z", first_response_at: "2026-08-03T00:00:00Z" }), 21, now)).toBe(false);
    expect(shouldGhost(app({ sent_at: "2026-08-01T00:00:00Z", status: "screening" }), 21, now)).toBe(false);
  });
});
