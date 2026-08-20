import type { JobRow } from "@/lib/jobs/schema";

// Display helpers. Pure; shared by the table and the detail page.

export function formatComp(j: Pick<JobRow, "comp_min" | "comp_max" | "comp_currency" | "comp_period" | "comp_stated">): string {
  if (!j.comp_stated || j.comp_min == null) return "—";
  const fmt = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));
  const range = j.comp_max != null && j.comp_max !== j.comp_min ? `${fmt(j.comp_min)}–${fmt(j.comp_max)}` : fmt(j.comp_min);
  const period = j.comp_period ? `/${{ year: "y", month: "mo", day: "d", hour: "h" }[j.comp_period]}` : "";
  return `${j.comp_currency ?? ""} ${range}${period}`.trim();
}

export function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

export function firstLine(text: string): string {
  const line = text.split("\n").find((l) => l.trim().length > 0) ?? "";
  return line.trim().slice(0, 140);
}

export function host(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}
