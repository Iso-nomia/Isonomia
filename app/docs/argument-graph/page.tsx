import type { Metadata } from "next";
import Link from "next/link";
import PublicDocsShell, { JsonLd } from "@/components/public/PublicDocsShell";

export const dynamic = "force-static";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://isonomia.app";
const PATH = "/docs/argument-graph";

export const metadata: Metadata = {
  title: "Argument graph",
  description:
    "The argument graph is where Isonomia stores the reasoning behind a conclusion as data: claims, arguments, argumentation schemes and critical questions, challenges, executable citations, confidence, and machine-citable permalinks exposed over HTTP and the Model Context Protocol.",
  alternates: { canonical: `${BASE_URL}${PATH}` },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "TechArticle",
  headline: "The Isonomia argument graph",
  description:
    "Claims, arguments, critical questions, challenges, citations, confidence, and machine-citable permalinks.",
  url: `${BASE_URL}${PATH}`,
  isPartOf: { "@type": "WebSite", name: "Isonomia", url: BASE_URL },
  author: { "@type": "Organization", name: "Isonomia" },
  publisher: { "@type": "Organization", name: "Isonomia" },
  inLanguage: "en",
};

export default function ArgumentGraphPage() {
  return (
    <>
      <JsonLd data={jsonLd} />
      <PublicDocsShell
        eyebrow="Docs"
        title="The argument graph"
        lede="The argument graph is where Isonomia stores the reasoning behind a conclusion as data rather than prose. Every public argument is exposed as a machine-citable epistemic primitive: a content-hashed, dialectically attested structured argument with end-to-end provenance, served over content-negotiated HTTP and a bidirectional Model Context Protocol surface."
      >
        <p>
          Instead of citing a whole page that mixes the claim, the evidence, the
          rhetoric, and a great deal of unstated assumption, you cite a single
          object that carries what supports it, the sources behind it, the
          strongest objection on file against it, and whether it has survived
          challenge. The pieces below are what that object is made of.
        </p>

        <h2>Claims</h2>
        <p>
          A claim is an addressable object with a stable identifier, version
          history, and authorship attribution. A claim has a status: proposed,
          accepted, challenged, defended, retracted, or resolved. Public claims
          resolve to a permalink at{" "}
          <Link href="/c/">/c/&#123;moid&#125;</Link>.
        </p>

        <h2>Arguments</h2>
        <p>
          An argument binds a set of premises to a single conclusion, where each
          premise and the conclusion are themselves claims. Premises are typed
          (ordinary, assumption, exception) and may be flagged implicit or
          axiomatic; an enthymematic inference carries an explicit warrant. Public
          arguments resolve to a permalink at{" "}
          <Link href="/a/">/a/&#123;shortCode&#125;</Link>, and an immutable,
          content-hash-pinned form at{" "}
          <code>/a/&#123;shortCode&#125;@&#123;sha256&#125;</code>.
        </p>

        <h2>Schemes and critical questions</h2>
        <p>
          Each argument is classified by one or more schemes from the Walton
          taxonomy — Argument from Expert Opinion, Analogy, Sign, Cause to
          Effect, and others. Classification is many-to-many. A scheme is two
          things: a defined structure (premises, conclusion, inference rule) and a
          set of auto-generated critical questions marking where the argument can
          fail. A scheme&rsquo;s identity <em>is</em> its critical questions: two
          schemes are identical when they withstand the same questions. An
          argument has full standing when it answers every critical question left
          open against it.
        </p>

        <h2>Challenges</h2>
        <p>
          An answered critical question is not closed for good. Any participant —
          or a Model Context Protocol agent — can challenge a satisfied critical
          question, naming the objection type explicitly: a rebuttal of the
          answer&rsquo;s conclusion, an undermining of its cited evidence, or an
          undercut that concedes the answer but denies it resolves the question.
          An admissible challenge materializes a scheme-free objection claim, a
          typed attack edge, and a provenance row, and flips the critical question
          from satisfied to disputed the moment it is filed. Challenges are
          admissibility-gated, not defeat-gated: the canonical answer stays
          canonical while a contester is on file. AI and human challengers face
          the identical bar; only disclosure differs.
        </p>

        <h2>Dialogue moves and commitment stores</h2>
        <p>
          Dialogue moves are typed speech acts governed by protocol: Assert,
          Challenge, Defend, Concede, Retract, Request Clarification, and others.
          Each move creates obligations and permissions for subsequent moves, so a
          challenge cannot be silently ignored — an unanswered challenge is itself
          a recorded datum. Commitment stores track what each participant has
          asserted, conceded, retracted, and is currently committed to, and flag
          contradictions.
        </p>

        <h2>Executable citations and evidence</h2>
        <p>
          Citations link evidence to arguments with four anchor types (page,
          passage, figure, section) and intent labels (supports, challenges,
          provides context, provides evidence, qualifies, extends). A six-stage
          auto-citation resolver runs a waterfall — arXiv, Crossref, page metadata
          (Highwire / Dublin Core / OpenGraph), OpenAlex, LLM extraction, and
          Internet Archive (Wayback) — and assigns each resolution a confidence
          tier: high, medium, low, or none. Evidence carries server-side fetch
          hashes and Wayback snapshots, so cited sources stay addressable even if
          the live URL rots.
        </p>

        <h2>Confidence</h2>
        <p>
          Confidence is computed by a category-theoretic evidence algebra over
          typed evidence arrows. A closed monoid folds confidence over the arrow;
          three monoids are registered: log-odds (the default weight-of-evidence
          semiring), minimum (the skeptical weakest-link projection), and product
          (legacy noisy-OR, deprecated). Culprit-set computation answers the
          canonical question: <em>what would I have to retract to reject this
          claim?</em>
        </p>

        <h2>Standing and dialectical honesty</h2>
        <p>
          Standing is reported as a classified state — untested-default,
          untested-supported, tested-attacked, tested-undermined, tested-survived
          — never as an opaque float. Standing is always <em>relative</em>: a
          <code>tested-survived</code> label means an argument has withstood the
          specific challenges actually mounted against it, not that it is true.
          Citations ship with their strongest known objection attached by default.
        </p>

        <h2>Machine-citable surfaces</h2>
        <p>
          Content negotiation on a permalink returns the same artifact in
          different shapes:
        </p>
        <ul>
          <li>
            <strong>HTML:</strong> <code>GET /a/&#123;shortCode&#125;</code>
          </li>
          <li>
            <strong>AIF / JSON:</strong> the same URL with{" "}
            <code>Accept: application/json</code>, or{" "}
            <code>/api/a/&#123;shortCode&#125;/aif?format=aif</code>
          </li>
          <li>
            <strong>Rich JSON-LD</strong> (Claim + ScholarlyArticle + ClaimReview
            + AIF): <code>Accept: application/ld+json</code>
          </li>
          <li>
            <strong>Attestation envelope:</strong>{" "}
            <code>/api/a/&#123;shortCode&#125;/aif?format=attestation</code>
          </li>
        </ul>
        <p>
          The corpus is searchable at{" "}
          <Link href="/search/arguments">/search/arguments</Link> (human) and{" "}
          <code>/api/v3/search/arguments</code> (JSON), which fuses dense and
          sparse retrieval and attaches the strongest known counter to every
          result by default.
        </p>

        <h2>Model Context Protocol</h2>
        <p>
          A bidirectional MCP surface exposes read tools (search arguments, get
          argument, get claim, find counterarguments, cite argument, claim
          stances, resolve citations, deliberation-scope readouts) and write tools
          (propose argument, propose structured argument, propose argument chain,
          propose warrant, answer critical question, challenge critical question,
          attack argument, post dialogue move). AI-authored writes are flagged
          <code>authorKind: &quot;AI&quot;</code> and gated on human ratification
          for logicality. See{" "}
          <a href="/.well-known/llms.txt">/.well-known/llms.txt</a> and{" "}
          <a href="/.well-known/argument-graph">/.well-known/argument-graph</a>{" "}
          for the machine-readable contract.
        </p>

        <h2>Standards</h2>
        <ul>
          <li>AIF — the Argument Interchange Format</li>
          <li>Schema.org — <code>Claim</code>, <code>ScholarlyArticle</code>, <code>ClaimReview</code></li>
          <li>JSON-LD 1.1</li>
          <li>
            OpenAPI 3.1 —{" "}
            <a href="/api/v3/openapi.json">/api/v3/openapi.json</a>
          </li>
          <li>
            Model Context Protocol —{" "}
            <a href="https://modelcontextprotocol.io">modelcontextprotocol.io</a>
          </li>
        </ul>
      </PublicDocsShell>
    </>
  );
}
