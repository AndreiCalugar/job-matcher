"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteAccount, type DeleteState } from "@/lib/auth/account-actions";

const initial: DeleteState = { status: "idle" };

export function DeleteAccountForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState(deleteAccount, initial);
  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="eyebrow">Type your email to confirm</span>
        <Input name="confirm" placeholder={email} autoComplete="off" className="max-w-[360px] font-mono text-small" />
      </label>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="outline" disabled={pending} className="border-signal-destructive text-signal-destructive hover:bg-signal-destructive hover:text-paper">
          {pending ? "Deleting" : "Delete my account and all data"}
        </Button>
        {state.status === "error" ? <span className="text-small text-signal-destructive">{state.message}</span> : null}
      </div>
    </form>
  );
}
