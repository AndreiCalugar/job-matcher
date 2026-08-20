"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { storePastedJob, type PasteState } from "@/lib/jobs/actions";

const initial: PasteState = { status: "idle" };

export function PasteForm() {
  const [state, action, pending] = useActionState(storePastedJob, initial);
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the form only on a successful write; keep the user's text on
  // validation or server errors so nothing typed is lost.
  useEffect(() => {
    if (state.status === "stored" || state.status === "duplicate") {
      formRef.current?.reset();
    }
  }, [state]);

  const fieldErrors = state.status === "invalid" ? state.fieldErrors : {};

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="text" className="eyebrow">
          Posting
        </Label>
        <Textarea
          id="text"
          name="text"
          required
          rows={10}
          placeholder="Paste the full job posting text."
          aria-invalid={fieldErrors.text ? true : undefined}
          aria-describedby={fieldErrors.text ? "text-error" : undefined}
          className="min-h-[200px] font-sans text-body"
        />
        {fieldErrors.text ? (
          <p id="text-error" className="text-small text-signal-destructive">
            {fieldErrors.text}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="url" className="eyebrow">
          URL <span className="normal-case tracking-normal">(optional)</span>
        </Label>
        <Input
          id="url"
          name="url"
          type="url"
          inputMode="url"
          placeholder="https://"
          aria-invalid={fieldErrors.url ? true : undefined}
          aria-describedby={fieldErrors.url ? "url-error" : undefined}
          className="font-mono text-small"
        />
        {fieldErrors.url ? (
          <p id="url-error" className="text-small text-signal-destructive">
            {fieldErrors.url}
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Storing and parsing" : "Store posting"}
        </Button>
        <StatusLine state={state} />
      </div>
    </form>
  );
}

// Outcome copy per DESIGN.md §9: says what happened, then the next action.
function StatusLine({ state }: { state: PasteState }) {
  switch (state.status) {
    case "stored":
      return state.parse === "parsed" ? (
        <p className="text-small text-graphite">Stored and parsed. It is at the top of the list.</p>
      ) : (
        <p className="text-small text-graphite">
          Stored, but parsing failed
          {state.parseError ? <span className="font-mono"> ({state.parseError.slice(0, 80)})</span> : null}. Use
          Parse on the row to retry.
        </p>
      );
    case "duplicate":
      return (
        <p className="text-small text-graphite">
          Already stored on{" "}
          <span className="font-mono">{state.firstSeen.slice(0, 10)}</span>. Last seen
          updated.
        </p>
      );
    case "error":
      return (
        <p className="text-small text-signal-destructive">
          {state.message} Try again; if it repeats, check the Supabase env vars.
        </p>
      );
    default:
      return null;
  }
}
