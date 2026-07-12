/**
 * Minimal "public" shell for the argument search page.
 *
 * Mirrors app/a/[identifier]/layout.tsx — a logged-out visitor arriving from
 * Google should not see the full app chrome. SEO + LCP win, per the
 * roadmap's locked Q1 decision.
 */
import "@/app/globals.css";

export const metadata = {
  title: "Search arguments — Isonomia",
  description:
    "Search Isonomia's public corpus of dialectically-attested arguments.",
};

export default function PublicSearchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
