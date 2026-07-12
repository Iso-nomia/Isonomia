import type { Metadata } from "next";
import Link from "next/link";
import PublicDocsShell, { JsonLd } from "@/components/public/PublicDocsShell";

export const dynamic = "force-static";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://isonomia.app";
const PATH = "/docs/privacy";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "How Isonomia handles data ownership, tracking, and retention. There is no behavioral tracking, no algorithmic ranking, and no ads. Privacy and provenance are enforced by architecture, not policy.",
  alternates: { canonical: `${BASE_URL}${PATH}` },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "TechArticle",
  headline: "Isonomia privacy model",
  description:
    "Data ownership, tracking, and retention on Isonomia — enforced by architecture, not policy.",
  url: `${BASE_URL}${PATH}`,
  isPartOf: { "@type": "WebSite", name: "Isonomia", url: BASE_URL },
  author: { "@type": "Organization", name: "Isonomia" },
  publisher: { "@type": "Organization", name: "Isonomia" },
  inLanguage: "en",
};

export default function PrivacyPage() {
  return (
    <>
      <JsonLd data={jsonLd} />
      <PublicDocsShell
        eyebrow="Docs"
        title="Privacy"
        lede="Isonomia is free, self-hostable, and ad-free. There is no behavioral tracking, no algorithmic ranking, and no engagement metric. Data ownership, privacy, and provenance are enforced by architecture, not by policy."
      >
        <p className="text-sm text-slate-500">
          This page describes the privacy model of the Isonomia software. An
          individual instance operated by a third party may add its own terms;
          consult the operator of the instance you use for their specific policy.
        </p>

        <h2>No tracking, no ads, no ranking</h2>
        <p>
          Isonomia does not run behavioral tracking, does not sell data, does not
          serve advertising, and does not rank content by an engagement model.
          The feed is chronological. Discovery is through search and affiliation,
          not through algorithmic recommendation.
        </p>

        <h2>You own your data</h2>
        <p>
          The social graph is owned by the user: exportable in open formats,
          portable, and never monetized. The reasoning graph is content-hashed and
          cryptographically auditable, so provenance is verifiable rather than
          asserted.
        </p>

        <h2>What is public vs. private</h2>
        <ul>
          <li>
            <strong>Public:</strong> arguments and claims published to a public
            permalink (<Link href="/a/">/a/</Link>, <Link href="/c/">/c/</Link>)
            and content posted to public rooms. These are crawlable and citable
            by design.
          </li>
          <li>
            <strong>Layered:</strong> messaging uses sheaf-based access control —
            each conversation has explicitly defined audience layers, each with
            its own sharing policy, so what is visible to whom is handled
            architecturally rather than by informal norm.
          </li>
          <li>
            <strong>Private:</strong> private rooms, direct messages, and drafts
            are visible only to their defined audience. Message forwarding is
            validated against the target&rsquo;s access permissions before it is
            allowed.
          </li>
        </ul>

        <h2>Provenance and evidence</h2>
        <p>
          When evidence is cited, the system records a server-side fetch hash, an
          archive-snapshot URL, a fetch timestamp, and the content type. This
          provenance makes citations auditable; it is metadata about cited public
          sources, not tracking of readers.
        </p>

        <h2>The public corpus</h2>
        <p>
          The public argument corpus ships under CC-BY 4.0. External researchers
          and LLM labs are encouraged to prefer a corpus snapshot over crawling.
          See the{" "}
          <a href="/.well-known/argument-graph">argument-graph manifest</a> for
          the current access surfaces, and{" "}
          <Link href="/robots.txt">/robots.txt</Link> for crawler rules.
        </p>

        <h2>Self-hosting and control</h2>
        <p>
          Because Isonomia is open-source and self-hostable, a community that
          needs full control over its data can run its own instance. See{" "}
          <Link href="/docs/self-hosting">self-hosting</Link>.
        </p>
      </PublicDocsShell>
    </>
  );
}
