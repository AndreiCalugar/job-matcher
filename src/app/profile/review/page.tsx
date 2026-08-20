import { redirect } from "next/navigation";
import { z } from "zod";
import { Shell } from "@/components/shell";
import { ProfileEditor } from "@/components/profile/profile-editor";
import { getProfile } from "@/lib/cv/queries";
import { requireUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ gaps?: string }> }) {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  if (!profile) redirect("/profile");

  const { gaps: raw } = await searchParams;
  let gaps: string[] = [];
  if (raw) {
    const parsed = z.array(z.string()).safeParse(safeJson(raw));
    if (parsed.success) gaps = parsed.data;
  }

  return (
    <Shell current="profile">
      <h1 className="font-display text-display font-semibold text-ink">
        {profile.human_corrected ? "Edit profile" : "Review your profile"}
      </h1>
      <p className="mt-2 max-w-[68ch] text-body text-graphite">
        {profile.human_corrected
          ? "Changes are saved as the new reference for every match."
          : "This is what the parser read from your CV. Correct anything wrong and add what the CV leaves out — freelance work that reads thin on paper is exactly what needs enriching here. Nothing is scored until you confirm."}
      </p>
      <div className="mt-8">
        <ProfileEditor
          id={profile.id}
          gaps={gaps}
          profile={{
            headline: profile.headline,
            summary: profile.summary,
            experience: profile.experience,
            skills: profile.skills,
            projects: profile.projects,
            education: profile.education,
            languages: profile.languages,
          }}
        />
      </div>
    </Shell>
  );
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
