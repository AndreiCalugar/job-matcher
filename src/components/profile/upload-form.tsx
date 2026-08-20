"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { uploadCv, type UploadState } from "@/lib/cv/actions";

const initial: UploadState = { status: "idle" };

export function UploadForm() {
  const [state, action, pending] = useActionState(uploadCv, initial);
  return (
    <form action={action} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Label htmlFor="file" className="eyebrow">
          CV as PDF
        </Label>
        <Input id="file" name="file" type="file" accept="application/pdf,.pdf" className="font-mono text-small" />
        <p className="text-small text-graphite">
          Text is extracted the way an applicant tracking system would read it. Designed layouts may come out
          scrambled — you correct the result on the next screen.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-rule" />
        <span className="eyebrow">or</span>
        <span className="h-px flex-1 bg-rule" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="text" className="eyebrow">
          CV as text
        </Label>
        <Textarea id="text" name="text" rows={12} placeholder="Paste the full CV text." className="min-h-[240px]" />
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Parsing — about 30 seconds" : "Parse CV"}
        </Button>
        {state.status === "invalid" || state.status === "error" ? (
          <p className="text-small text-signal-destructive">{state.message}</p>
        ) : null}
      </div>
    </form>
  );
}
