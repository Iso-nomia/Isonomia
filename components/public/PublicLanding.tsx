import Link from "next/link";
import { ArrowRight } from "lucide-react";
import PublicDocsShell, { JsonLd } from "@/components/public/PublicDocsShell";
import ContactForm from "@/components/public/ContactForm";

/**
 * Public marketing landing rendered at `/` for logged-out visitors (the
 * homepage shows the feed for authed users). Crawlable, login-free, and
 * compelling — the first thing a person or an LLM sees.
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://isonomia.app";
const REPO_URL = "https://github.com/rohan-k-mathur/mesh";

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
    "evidence-backed arguments",
    "computational argumentation",
  ],
  sameAs: [REPO_URL],
};

export default function PublicLanding() {
  return (
    <>
      <JsonLd data={jsonLd} />
      <PublicDocsShell
        eyebrow="Isonomia"
        title="Store, cite, and check the reasoning behind a conclusion."
        lede="Isonomia is open-source software that turns an argument into structured, verifiable data instead of prose — so that a person, or increasingly an AI system, can cite it precisely, trace it to its origin, and check it, rather than re-reading and re-judging a document every time."
        cta={
          <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50 via-white to-white p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">
              Early access
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
              This is an early-stage platform
            </h2>
            <p className="mt-3 max-w-2xl leading-relaxed text-slate-600">
              Isonomia is under active development and still taking shape. If
              the idea resonates — whether you want to use it, build on it,
              research with it, or help build it — we&rsquo;d genuinely like to
              hear from you. Get in touch below.
            </p>
            <div className="mt-6 border-t border-amber-200/70 pt-6">
              <ContactForm />
            </div>
          </div>
        }
      >
        <div className="flex flex-wrap gap-4">
          <Link
            href="/about"
            className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium  no-underline btnv2"
          >
            Read the overview
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/search/arguments"
            className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium  no-underline btnv2"
          >
            Explore public arguments
          </Link>
           <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium  no-underline btnv2"
          >
            Sign in to your account
          </Link>
        </div>

        <h2>Deliberation as a hypergraph</h2>
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

        <h2>Why it exists</h2>
        <p>
          Reasoning is the one thing software has never given a durable home. We
          store documents, messages, transactions, and code, but the inferential
          structure that connects evidence to a claim to a conclusion is thrown
          away the moment a decision is made. That gap is becoming expensive at
          exactly the moment it is becoming unavoidable: AI systems increasingly
          need a place to read and write reasoning <em>state</em> — what has been
          asserted, what supports it, what attacks it, what survived, and what a
          conclusion does not yet license — outside any single model, where it
          can be inspected, versioned, and contested.
        </p>

        <h2>How it works</h2>
        <p>
          Structure is captured inside the work where reasoning already happens —
          research, document review, policy analysis — rather than bolted on
          afterward. AI can propose the first-pass structure; people confirm or
          correct it where the commitment matters; and the system records who
          authored what, so machine-generated material stays visibly provisional
          until a human ratifies it. Everything is exposed both as ordinary web
          pages and over the Model Context Protocol, so a search engine, a
          researcher, and an automated agent all read the same object — and every
          citation carries its strongest known counter-argument by default.
        </p>

        <h2>Who it&rsquo;s for</h2>
        <p>
          The value concentrates wherever the reasoning behind a decision matters
          as much as the decision itself and has to survive scrutiny later:
          research groups, peer review, policy and regulatory analysis, and the
          teams evaluating AI systems — alongside AI tools themselves, which
          consume structured arguments as a citation source and write back into a
          shared record instead of spending their work into prose that scrolls
          past.
        </p>

        <p>
          Want the full picture? Read the{" "}
          <Link href="/about">overview</Link>, the{" "}
          <Link href="/docs/architecture">architecture</Link>, and how the{" "}
          <Link href="/docs/argument-graph">argument graph</Link> works. Isonomia
          is free, open-source, and self-hostable — no behavioral tracking, no
          ads, no engagement ranking. Source lives on{" "}
          <a href={REPO_URL}>GitHub</a>.
        </p>
      </PublicDocsShell>
    </>
  );
}
