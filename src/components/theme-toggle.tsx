"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

// Three-state segmented control: system / light / dark. Text only, mono,
// monochrome (DESIGN.md §1: chrome carries no colour). Renders nothing
// until mounted so server and client markup agree.
const OPTIONS = ["system", "light", "dark"] as const;

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  // false during SSR/hydration, true once on the client — without an effect.
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  if (!mounted) return <span className={`inline-block h-7 w-[148px] ${className}`} aria-hidden />;
  return (
    <div role="radiogroup" aria-label="Theme" className={`inline-flex h-7 items-center rounded-md border border-rule bg-surface p-0.5 ${className}`}>
      {OPTIONS.map((o) => {
        const active = (theme ?? "system") === o;
        return (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(o)}
            className={`h-6 rounded-sm px-2 font-mono text-micro uppercase tracking-[0.08em] transition-colors duration-[120ms] ${
              active ? "bg-ink text-paper" : "text-graphite hover:text-ink"
            }`}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}
