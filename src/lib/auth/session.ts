import "@/lib/server-guard";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

// Per-request Supabase client bound to the user's session cookie (anon
// key). Used for auth only; data access stays on the service-role client
// scoped by profile in code, with RLS as the second line.
export async function authClient() {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (all) => {
        try {
          all.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Called from a Server Component: cookies are read-only there; the
          // proxy refreshes sessions, so this is safe to ignore.
        }
      },
    },
  });
}

export type SessionUser = { id: string; email: string | null };

// Cached per request so pages and actions can both call it freely.
export const getUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await authClient();
  const { data } = await supabase.auth.getUser();
  return data.user ? { id: data.user.id, email: data.user.email ?? null } : null;
});

export async function requireUser(): Promise<SessionUser> {
  const u = await getUser();
  if (!u) redirect("/login");
  return u;
}
