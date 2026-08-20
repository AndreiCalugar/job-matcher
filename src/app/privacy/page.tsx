export const dynamic = "force-static";

// Plain statement, not legal theatre. Every sentence is something the code
// actually does.
export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-[68ch] px-4 py-12">
      <h1 className="font-display text-display font-semibold text-ink">Privacy</h1>
      <p className="mt-2 font-mono text-small text-graphite">Last updated 2026-08-20</p>

      <div className="mt-8 flex flex-col gap-6 text-body text-ink">
        <section>
          <h2 className="eyebrow mb-2">What this is</h2>
          <p>Job match scores job postings against your CV, shows you the gaps, and drafts application material you send yourself. It is run by an individual developer, not a company, and its source is public on GitHub.</p>
        </section>
        <section>
          <h2 className="eyebrow mb-2">What is collected</h2>
          <ul className="list-disc pl-5">
            <li>Your email address, used only to sign you in. No password is ever stored.</li>
            <li>Your CV, as the text you upload or paste, and the structured profile parsed from it that you review and correct.</li>
            <li>Search criteria, job postings you paste, match results, generated drafts, and the application history you log.</li>
            <li>A record of each model call made on your behalf (tokens and timing), for cost accounting.</li>
          </ul>
        </section>
        <section>
          <h2 className="eyebrow mb-2">How it is used</h2>
          <p>To do what the product says: parse your CV, score postings against it, and draft material. Nothing else. Your data is not sold, shared, or used for advertising.</p>
        </section>
        <section>
          <h2 className="eyebrow mb-2">Processors</h2>
          <ul className="list-disc pl-5">
            <li><span className="font-medium">Supabase</span> (EU, Frankfurt) stores the data.</li>
            <li><span className="font-medium">Vercel</span> hosts the application.</li>
            <li><span className="font-medium">Anthropic</span> receives your profile and the posting text when a parse, score, or draft is requested, under API terms that do not permit training on that data.</li>
          </ul>
        </section>
        <section>
          <h2 className="eyebrow mb-2">No training</h2>
          <p>Your CV and anything derived from it are never used to train or fine-tune any model, by this service or by its processors. The only thing measured across users is aggregate, structured process data (for example, typical days to a first response), and only when you opt in per application — a feature that does not exist yet.</p>
        </section>
        <section>
          <h2 className="eyebrow mb-2">Your control</h2>
          <ul className="list-disc pl-5">
            <li><span className="font-medium">Export:</span> Account → download everything as one JSON file, any time.</li>
            <li><span className="font-medium">Delete:</span> Account → delete. Removes your sign-in and every row attached to it immediately. No retention copy is kept.</li>
            <li><span className="font-medium">Correct:</span> the profile review screen is the record; edit it whenever.</li>
          </ul>
        </section>
        <section>
          <h2 className="eyebrow mb-2">Retention</h2>
          <p>Until you delete. Job postings fetched from public boards are not personal data and are kept as a shared corpus.</p>
        </section>
        <section>
          <h2 className="eyebrow mb-2">Contact</h2>
          <p>Open an issue on the GitHub repository, or use the email on the project README.</p>
        </section>
      </div>
      <p className="mt-10 text-small text-graphite"><a href="/login" className="text-ink underline underline-offset-2">← Sign in</a></p>
    </main>
  );
}
