import Link from "next/link";
import type { ReactNode } from "react";

const NAV = [
  { href: "/", label: "Jobs", key: "jobs" },
  { href: "/profile", label: "Profile", key: "profile" },
] as const;
export type NavKey = (typeof NAV)[number]["key"];

// DESIGN.md §5: fixed 220px monochrome rail, fluid workspace.
export function Shell({ children, current }: { children: ReactNode; current: NavKey }) {
  return (
    <div className="flex min-h-full flex-1">
      <aside className="hidden w-[220px] shrink-0 flex-col border-r border-rule bg-surface md:flex">
        <div className="flex h-12 items-center border-b border-rule px-4">
          <span className="font-display text-h2 font-semibold text-ink">Job match</span>
        </div>
        <nav className="flex flex-col py-2" aria-label="Primary">
          {NAV.map((n) => (
            <Link
              key={n.key}
              href={n.href}
              aria-current={n.key === current ? "page" : undefined}
              className="flex h-8 items-center px-4 text-body font-medium text-graphite hover:text-ink aria-[current=page]:bg-surface-sunken aria-[current=page]:text-ink"
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-[1440px] px-4 py-6 md:px-6">{children}</div>
      </main>
    </div>
  );
}
