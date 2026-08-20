import Link from "next/link";
import { CalibrationBar } from "@/components/match/calibration-bar";
import { ThemeToggle } from "@/components/theme-toggle";

// Public landing page. Same instrument-not-companion register as the app
// (DESIGN.md §1, §9): plain sentences, no enthusiasm, colour only where a
// number is shown. Every claim below is something the code does.

const STEPS = [
  { n: "01", title: "Upload your CV once", body: "It is parsed into a structured profile that you review and correct. Nothing is scored against a profile you have not confirmed." },
  { n: "02", title: "Paste a job, or let feeds bring them", body: "Paste any posting, or subscribe to company career pages and job boards. Each ad is parsed exactly once." },
  { n: "03", title: "Get a calibrated score and the gaps", body: "A 0–100 estimate of your chance of a first interview, the requirements you meet with evidence, the ones you miss and how to handle them, and a pre-mortem." },
  { n: "04", title: "Generate the kit, send it yourself", body: "CV advice as a diff, a cover letter, outreach if you name a person. Every claim is checked against your profile before you see it. You press send." },
];

const FEATURES = [
  { title: "Honest calibration", body: "The score is a prediction, so it is tested against reality: response rate per predicted band, on your own applications. A 40 is more useful than a flattering 70." },
  { title: "Gaps are the product", body: "Each gap carries a severity, whether it can be bridged, and one concrete sentence on what to do about it in the application or the interview." },
  { title: "The pre-mortem", body: "One paragraph in the hiring manager's voice on why they passed. Specific to the posting and to you. Not softened." },
  { title: "Nothing invented", body: "Generated material passes a gate: every number, technology, employer and claim must trace to your profile or the posting. If it cannot, the draft is discarded, not shown." },
  { title: "Your CV stays yours", body: "Advice is a list of edits you accept or reject and apply in your own file. A plain, single-column ATS-safe copy is generated for systems that read before humans do." },
  { title: "Tracking that compounds", body: "Applied, screening, interview, offer — and ghosted, as a first-class state. Response rate by band, by angle, by source. Median days to a reply. The gaps that recur." },
  { title: "Freelance counts", body: "Contract and self-employed work is treated as real experience, and contract postings are matched like any other. Most tools assume salaried." },
  { title: "Runs while you sleep", body: "Subscribed feeds are polled every six hours. New postings are parsed; those matching your saved search criteria are scored and waiting in the morning." },
];

const WONT = [
  { title: "It will not apply for you", body: "Mass submission is what made recruiters hostile to AI tooling. The tool gets you to a reviewed, ready-to-send kit; a human presses send." },
  { title: "It will not scrape LinkedIn", body: "No profile collection, no automated connection requests. If you want to write to a person, you type their name in, one at a time." },
  { title: "It will not flatter you", body: "A weak match is shown as weak, in a muted colour, below the fold. Attention goes to the roles you can actually get." },
];

const FAQ = [
  { q: "Is it really free?", a: "Yes. The score, gaps, pre-mortem, tracking and statistics are free and will stay free. Application-kit generation is also free while the project is in its early phase; if that ever changes it will be a credit pack, not a subscription — job seekers churn the week they get hired." },
  { q: "What happens to my CV?", a: "It is stored in an EU database, sent to the model only when you ask for a parse, score or draft, and never used to train anything. You can export everything as JSON or delete your account and every row attached to it, instantly, from the account page." },
  { q: "How accurate is the score?", a: "Unknown until measured, and the app says so. The statistics page shows response rate per predicted band once you have sent enough applications; the prompt is scored against a hand-ranked set before changes ship. The number is shown with its scale because the scale is honest." },
  { q: "Which job boards are supported?", a: "Paste works for anything. Feeds: Greenhouse, Lever and Ashby company boards, and the Jobicy, Arbeitnow and RemoteOK aggregators. More as they are needed." },
  { q: "Does it rewrite my CV?", a: "No. A designed CV is something you own; regenerating it produces something worse. You get a change list with reasons, and a separate plain-text version for applicant tracking systems." },
  { q: "Who built this?", a: "One engineer, in public, for their own job search first. The repository, the build log and the evaluation numbers are open." },
];

// Illustrative only; labelled as such in the UI.
const EXAMPLE = [
  { title: "Senior Frontend Engineer", company: "Payments company, Copenhagen", score: 78 },
  { title: "Full-Stack Engineer", company: "Spend management, remote EU", score: 62 },
  { title: "Backend Engineer, Go", company: "Marketplace, Berlin", score: 31 },
];

export function Landing() {
  return (
    <div className="min-h-full bg-paper text-ink">
      <header className="mx-auto flex h-14 max-w-[1080px] items-center justify-between px-4">
        <span className="font-display text-h2 font-semibold">Job match</span>
        <nav className="flex items-center gap-4">
          <a href="#how" className="hidden text-small text-graphite hover:text-ink sm:inline">How it works</a>
          <a href="#faq" className="hidden text-small text-graphite hover:text-ink sm:inline">FAQ</a>
          <a href="https://github.com/AndreiCalugar/job-matcher" target="_blank" rel="noreferrer noopener" className="hidden text-small text-graphite hover:text-ink sm:inline">Source</a>
          <ThemeToggle />
          <Link href="/login" className="inline-flex h-8 items-center rounded-md bg-ink px-3 text-body font-medium text-paper">Sign in</Link>
        </nav>
      </header>

      <main className="mx-auto max-w-[1080px] px-4">
        {/* Hero */}
        <section className="grid gap-10 py-16 md:grid-cols-[1.1fr_1fr] md:items-center md:py-24">
          <div>
            <p className="eyebrow">Job search instrument · free · open source</p>
            <h1 className="mt-4 max-w-[22ch] font-display text-[40px] leading-[44px] font-semibold tracking-[-0.01em] md:text-[52px] md:leading-[56px]">
              Know which jobs you will actually get before you spend an hour applying.
            </h1>
            <p className="mt-6 max-w-[56ch] text-body text-graphite md:text-[16px] md:leading-[24px]">
              Paste a posting. Get a calibrated score, the requirements you meet with evidence, the ones you miss and what to do about them, and a ready-to-send application kit in which nothing is invented.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/login" className="inline-flex h-10 items-center rounded-md bg-ink px-4 text-body font-medium text-paper">Start with your CV</Link>
              <a href="#how" className="inline-flex h-10 items-center rounded-md border border-rule px-4 text-body font-medium text-ink hover:bg-surface">See how it works</a>
            </div>
            <p className="mt-4 font-mono text-micro text-graphite">Email sign-in · no password · delete everything in one click</p>
          </div>

          <figure className="rounded-lg border border-rule bg-surface">
            <figcaption className="flex items-center justify-between border-b border-rule px-4 py-2">
              <span className="eyebrow">Morning queue</span>
              <span className="font-mono text-micro text-graphite">example data</span>
            </figcaption>
            <ul className="divide-y divide-rule">
              {EXAMPLE.map((e) => (
                <li key={e.title} className="flex items-center gap-4 px-4 py-3">
                  <CalibrationBar score={e.score} verdict={e.score >= 75 ? "strong" : e.score >= 55 ? "stretch" : e.score >= 35 ? "weak" : "mismatch"} />
                  <div className="min-w-0">
                    <p className="truncate text-body text-ink">{e.title}</p>
                    <p className="truncate text-micro text-graphite">{e.company}</p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="border-t border-rule px-4 py-3">
              <p className="eyebrow mb-1">Pre-mortem · Backend Engineer, Go</p>
              <p className="max-w-[52ch] text-small text-ink">
                We needed someone who had run Go services in production. The candidate&apos;s backend depth is C#/.NET and Node; strong, but we would be paying them to learn our primary language.
              </p>
            </div>
          </figure>
        </section>

        {/* How it works */}
        <section id="how" className="border-t border-rule py-16">
          <h2 className="eyebrow">How it works</h2>
          <ol className="mt-6 grid gap-6 md:grid-cols-4">
            {STEPS.map((s) => (
              <li key={s.n} className="rounded-lg border border-rule bg-surface p-4">
                <span className="font-mono text-small text-graphite">{s.n}</span>
                <h3 className="mt-2 text-h3 font-medium text-ink">{s.title}</h3>
                <p className="mt-2 text-small text-graphite">{s.body}</p>
              </li>
            ))}
          </ol>
          <p className="mt-4 font-mono text-micro text-graphite">Target: paste to ready-to-send kit in under two minutes.</p>
        </section>

        {/* Features */}
        <section className="border-t border-rule py-16">
          <h2 className="eyebrow">What you get</h2>
          <div className="mt-6 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.title}>
                <h3 className="text-h3 font-medium text-ink">{f.title}</h3>
                <p className="mt-2 max-w-[40ch] text-small text-graphite">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* What it will not do */}
        <section className="border-t border-rule py-16">
          <h2 className="eyebrow">What it will not do</h2>
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            {WONT.map((w) => (
              <div key={w.title} className="rounded-lg border border-rule bg-surface p-4">
                <h3 className="text-h3 font-medium text-ink">{w.title}</h3>
                <p className="mt-2 text-small text-graphite">{w.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="border-t border-rule py-16">
          <h2 className="eyebrow">Price</h2>
          <div className="mt-6 grid gap-6 md:grid-cols-[1fr_1.4fr] md:items-start">
            <div className="rounded-lg border border-rule bg-surface p-6">
              <p className="font-display text-display font-semibold text-ink">Free</p>
              <p className="mt-2 text-body text-graphite">All of it, for now. No card, no trial clock.</p>
              <ul className="mt-4 flex flex-col gap-1 text-small text-ink">
                {["Match score, gaps, pre-mortem, red flags", "Application kit with the anti-fabrication gate", "Feeds, search profiles, the morning queue", "Tracking and statistics — never paywalled", "Export and delete, any time"].map((x) => (
                  <li key={x} className="flex gap-2"><span className="font-mono text-graphite">—</span>{x}</li>
                ))}
              </ul>
              <Link href="/login" className="mt-6 inline-flex h-9 items-center rounded-md bg-ink px-4 text-body font-medium text-paper">Sign in with email</Link>
            </div>
            <div className="max-w-[56ch] text-small text-graphite">
              <p>Why free: the project needs evidence more than revenue. The score is only worth something once enough real applications have been tracked to show whether it predicts responses; that takes users, not subscribers.</p>
              <p className="mt-3">What it costs to run: the model calls behind a score or a kit cost cents. The usage meter exists from day one so that, if pricing ever comes, it is set from real numbers — as credit packs or a 30-day pass, not a subscription. Tracking and statistics stay free regardless.</p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="border-t border-rule py-16">
          <h2 className="eyebrow">Questions</h2>
          <dl className="mt-6 divide-y divide-rule rounded-lg border border-rule bg-surface">
            {FAQ.map((f) => (
              <details key={f.q} className="group px-4 py-3">
                <summary className="cursor-pointer list-none text-body font-medium text-ink marker:hidden">
                  <span className="mr-2 font-mono text-graphite group-open:hidden">+</span>
                  <span className="mr-2 hidden font-mono text-graphite group-open:inline">–</span>
                  {f.q}
                </summary>
                <dd className="mt-2 max-w-[68ch] pl-5 text-small text-graphite">{f.a}</dd>
              </details>
            ))}
          </dl>
        </section>

        {/* Final CTA */}
        <section className="border-t border-rule py-16">
          <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <h2 className="font-display text-h1 font-semibold text-ink">Upload your CV. Paste one job. Read the pre-mortem.</h2>
              <p className="mt-2 max-w-[56ch] text-body text-graphite">Two minutes to the first honest number. If it stings, it was worth knowing before you applied.</p>
            </div>
            <Link href="/login" className="inline-flex h-10 items-center justify-center rounded-md bg-ink px-4 text-body font-medium text-paper">Start</Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-rule">
        <div className="mx-auto flex max-w-[1080px] flex-wrap items-center justify-between gap-3 px-4 py-6 font-mono text-micro text-graphite">
          <span>Job match · built in public</span>
          <nav className="flex gap-4">
            <Link href="/privacy" className="hover:text-ink">Privacy</Link>
            <a href="https://github.com/AndreiCalugar/job-matcher" target="_blank" rel="noreferrer noopener" className="hover:text-ink">GitHub</a>
            <a href="https://github.com/AndreiCalugar/job-matcher/tree/main/docs/adr" target="_blank" rel="noreferrer noopener" className="hover:text-ink">Decisions</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
