import { z } from "zod";

export const STATUSES = ["applied", "screening", "interview", "final", "offer", "rejected", "withdrawn", "ghosted"] as const;
export const status = z.enum(STATUSES);
export type Status = z.infer<typeof status>;
export const TERMINAL: ReadonlySet<Status> = new Set(["offer", "rejected", "withdrawn", "ghosted"]);
// The pipeline in order; terminal states hang off it.
export const PIPELINE: Status[] = ["applied", "screening", "interview", "final", "offer"];

export const responseKind = z.enum(["auto_reject", "human_reject", "interest", "interview_invite"]);
export type ResponseKind = z.infer<typeof responseKind>;

export const applicationRow = z.object({
  id: z.string().uuid(),
  kit_id: z.string().uuid().nullable(),
  job_id: z.string().uuid(),
  match_id: z.string().uuid().nullable(),
  status,
  channel: z.enum(["email", "linkedin", "form", "other"]).nullable(),
  angle: z.string().nullable(),
  score_at_send: z.coerce.number().nullable(),
  verdict_at_send: z.string().nullable(),
  sent_at: z.string(),
  first_response_at: z.string().nullable(),
  response_kind: responseKind.nullable(),
  days_to_response: z.number().nullable(),
  closed_at: z.string().nullable(),
  notes: z.string().nullable(),
  job: z.object({
    title: z.string().nullable(),
    company_name: z.string().nullable(),
    url: z.string().nullable(),
    source: z.object({ kind: z.string() }).nullable(),
  }),
});
export type ApplicationRow = z.infer<typeof applicationRow>;
export const APPLICATION_COLUMNS =
  "id, kit_id, job_id, match_id, status, channel, angle, score_at_send, verdict_at_send, sent_at, first_response_at, response_kind, days_to_response, closed_at, notes, job:job_id(title, company_name, url, source:source_id(kind))";

// A response has happened if any of these is true. Used by statistics:
// "response rate" = applications with a first_response_at / all sent.
export function hasResponded(a: Pick<ApplicationRow, "first_response_at">): boolean {
  return a.first_response_at != null;
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.max(0, Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 86_400_000));
}
