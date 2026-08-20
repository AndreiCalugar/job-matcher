import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Archivo, IBM_Plex_Mono, Inter_Tight } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

// DESIGN.md §3 — exactly three families, all via next/font/google.
// next/font self-hosts the files at build time: no runtime request to
// Google, no layout shift, and the CSS variable is the only coupling
// between this file and globals.css.

// "Archivo Expanded" is Archivo's variable width axis at 125%. Loading the
// `wdth` axis lets one file serve every width; `.font-display` applies the
// stretch.
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  weight: "variable",
  variable: "--font-archivo",
  display: "swap",
});

const interTight = Inter_Tight({
  subsets: ["latin"],
  weight: "variable",
  variable: "--font-inter-tight",
  display: "swap",
});

// Plex Mono is not a variable font; list the weights used.
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Job match",
  description: "Score job postings against your profile. Honestly.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // suppressHydrationWarning: next-themes writes the `dark` class on <html>
    // before React hydrates, which would otherwise warn on every load.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${archivo.variable} ${interTight.variable} ${plexMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
