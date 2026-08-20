"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

// attribute="class" pairs with `@custom-variant dark (&:is(.dark *))` in
// globals.css. defaultTheme="system" per DESIGN.md §2. enableSystem keeps
// following the OS until the user picks explicitly.
export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
