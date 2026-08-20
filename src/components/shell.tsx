import Link from "next/link";
import type { ReactNode } from "react";

// DESIGN.md §5: fixed 220px monochrome rail, fluid workspace. One nav entry
// for now; the rail exists so later screens slot in without a re-layout.
export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1">
      <aside className="hidden w-[220px] shrink-0 flex-col border-r border-rule bg-surface md:flex">
        <div className="flex h-12 items-center border-b border-rule px-4">
          <span className="font-display text-h2 font-semibold text-ink">Job match</span>
        </div>
        <nav className="flex flex-col py-2" aria-label="Primary">
          <Link
            href="/"
            aria-current="page"
            className="flex h-8 items-center px-4 text-body font-medium text-ink aria-[current=page]:bg-surface-sunken"
          >
            Jobs
          </Link>
        </nav>
      </aside>
      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-[1440px] px-4 py-6 md:px-6">{children}</div>
      </main>
    </div>
  );
}
