import type { Experience } from "@/lib/cv/schema";

// Years of experience per skill, from role dates — not from the model.
// Roles that overlap (a freelance side business alongside a job) are
// unioned, not summed, so concurrent roles cannot inflate a number.
// Returns one decimal; null when no dated role lists the skill.

type Interval = { start: number; end: number }; // months since epoch

export function computeSkillYears(
  experience: Experience[],
  skillName: string,
  now: Date = new Date(),
): number | null {
  const needle = norm(skillName);
  const intervals: Interval[] = [];
  for (const role of experience) {
    if (!role.stack.some((s) => norm(s) === needle)) continue;
    const start = toMonths(role.start);
    if (start == null) continue;
    const end = role.current || role.end == null ? toMonths(isoYm(now)) : toMonths(role.end);
    if (end == null || end < start) continue;
    intervals.push({ start, end });
  }
  if (intervals.length === 0) return null;

  intervals.sort((a, b) => a.start - b.start);
  let total = 0;
  let cur = { ...intervals[0]! };
  for (const iv of intervals.slice(1)) {
    if (iv.start <= cur.end) cur.end = Math.max(cur.end, iv.end);
    else {
      total += cur.end - cur.start;
      cur = { ...iv };
    }
  }
  total += cur.end - cur.start;
  return Math.round((total / 12) * 10) / 10;
}

const norm = (s: string) => s.trim().toLowerCase();

function toMonths(ym: string | null): number | null {
  if (!ym) return null;
  const m = /^(\d{4})(?:-(\d{2}))?$/.exec(ym.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = m[2] ? Number(m[2]) : 1;
  if (month < 1 || month > 12) return null;
  return year * 12 + (month - 1);
}

function isoYm(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
