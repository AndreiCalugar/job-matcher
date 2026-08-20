"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sendMagicLink, type LoginState } from "@/lib/auth/actions";

const initial: LoginState = { status: "idle" };

export function LoginForm() {
  const [state, action, pending] = useActionState(sendMagicLink, initial);
  if (state.status === "sent") {
    return (
      <p className="text-body text-ink">
        Link sent to <span className="font-mono">{state.email}</span>. Open it on this device. It expires in an hour.
      </p>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="eyebrow">Email</span>
        <Input name="email" type="email" autoComplete="email" required placeholder="you@example.com" className="font-mono text-small" />
      </label>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Sending" : "Send sign-in link"}</Button>
        {state.status === "error" ? <span className="text-small text-signal-destructive">{state.message}</span> : null}
      </div>
    </form>
  );
}
