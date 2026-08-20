import { BANDS, type Verdict, verdictFor } from "@/lib/match/bands";
import { daysBetween, hasResponded, type ApplicationRow } from "@/lib/tracking/schema";

// Pure aggregations over application rows. The calibration chart is the
// first one: response rate per predicted score band. If the bands
// separate, the score is a measurement; if the line is flat, it is
// decoration (CLAUDE.md "Technical credibility §2").

export type BandStat = { verdict: Verdict; min: number; sent: number; responded: number; rate: number | null };

export function calibration(apps: ApplicationRow[]): BandStat[] {
  return BANDS.map((b) => {
    const inBand = apps.filter((a) => a.score_at_send != null && verdictFor(a.score_at_send) === b.verdict);
    const responded = inBand.filter(hasResponded).length;
    return { verdict: b.verdict, min: b.min, sent: inBand.length, responded, rate: inBand.length ? responded / inBand.length : null };
  });
}

export type KeyStat = { key: string; sent: number; responded: number; rate: number | null };

export function rateBy(apps: ApplicationRow[], keyOf: (a: ApplicationRow) => string | null): KeyStat[] {
  const m = new Map<string, { sent: number; responded: number }>();
  for (const a of apps) {
    const k = keyOf(a);
    if (!k) continue;
    const e = m.get(k) ?? { sent: 0, responded: 0 };
    e.sent++;
    if (hasResponded(a)) e.responded++;
    m.set(k, e);
  }
  return [...m.entries()].map(([key, e]) => ({ key, ...e, rate: e.sent ? e.responded / e.sent : null })).sort((x, y) => y.sent - x.sent);
}

export function medianDaysToResponse(apps: ApplicationRow[]): number | null {
  const days = apps.filter(hasResponded).map((a) => a.days_to_response ?? daysBetween(a.sent_at, a.first_response_at!)).sort((a, b) => a - b);
  if (days.length === 0) return null;
  const mid = Math.floor(days.length / 2);
  return days.length % 2 ? days[mid]! : (days[mid - 1]! + days[mid]!) / 2;
}

export function statusCounts(apps: ApplicationRow[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const a of apps) out[a.status] = (out[a.status] ?? 0) + 1;
  return out;
}

// Applications per ISO week (YYYY-Www), oldest first.
export function volumeByWeek(apps: ApplicationRow[]): { week: string; sent: number; responded: number }[] {
  const m = new Map<string, { sent: number; responded: number }>();
  for (const a of apps) {
    const w = isoWeek(a.sent_at);
    const e = m.get(w) ?? { sent: 0, responded: 0 };
    e.sent++;
    if (hasResponded(a)) e.responded++;
    m.set(w, e);
  }
  return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([week, e]) => ({ week, ...e }));
}

export function isoWeek(iso: string): string {
  const d = new Date(iso);
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

// Which skills appear most as gaps across weak/mismatch matches: the
// learning roadmap the user did not have to write.
export function gapFrequency(matches: { verdict: string; gaps: { skill: string; severity: string }[] }[], top = 12): { skill: string; count: number; critical: number }[] {
  const m = new Map<string, { count: number; critical: number }>();
  for (const x of matches) {
    if (x.verdict !== "weak" && x.verdict !== "mismatch" && x.verdict !== "stretch") continue;
    for (const g of x.gaps) {
      const k = g.skill.trim().toLowerCase();
      const e = m.get(k) ?? { count: 0, critical: 0 };
      e.count++;
      if (g.severity === "critical") e.critical++;
      m.set(k, e);
    }
  }
  return [...m.entries()].map(([skill, e]) => ({ skill, ...e })).sort((a, b) => b.count - a.count || b.critical - a.critical).slice(0, top);
}

// Ghosted applications are the ones that time out without a response.
export function shouldGhost(a: Pick<ApplicationRow, "status" | "sent_at" | "first_response_at">, ghostAfterDays: number, now: Date): boolean {
  return a.status === "applied" && a.first_response_at == null && daysBetween(a.sent_at, now.toISOString()) >= ghostAfterDays;
}
