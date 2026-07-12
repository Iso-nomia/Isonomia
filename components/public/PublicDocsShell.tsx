import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Shared server-rendered shell for Isonomia's public, crawlable pages
 * (/about and /docs/*). Deliberately login-free and dependency-light so
 * search engines and LLM crawlers see the full explanation outside the
 * app shell.
 *
 * Typography note: the repo's `@tailwindcss/typography` plugin is not
 * actually loaded (registered as a bare string in tailwind.config.ts),
 * so `prose-*` utilities are no-ops. This component therefore styles the
 * article content explicitly with arbitrary-variant utilities instead of
 * relying on `prose`.
 */

const NAV_LINKS: { href: string; label: string }[] = [
  { href: "/about", label: "About" },
  { href: "/docs", label: "Docs" },
  { href: "/search/arguments", label: "Search" },
];

const DOC_LINKS: { href: string; label: string }[] = [
  { href: "/docs/architecture", label: "Architecture" },
  { href: "/docs/argument-graph", label: "Argument graph" },
  { href: "/docs/chrome-extension", label: "Browser extension" },
  { href: "/docs/self-hosting", label: "Self-hosting" },
  { href: "/docs/privacy", label: "Privacy" },
];

// Explicit, self-contained typography for the article body. Each rule is
// scoped to a descendant element so the content in each page.tsx stays
// plain semantic HTML (<h2>, <p>, <ul>, <a>, <code>, <pre>).
const ARTICLE_TYPOGRAPHY = [
  "text-[15px] leading-7 text-slate-700",
  "[&_p]:my-4",
  "[&_h2]:mt-12 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-slate-900 [&_h2]:scroll-mt-24",
  "[&_h3]:mt-8 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-slate-900",
  "[&_ul]:my-4 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_ul]:marker:text-slate-300",
  "[&_ol]:my-4 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5 [&_ol]:marker:text-slate-400",
  "[&_li]:pl-1",
  "[&_a]:font-medium [&_a]:text-indigo-600 [&_a]:underline [&_a]:decoration-indigo-300 [&_a]:underline-offset-2 [&_a:hover]:decoration-indigo-500",
  "[&_strong]:font-semibold [&_strong]:text-slate-900",
  "[&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[0.85em] [&_code]:text-slate-800",
  "[&_pre]:my-5 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-slate-900 [&_pre]:p-4 [&_pre]:text-sm [&_pre]:leading-6 [&_pre]:text-slate-100",
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-slate-100",
].join(" ");

export default function PublicDocsShell({
  children,
  eyebrow,
  title,
  lede,
  cta,
}: {
  children: ReactNode;
  eyebrow?: string;
  title: string;
  lede?: string;
  /** Optional highlighted block rendered after the article (e.g. a CTA). */
  cta?: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 text-slate-900 ">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-4 text-lg">
          <Link href="/" className="font-semibold tracking-tight text-slate-900">
            Isonomia
          </Link>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-slate-600">
            <Link href="/about" className="hover:text-slate-900">
              About
            </Link>
            <Link href="/docs" className="hover:text-slate-900">
              Docs
            </Link>
            <Link href="/search/arguments" className="hover:text-slate-900">
              Search
            </Link>
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-5xl  px-6 py-5">
        <header className="mb-4">
          {eyebrow ? (
            <p className="mb-2 text-sm font-medium uppercase tracking-wide text-slate-500">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            {title}
          </h1>
          {lede ? (
            <p className="mt-4 text-lg leading-relaxed text-slate-600">{lede}</p>
          ) : null}
        </header>

        <article className={`panelv2 ${ARTICLE_TYPOGRAPHY}`}>
          {children}
        </article>

        {cta ? <div className="mt-16">{cta}</div> : null}
      </main>

      <footer className="border-t max-w-full surfacev2 border-slate-200 bg-white/60">
        <div className="mx-auto max-w-5xl sidebarv2 px-6 py-3 text-sm text-slate-600">
          <p className="mb-4 font-medium text-slate-900 font-semibold">Documentation</p>
          <ul className="mb-4 flex gap-10 flex-wrap text-slate-700 ">
            {DOC_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="hover:text-slate-900">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mb-2 font-medium text-slate-900 font-semibold">Machine-readable</p>
          <ul className="flex flex-wrap gap-10 text-slate-700">
            <li>
              <a href="/llms.txt" className="hover:text-slate-900">
                /llms.txt
              </a>
            </li>
            <li>
              <a href="/llms-full.txt" className="hover:text-slate-900">
                /llms-full.txt
              </a>
            </li>
            <li>
              <a href="/.well-known/argument-graph" className="hover:text-slate-900">
                Argument-graph manifest
              </a>
            </li>
            <li>
              <a href="/sitemap.xml" className="hover:text-slate-900">
                Sitemap
              </a>
            </li>
          </ul>
         
        </div>
      </footer>
    </div>
  );
}

/**
 * Small helper to emit a JSON-LD block. Mirrors the pattern used on the
 * /a/{shortCode} argument pages.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
