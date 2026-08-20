import { Button } from "@/components/ui/button";
import { setApplicationStatus } from "@/lib/tracking/actions";
import { STATUSES, type Status } from "@/lib/tracking/schema";

// Plain form, no JS: a select and a button. Status carries no colour
// except ghosted (reserved signal, DESIGN.md §2).
export function StatusControl({ id, current }: { id: string; current: Status }) {
  return (
    <form action={setApplicationStatus} className="flex items-center gap-1">
      <input type="hidden" name="id" value={id} />
      <select name="status" defaultValue={current} className={`h-7 rounded-md border border-rule bg-surface px-1.5 font-mono text-micro ${current === "ghosted" ? "text-signal-ghosted" : "text-ink"}`}>
        {STATUSES.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      <Button type="submit" size="xs" variant="ghost">Set</Button>
    </form>
  );
}
