import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import PublicDocsShell, { JsonLd } from "@/components/public/PublicDocsShell";

export const dynamic = "force-static";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://isonomia.app";
const REPO_URL = "https://github.com/rohan-k-mathur/mesh";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: "About Isonomia — store, cite, and check the reasoning behind a conclusion",
  description:
    "Isonomia is open-source software for storing, citing, and checking the reasoning behind a conclusion. It turns an argument into structured, verifiable data instead of prose — with provenance, the strongest objection on file, and whether it has survived challenge.",
  alternates: { canonical: `${BASE_URL}/about` },
  openGraph: {
    type: "website",
    url: `${BASE_URL}/about`,
    title: "About Isonomia",
    description:
      "Open-source software for storing, citing, and checking the reasoning behind a conclusion. It turns an argument into structured, verifiable data instead of prose.",
    siteName: "Isonomia",
  },
  twitter: {
    card: "summary_large_image",
    title: "About Isonomia",
    description:
      "Open-source infrastructure for community deliberation and structured reasoning.",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Isonomia",
  url: BASE_URL,
  description:
    "Open-source software for storing, citing, and checking the reasoning behind a conclusion. It turns an argument into structured, verifiable data — with provenance, the strongest known objection, and dialectical standing — that a person or an AI system can cite precisely and check.",
  applicationCategory: "CollaborationApplication",
  operatingSystem: "Web",
  isAccessibleForFree: true,
  keywords: [
    "deliberation",
    "structured reasoning",
    "argument mapping",
    "epistemic infrastructure",
    "democratic decision-making",
    "evidence-backed arguments",
    "community governance",
  ],
  sameAs: [REPO_URL],
};

export default function AboutPage() {
  return (
    <>
      <JsonLd data={jsonLd} />
      <PublicDocsShell
        eyebrow="About"
        title="What is Isonomia?"
        lede="Isonomia is open-source software for storing, citing, and checking the reasoning behind a conclusion. It turns an argument into structured, verifiable data instead of prose — so that a person, or increasingly an AI system, can cite it precisely, trace it to its origin, and check it, rather than re-reading and re-judging a document every time."
        cta={
          <div className="rounded-2xl border border-indigo-200/70 bg-gradient-to-br from-indigo-50 via-white to-white p-6 sm:p-8 w-full">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-600">
              Get involved
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
              Join the team
            </h2>
            <p className="mt-3 max-w-2xl leading-relaxed text-slate-600">
              Isonomia is actively looking to expand the team. If you&rsquo;re
              interested in building the infrastructure for how reasoning is
              stored, cited, and checked, we&rsquo;d love to hear from you.
            </p>
            <a
              href="mailto:rohan@isonomia.app"
              className="mt-5 inline-flex items-center gap-2 btnv2 rounded-full px-4 py-3 text-[15px] font-bold "
            >
              Email: rohan@isonomia.app
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        }
      >
        <p>
          Today the reasoning behind a decision lives buried inside documents. A
          web page mixes the claim, the evidence, the rhetoric, and a great deal
          of unstated assumption into one blob, and if you want to cite it, you
          cite the whole page. Isonomia breaks that apart. A claim or an argument
          becomes its own object with a permanent address, carrying what supports
          it, the sources behind it (fetched, timestamped, and verifiable, so the
          record holds even if the original link later rots), the strongest
          objection on file against it, and whether it has survived challenge.
        </p>

        <h2>Why this matters</h2>
        <p>
          Reasoning is the one thing software has never given a durable home. We
          store documents, messages, transactions, and code, but the inferential
          structure that connects evidence to a claim to a conclusion is thrown
          away the moment a decision is made — left to be reconstructed, badly,
          from prose every time someone asks <em>why</em>.
        </p>
        <p>
          That gap is becoming expensive at exactly the moment it is becoming
          unavoidable. AI systems are moving from answering questions to acting
          across tools, and they need a place to read and write reasoning{" "}
          <em>state</em> — what has been asserted, what supports it, what attacks
          it, what survived, and what a conclusion does not yet license — that
          lives outside any single model, where it can be inspected, versioned,
          and contested. Better models do not remove this need; they raise it,
          because the cheaper it becomes to generate a confident claim, the more
          valuable an external, accountable record of which claims have actually
          earned standing.
        </p>

        <h2>The problem it addresses</h2>
        <p>
          As language models produce a growing share of what we read, the
          bottleneck is no longer fluent text — there is effectively infinite
          fluent text now. The bottleneck is trust: can you tell where a claim
          came from, whether its source actually supports it, and what it leaves
          out? Models are good at writing about a topic and bad at keeping its
          structure straight. They flatten which point is doing the real work,
          miss objections aimed at the logic rather than the conclusion, and cite
          a page when the meaningful unit is a single sentence. Asking one model
          to grade another&rsquo;s reasoning yields a verdict that shifts with the
          wording.
        </p>
        <p>
          The academic field that studies how to represent arguments formally is
          called <strong>computational argumentation</strong>. Isonomia applies
          it to exactly this gap: it keeps the structure of reasoning outside the
          model, where the things that can be checked are checked rather than
          guessed.
        </p>

        <h2>How it works</h2>
        <p>
          The structure is captured inside the work where reasoning is already
          happening — research, document review, policy analysis — rather than
          bolted on afterward as a separate annotation chore, which is precisely
          where earlier attempts at this broke. AI can propose the first-pass
          structure; people confirm or correct it where the commitment matters;
          and the system records who authored what, so machine-generated material
          stays visibly provisional until a human ratifies it.
        </p>
        <p>
          Everything is exposed both as ordinary web pages and over the same kind
          of connection AI assistants already use to reach outside tools (the
          Model Context Protocol), so a search engine, a researcher, and an
          automated agent all read the same object. Every citation carries its
          strongest known counter-argument by default, which makes one-sided
          citation harder to do by accident.
        </p>
        <p>
          Under the hood, this rests on formally studied frameworks — ASPIC+
          grounded extensions, Walton&rsquo;s argumentation schemes with their
          critical questions, Girard&rsquo;s Ludics as an interaction semantics,
          and a category-theoretic evidence algebra that folds confidence
          lawfully in log-odds space. That complexity is invisible to anyone who
          does not seek it out; it is what lets the interface stay simple.
        </p>

        <h2>What is public, and what requires an account</h2>
        <p>
          Public arguments and claims resolve to permanent, login-free permalinks
          (<Link href="/a/">/a/&#123;shortCode&#125;</Link> and{" "}
          <Link href="/c/">/c/&#123;moid&#125;</Link>), and the corpus is a
          crawlable, machine-citable{" "}
          <Link href="/search/arguments">search surface</Link>. Each permalink is
          reachable as HTML, JSON-LD, AIF, or a compact attestation envelope, and
          an immutable, content-hash-pinned form survives future edits.
        </p>
        <p>
          Reading and citing public arguments and claims requires no account.
          Authoring — proposing arguments, filing challenges, joining rooms, and
          driving dialogue moves — does.
        </p>

        <h2>Where it leads</h2>
        <p>
          The single object is the seed of larger infrastructure, and each next
          step extends what already runs rather than pivoting away from it:
        </p>
        <ul>
          <li>
            <strong>A web of machine-citable arguments</strong> — a public corpus
            where every claim carries its support, its opposition, its
            provenance, and its standing, addressable the way papers are today.
          </li>
          <li>
            <strong>A reasoning backend an agent can call</strong> — to learn
            whether a claim has survived challenge, where a disagreement actually
            lives, and what it would have to retract to reject a conclusion, so
            an AI writer gets not just sources but a contract for what it may not
            assert and what it must hedge.
          </li>
          <li>
            <strong>A minimal-disagreement debugger</strong> — that locates the
            single point where two positions first diverge instead of declaring
            them globally opposed.
          </li>
          <li>
            <strong>A transport layer</strong> — that moves arguments between
            communities and institutions with their provenance intact, and an
            evidence algebra that folds confidence lawfully rather than as an
            opaque score.
          </li>
        </ul>
        <p>
          The compounding asset is not any one feature but the accumulating graph
          of reasoning itself.
        </p>

        <h2>Who it&rsquo;s for</h2>
        <p>
          The value concentrates wherever the reasoning behind a decision matters
          as much as the decision itself and has to survive scrutiny later:
          research groups, peer review, policy and regulatory analysis, and the
          teams evaluating AI systems. Alongside those, AI tools themselves are a
          natural user — a model consuming structured arguments as a citation
          source does not tire of structure the way a human volunteer does, and
          an agent that writes back into the graph extends a shared record rather
          than spending its work into prose that scrolls past. A broad public
          version is the long-term upside, not the starting point.
        </p>

        <h2>Open source, self-hostable, and yours</h2>
        <p>
          Isonomia is free, open-source, and self-hostable. There is no
          behavioral tracking, no algorithmic ranking, and no engagement metric.
          The communities that produce the reasoning own it and can carry it out
          in open formats; the reasoning graph is content-hashed and
          cryptographically auditable, so provenance is enforced by architecture,
          not policy. The project is sustained by grants, institutional
          partnerships, and optional managed hosting — never by advertising or by
          selling data. Source lives on <a href={REPO_URL}>GitHub</a>; see the{" "}
          <Link href="/docs/privacy">privacy documentation</Link> for details.
        </p>

        <h2>Learn more</h2>
        <ul>
          <li>
            <Link href="/docs/architecture">Architecture</Link> — the social
            layer, reasoning layer, and how they fit together.
          </li>
          <li>
            <Link href="/docs/argument-graph">Argument graph</Link> — claims,
            arguments, critical questions, challenges, citations, and confidence.
          </li>
          <li>
            <Link href="/docs/chrome-extension">Browser extension</Link> — create
            evidence-backed arguments from any webpage.
          </li>
          <li>
            <Link href="/docs/self-hosting">Self-hosting</Link> — deploy and
            operate your own instance.
          </li>
        </ul>
      </PublicDocsShell>
    </>
  );
}
