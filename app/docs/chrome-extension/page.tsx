import type { Metadata } from "next";
import Link from "next/link";
import PublicDocsShell, { JsonLd } from "@/components/public/PublicDocsShell";

export const dynamic = "force-static";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://isonomia.app";
const PATH = "/docs/chrome-extension";

export const metadata: Metadata = {
  title: "Browser extension",
  description:
    "The Isonomia browser extension lets you create evidence-backed arguments from any webpage and shows inline previews of Isonomia argument and claim links on Reddit, X, and Hacker News.",
  alternates: { canonical: `${BASE_URL}${PATH}` },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "TechArticle",
  headline: "The Isonomia browser extension",
  description:
    "Create evidence-backed arguments from any webpage, with inline previews of Isonomia links.",
  url: `${BASE_URL}${PATH}`,
  isPartOf: { "@type": "WebSite", name: "Isonomia", url: BASE_URL },
  author: { "@type": "Organization", name: "Isonomia" },
  publisher: { "@type": "Organization", name: "Isonomia" },
  inLanguage: "en",
};

export default function ChromeExtensionPage() {
  return (
    <>
      <JsonLd data={jsonLd} />
      <PublicDocsShell
        eyebrow="Docs"
        title="Browser extension"
        lede="The Isonomia browser extension turns any webpage into a source for an evidence-backed argument, and renders inline previews of Isonomia links where they are shared."
      >
        <p>
          The extension ships across Chrome, Firefox, and Safari. It has three
          capabilities.
        </p>

        <h2>Context menu</h2>
        <p>
          Select text on any webpage, right-click, and create an Isonomia argument
          pre-populated with the selection, the page URL, and the page title. The
          URL is resolved through the same six-stage citation engine used
          everywhere else, so the evidence arrives with verified bibliographic
          metadata and a Wayback snapshot rather than as a bare link.
        </p>

        <h2>Inline previews</h2>
        <p>
          A content script detects Isonomia argument and claim links on Reddit,
          X (Twitter), and Hacker News, and injects rich inline previews showing
          the claim text, the argumentation scheme, the confidence, the evidence
          count, and the author. Readers see the structure of an argument without
          leaving the page they are on.
        </p>

        <h2>Popup composer</h2>
        <p>
          A compact Quick Argument Builder embedded in the extension popup lets
          you construct a structured argument (claim, premises, evidence) and
          generate a shareable link in one click, along with a list of your recent
          arguments.
        </p>

        <h2>How it relates to the rest of Isonomia</h2>
        <p>
          Every argument created through the extension is a first-class argument
          in the graph: it lands in your personal deliberation, resolves to a
          public permalink, and is citable and challengeable like any other. The
          same write primitive is exposed to agents as{" "}
          <code>propose_structured_argument</code> over the Model Context Protocol —
          see the <Link href="/docs/argument-graph">argument graph docs</Link>.
        </p>
      </PublicDocsShell>
    </>
  );
}
