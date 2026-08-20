import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { getUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getUser()) redirect("/");
  const { error } = await searchParams;
  return (
    <main className="flex min-h-full flex-1 items-center justify-center px-4">
      <div className="w-full max-w-[400px]">
        <h1 className="font-display text-display font-semibold text-ink">Job match</h1>
        <p className="mt-2 text-body text-graphite">Sign in with your email. A link is sent; no password exists.</p>
        <div className="mt-6 rounded-lg border border-rule bg-surface p-4">
          <LoginForm />
        </div>
        {error ? <p className="mt-3 text-small text-signal-destructive">Sign-in failed: {error}. Request a new link.</p> : null}
        <p className="mt-6 text-small text-graphite">
          Your CV is processed to score jobs and draft applications for you, and for nothing else.{" "}
          <a href="/privacy" className="text-ink underline underline-offset-2">Privacy</a>
        </p>
      </div>
    </main>
  );
}
