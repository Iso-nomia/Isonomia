import { Inter } from "next/font/google";
import Link from "next/link";
import "../globals.css";
import "./auth-bg.css";
import "./meta-bg.css";
import MetaBg from "./MetaBg";   // ← path relative to this file
import { siteIcons } from "@/lib/favicons";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://isonomia.app";

export const metadata = {
  metadataBase: new URL(BASE_URL),
  title: "Isonomia — store, cite, and check the reasoning behind a conclusion",
  description:
    "Isonomia is open-source software for storing, citing, and checking the reasoning behind a conclusion. It turns an argument into structured, verifiable data instead of prose — with provenance, the strongest known objection, and whether it has survived challenge.",
  icons: siteIcons,
  // Google Search Console (URL-prefix) verification — emitted only when
  // GOOGLE_SITE_VERIFICATION is set in the environment.
  ...(process.env.GOOGLE_SITE_VERIFICATION
    ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } }
    : {}),
  openGraph: {
    type: "website",
    url: BASE_URL,
    siteName: "Isonomia",
    title: "Isonomia",
    description:
      "Open-source software for storing, citing, and checking the reasoning behind a conclusion.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Isonomia",
    description:
      "Open-source software for storing, citing, and checking the reasoning behind a conclusion.",
  },
};

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} `}>
      {/* <MetaBg /> */}
{children}
        {/* Crawlable context + paths into the public explanation. The homepage
            redirects here, so this footer is often the first thing a search
            engine or LLM sees when it reaches the site. */}
        <footer className="mx-auto max-w-2xl px-6 pb-10 pt-2 text-center text-sm text-slate-500">
          <p className="mx-auto max-w-xl">
            Isonomia is open-source software for storing, citing, and checking
            the reasoning behind a conclusion.
          </p>
          <nav className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <Link href="/about" className="hover:text-slate-800 hover:underline">
              About
            </Link>
            <Link href="/docs" className="hover:text-slate-800 hover:underline">
              Docs
            </Link>
            <Link
              href="/search/arguments"
              className="hover:text-slate-800 hover:underline"
            >
              Search arguments
            </Link>
          </nav>
        </footer>
      </body>
    </html>
  );
}
