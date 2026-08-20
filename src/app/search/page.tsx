import { Shell } from "@/components/shell";
import { requireUser } from "@/lib/auth/session";
import { getProfile } from "@/lib/cv/queries";
import { SearchProfileForm } from "@/components/ingest/search-profile-form";
import { Button } from "@/components/ui/button";
import { deleteSearchProfile } from "@/lib/ingest/actions";
import { listSearchProfiles } from "@/lib/ingest/queries";

export const dynamic = "force-dynamic";

// Saved, reusable criteria (CLAUDE.md "Onboarding §4"). They do not fetch
// anything; they decide which ingested postings deserve a scoring call.
export default async function SearchPage() {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  const profiles = profile ? await listSearchProfiles(profile.id) : [];
  return (
    <Shell current="search">
      <h1 className="font-display text-display font-semibold text-ink">Search profiles</h1>
      <p className="mt-2 max-w-[68ch] text-body text-graphite">
        Ingested postings are parsed regardless. Only those matching an enabled search profile are scored — that is where the cost is.
        Without one, nothing is auto-scored.
      </p>

      <div className="mt-8 flex flex-col gap-6">
        {profiles.map((sp) => (
          <section key={sp.id} className="rounded-lg border border-rule bg-surface p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="eyebrow">{sp.name}{sp.enabled ? "" : " · disabled"}</h2>
              <form action={deleteSearchProfile}>
                <input type="hidden" name="id" value={sp.id} />
                <Button type="submit" size="xs" variant="ghost" className="text-graphite hover:text-signal-destructive">
                  Delete
                </Button>
              </form>
            </div>
            <SearchProfileForm sp={sp} />
          </section>
        ))}
        <section className="rounded-lg border border-rule bg-surface p-4">
          <h2 className="eyebrow mb-3">New search profile</h2>
          <SearchProfileForm />
        </section>
      </div>
    </Shell>
  );
}
