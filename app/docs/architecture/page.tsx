import type { Metadata } from "next";
import Link from "next/link";
import PublicDocsShell, { JsonLd } from "@/components/public/PublicDocsShell";

export const dynamic = "force-static";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://isonomia.app";
const PATH = "/docs/architecture";

export const metadata: Metadata = {
  title: "Architecture",
  description:
    "How Isonomia stores, cites, and checks the reasoning behind a conclusion: a social layer and a reasoning layer under one data model, connected by a single reversible upgrade action, plus the argument graph, evidence system, living documents, institutional pathways, and the Plexus network.",
  alternates: { canonical: `${BASE_URL}${PATH}` },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "TechArticle",
  headline: "Isonomia architecture",
  description:
    "How Isonomia unifies a social layer and a formal reasoning layer under a single data model.",
  url: `${BASE_URL}${PATH}`,
  isPartOf: { "@type": "WebSite", name: "Isonomia", url: BASE_URL },
  author: { "@type": "Organization", name: "Isonomia" },
  publisher: { "@type": "Organization", name: "Isonomia" },
  inLanguage: "en",
};

export default function ArchitecturePage() {
  return (
    <>
      <JsonLd data={jsonLd} />
      <PublicDocsShell
        eyebrow="Docs"
        title="Architecture"
        lede="Isonomia is open-source software for storing, citing, and checking the reasoning behind a conclusion. Underneath, it fuses a general-purpose social platform with a formal deliberation engine under a single data model, so any conversation can be upgraded to a tracked deliberation through a single reversible action, and every resulting claim, argument, and deliberation is addressable, citable, challengeable, and durable."
      >
        <p>
          The two layers below are how that thesis is built: the social layer is
          where reasoning already happens informally, and the reasoning layer is
          where its structure is captured as data — in the same place, through a
          single reversible action, rather than bolted on afterward as a separate
          annotation chore.
        </p>

        <h2>The two layers</h2>
        <p>
          <strong>The social layer (MESH)</strong> is a complete, standalone
          community platform: a chronological feed with eight post types
          (text, image, audio, gallery, article, library, thread, document),
          profiles with friend and follow systems, persistent rooms and lounges,
          spatial canvas environments, sheaf-based layered messaging with drifts,
          proposals and polls, a long-form article system with anchored comments
          and rhetoric overlays, and shared document libraries. It requires no
          engagement with the reasoning layer.
        </p>
        <p>
          <strong>The reasoning layer (Isonomia)</strong> provides formal
          deliberation infrastructure: argumentation schemes with auto-generated
          critical questions, typed dialogue moves with protocol enforcement,
          commitment stores, evidence management with executable citations,
          ASPIC+ grounded-extension evaluation, Ludics game-theoretic evaluation,
          confidence scoring, and a cross-context transport network. It is
          reachable from any point in the social layer through a single,
          reversible upgrade action: a discussion can become a deliberation, a
          comment can become a claim, an annotation can become a proposition.
        </p>

        <h2>The spectrum: informal to formal</h2>
        <p>
          Every feature exists at a position on a continuous spectrum, and moving
          between adjacent points is a single reversible user action:
        </p>
        <ul>
          <li>
            <strong>Conversation:</strong> feed posts and comments → threaded
            discussion with topics → deliberation with typed moves and commitment
            tracking.
          </li>
          <li>
            <strong>Arguments:</strong> opinions in prose → claims with stated
            reasons → arguments instantiating recognized schemes with critical
            questions.
          </li>
          <li>
            <strong>Disagreement:</strong> replies and reactions → specific
            objections with grounds → formal challenges creating tracked
            obligations to respond.
          </li>
          <li>
            <strong>Evidence:</strong> links and anecdotes → cited sources with
            annotations → executable citations with anchor types, intent labels,
            and DOI resolution.
          </li>
          <li>
            <strong>Persistence:</strong> a feed that scrolls past → a searchable
            archive → a knowledge base with live deliberation blocks and stable
            citable references.
          </li>
          <li>
            <strong>Cross-context:</strong> cross-posting → shared references →
            transport functors with fingerprinted provenance and confidence
            gating.
          </li>
        </ul>

        <h2>The knowledge production pipeline</h2>
        <p>
          When a community&rsquo;s work moves from informal to formal, the
          platform models the trajectory as a pipeline. Informal discussion
          surfaces propositions, which are workshopped into claims and structured
          into arguments through formal schemes. Arguments are challenged through
          protocol-enforced dialogue moves; the moves accrue in commitment
          stores, which the Ludics engine analyzes for convergence and
          divergence. Those determinations feed confidence scores, which gate the
          Plexus network as arguments transport across rooms with fingerprinted
          provenance. Not every community traverses the full pipeline — it exists
          in its entirety so the infrastructure is present when the reasoning
          reaches a complexity that warrants it.
        </p>

        <h2>The reasoning engine</h2>
        <p>
          The reasoning layer implements four families of formalism: structured
          argumentation via ASPIC+ grounded extensions and the Walton taxonomy of
          schemes with auto-generated critical questions; interactive proof
          theory via Ludics designs; typed dialogue protocols with commitment
          stores; and a category-theoretic evidence algebra over typed evidence
          arrows, with a closed-monoid confidence fold over a lawful log-odds
          (weight-of-evidence) semiring and culprit-set belief revision. Evidence
          enters through a six-stage citation resolver (arXiv, Crossref, page
          metadata, OpenAlex, LLM extraction, Wayback) with four-tier confidence
          gating. The details live in{" "}
          <Link href="/docs/argument-graph">the argument graph documentation</Link>.
        </p>

        <h2>Living documents</h2>
        <p>
          Theses, briefs, and peer reviews embed claims and arguments that read
          live state from the graph, with inspectors, attack registers, auditable
          confidence cards, point-in-time snapshots, and fork/merge. A living
          document is not a frozen copy of the reasoning — it updates as the
          underlying deliberation updates.
        </p>

        <h2>Institutional pathways</h2>
        <p>
          A workflow layer carries deliberation outputs into authorized bodies
          through a verifiable institution registry, hash-chained pathway audit
          logs, versioned recommendation packets, submission channels, and
          facilitator cockpits with real-time equity surfaces.
        </p>

        <h2>The Plexus network</h2>
        <p>
          Plexus connects deliberation rooms as a graph-of-graphs across five
          typed meta-edges (shared claims, shared evidence, transported
          arguments, cross-references, institutional links). Room functors
          transport arguments while preserving inferential structure, carrying
          provenance with SHA-1 fingerprinted integrity, under three
          confidence-gating modes: logical (ASPIC+ structure), social (community
          assessment), and hybrid.
        </p>

        <h2>Principles</h2>
        <p>
          Isonomia is free, self-hostable, and ad-free. There is no behavioral
          tracking, no algorithmic ranking, and no engagement metric. Data
          ownership, privacy, and provenance are enforced by architecture, not by
          policy: the social graph is portable and exportable in open formats,
          and the reasoning graph is content-hashed and cryptographically
          auditable.
        </p>
      </PublicDocsShell>
    </>
  );
}
