"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { authClient } from "@/lib/auth/session";

export type LoginState = { status: "idle" } | { status: "sent"; email: string } | { status: "error"; message: string };

// Email magic link. No passwords are stored or handled by this app.
export async function sendMagicLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = z.string().email().safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  if (!email.success) return { status: "error", message: "Enter a valid email address." };
  const h = await headers();
  const origin = h.get("origin") ?? `https://${h.get("host")}`;
  const supabase = await authClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: email.data,
    options: { emailRedirectTo: `${origin}/auth/callback`, shouldCreateUser: true },
  });
  if (error) return { status: "error", message: error.message };
  return { status: "sent", email: email.data };
}

export async function signOut(): Promise<void> {
  const supabase = await authClient();
  await supabase.auth.signOut();
  redirect("/login");
}
