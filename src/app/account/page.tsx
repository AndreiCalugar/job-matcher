import { Shell } from "@/components/shell";
import { DeleteAccountForm } from "@/components/auth/delete-account-form";
import { requireUser } from "@/lib/auth/session";
import { getProfile } from "@/lib/cv/queries";
import { supabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  const { data: usage } = await supabase.from("usage_event").select("kind, input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens").eq("user_id", user.id);
  const byKind = new Map<string, number>();
  for (const u of usage ?? []) byKind.set(u.kind, (byKind.get(u.kind) ?? 0) + 1);

  return (
    <Shell current="account">
      <h1 className="font-display text-display font-semibold text-ink">Account</h1>
      <p className="mt-1 font-mono text-small text-graphite">{user.email}</p>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <section className="rounded-lg border border-rule bg-surface p-4">
          <h2 className="eyebrow mb-2">Your data</h2>
          <p className="max-w-[60ch] text-small text-graphite">
            Your CV text, the parsed profile you reviewed, your search profiles, pasted jobs, match results, generated kits, and application history.
            Shared job postings from public boards are not personal data and are referenced by id.
          </p>
          <a href="/account/export" className="mt-4 inline-flex h-8 items-center rounded-md border border-rule px-3 text-body font-medium text-ink hover:bg-surface-sunken">
            Download everything as JSON
          </a>
        </section>
        <section className="rounded-lg border border-rule bg-surface p-4">
          <h2 className="eyebrow mb-2">Usage</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-small">
            {[...byKind.entries()].map(([k, n]) => (
              <div key={k} className="contents">
                <dt className="font-mono text-graphite">{k}</dt>
                <dd className="font-mono text-ink">{n}</dd>
              </div>
            ))}
            {byKind.size === 0 ? <dd className="text-graphite">No model calls yet.</dd> : null}
          </dl>
          <p className="mt-3 text-small text-graphite">Profile reviewed: {profile?.human_corrected ? "yes" : "no"}.</p>
        </section>
      </div>

      <section className="mt-8 rounded-lg border border-rule bg-surface p-4">
        <h2 className="eyebrow mb-2">Delete account</h2>
        <p className="mb-4 max-w-[60ch] text-small text-graphite">
          Removes your sign-in, every profile row, and everything attached to them — matches, kits, applications, usage records, pasted jobs. Immediately and permanently. There is no recovery and no retention copy.
        </p>
        <DeleteAccountForm email={user.email ?? ""} />
      </section>
    </Shell>
  );
}
