"use server";

import { redirect } from "next/navigation";
import { authClient, requireUser } from "@/lib/auth/session";
import { deleteUserCompletely } from "@/lib/auth/account";

export type DeleteState = { status: "idle" } | { status: "error"; message: string };

// Typed confirmation, then hard delete, then sign out. Irreversible.
export async function deleteAccount(_prev: DeleteState, formData: FormData): Promise<DeleteState> {
  const user = await requireUser();
  const typed = String(formData.get("confirm") ?? "").trim().toLowerCase();
  if (typed !== (user.email ?? "").toLowerCase()) return { status: "error", message: "Type your email exactly to confirm." };
  try {
    await deleteUserCompletely(user.id);
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : String(e) };
  }
  const supabase = await authClient();
  await supabase.auth.signOut();
  redirect("/login");
}
