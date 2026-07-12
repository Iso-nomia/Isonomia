import type { Metadata } from "next";
import Link from "next/link";
import PublicDocsShell from "@/components/public/PublicDocsShell";

export const dynamic = "force-static";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://isonomia.app";

export const metadata: Metadata = {
  title: "Documentation",
  description:
    "Documentation for Isonomia: architecture, the argument graph, the browser extension, self-hosting, and privacy.",
  alternates: { canonical: `${BASE_URL}/docs` },
};

const SECTIONS: { href: string; title: string; blurb: string }[] = [
  {
    href: "/docs/architecture",
    title: "Architecture",
    blurb:
      "The social layer, the reasoning layer, the argument graph, the evidence system, and the institutional workflow — and how a conversation moves along the informal-to-formal spectrum.",
  },
  {
    href: "/docs/argument-graph",
    title: "Argument graph",
    blurb:
      "How claims, arguments, argumentation schemes, critical questions, challenges, citations, and confidence work — and how every permalink is exposed as a machine-citable artifact.",
  },
  {
    href: "/docs/chrome-extension",
    title: "Browser extension",
    blurb:
      "Create evidence-backed arguments from any webpage, and see inline previews of Isonomia links on Reddit, X, and Hacker News.",
  },
  {
    href: "/docs/self-hosting",
    title: "Self-hosting",
    blurb:
      "Deploy and operate your own Isonomia instance: stack, prerequisites, environment, and the build and run steps.",
  },
  {
    href: "/docs/privacy",
    title: "Privacy",
    blurb:
      "Data ownership, tracking, retention, and how privacy and provenance are enforced by architecture rather than policy.",
  },
];

export default function DocsIndexPage() {
  return (
    <PublicDocsShell
      eyebrow="Documentation"
      title="Isonomia documentation"
      lede="Public, login-free documentation for Isonomia — open-source infrastructure for community gathering and structured reasoning."
    >
      <p>
        New here? Start with{" "}
        <Link href="/about">About Isonomia</Link> for a plain-language overview,
        then read the sections below.
      </p>
      <ul>
        {SECTIONS.map((s) => (
          <li key={s.href}>
            <Link href={s.href}>{s.title}</Link> — {s.blurb}
          </li>
        ))}
      </ul>
      <h2>Machine-readable surfaces</h2>
      <ul>
        <li>
          <a href="/llms.txt">/llms.txt</a> and{" "}
          <a href="/llms-full.txt">/llms-full.txt</a> — curated and full context
          for LLMs.
        </li>
        <li>
          <a href="/.well-known/argument-graph">
            /.well-known/argument-graph
          </a>{" "}
          — machine-readable manifest of the public argument-graph endpoints.
        </li>
        <li>
          <a href="/.well-known/llms.txt">/.well-known/llms.txt</a> — retrieval
          shapes, citation contract, and the MCP surface.
        </li>
        <li>
          <a href="/api/v3/openapi.json">/api/v3/openapi.json</a> — OpenAPI 3.1
          specification.
        </li>
        <li>
          <Link href="/search/arguments">/search/arguments</Link> — public
          argument search.
        </li>
      </ul>
    </PublicDocsShell>
  );
}
