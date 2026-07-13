# Isonomia

**Epistemic infrastructure for distributed knowledge production.**

Isonomia is an open-source platform for community gathering and structured reasoning. It unifies a general-purpose social platform with a formal deliberation engine under a single data model, so that any conversation can be upgraded to a tracked deliberation through a single reversible action, and every resulting claim, argument, and deliberation is addressable, citable, challengeable, and durable.

The social layer is complete as a standalone platform: a chronological feed with eight post types, profiles and follows, persistent rooms and lounges, spatial canvas environments, sheaf-based layered messaging with drifts, proposals and polls, a long-form article system with anchored comments and rhetoric overlays, and shared document libraries.

The reasoning layer sits beside it and implements four families of formalism: structured argumentation via ASPIC+ grounded extensions and the Walton taxonomy of schemes with auto-generated critical questions; interactive proof theory via Ludics designs, with a generative substrate of witnessing records, articulation lattices, and fossil retractions; typed dialogue protocols with commitment stores; and a category-theoretic evidence algebra over typed evidence arrows, with closed-monoid confidence folding over a lawful log-odds (weight-of-evidence) semiring and culprit-set belief revision. Evidence enters through a six-stage citation resolver (arXiv, Crossref, page metadata, OpenAlex, LLM extraction, Wayback) with four-tier confidence gating.

The argument graph is exposed as a machine-citable epistemic primitive. Every permalink resolves to a content-hashed, dialectically attested structured argument with end-to-end provenance, served over content-negotiated HTTP (HTML, JSON-LD, AIF, social cards, oEmbed, iframe embeds) and over a bidirectional Model Context Protocol surface with read tools for arguments, counters, stances, and citations, and write tools that propose arguments, chains, warrants, answers to critical questions, and challenges to answered critical questions, that file typed attacks and drive the protocol dialogue moves (challenge, ground, concede, retract) from a declared dialogical side, while flagging AI authorship honestly and gating logicality on human ratification. A public search surface fuses dense and sparse retrieval through reciprocal rank fusion, attaches the strongest known counter to every result by default, and surfaces empty states explicitly instead of collapsing them.

Three further layers ride on this substrate. Living documents (theses, briefs, peer reviews) embed claims and arguments that read live from the graph, with inspectors, attack registers, auditable confidence cards, snapshots, and fork/merge. An institutional workflow layer carries deliberation outputs into authorized bodies through a verifiable institution registry, hash-chained pathway audit logs, recommendation packets, and facilitator cockpits with real-time equity surfaces. The Plexus network connects deliberation rooms as a graph-of-graphs across five typed meta-edges, with SHA-1 fingerprinted one-hop room functors and three confidence-gating modes (logical, social, hybrid).

Isonomia is free, self-hostable, and ad-free. Data ownership, privacy, and provenance are enforced by architecture: the social graph is portable and exportable in open formats, and the reasoning graph is content-hashed and cryptographically auditable.

### The Deliberation Engine

The core formal system. When a discussion is upgraded to a deliberation, the following infrastructure becomes available:

**Claims** are addressable objects with stable identifiers, version history, and authorship attribution. A claim can be in one of several statuses: proposed, accepted, challenged, defended, retracted, or resolved.

**Arguments** are objects that bind a set of premises to a single conclusion. Each premise and the conclusion are themselves 'Claim' objects. Premises are typed (ordinary, assumption, exception) and may be flagged implicit or axiomatic; an enthymematic inference carries an explicit warrant.

Each argument is classified by one or more **schemes** from the core of the Walton taxonomy — Argument from Expert Opinion, Analogy, Sign, Cause to Effect, and others. Classification is many-to-many: an argument can instantiate several schemes at once, each with its own confidence, role (primary, supporting, presupposed, implicit), and rule type (strict or defeasible), and sequential schemes compose into a net for multi-step reasoning. A scheme is two things: a defined structure (premises, conclusion, inference rule) and a set of auto-generated critical questions marking where the argument can fail.

A scheme's identity is its critical questions. Two schemes are identical when they withstand the same questions, so differently-worded presentations of one pattern resolve to a single scheme. Each critical question is a position an opponent may occupy. An argument has full standing when it answers every position left open against it.

An answered critical question is not closed for good. Any participant (or model-context agent) can **challenge** a satisfied critical question, naming the kind of objection explicitly — a rebuttal of the answer's conclusion, an undermining of its cited evidence, or an undercut that concedes the answer but denies it resolves the question. An admissible challenge materializes a scheme-free objection claim, a typed attack edge, and a provenance row, and flips the critical question from satisfied to **disputed** the moment it is filed — admissibility-gated, not defeat-gated, so the canonical answer stays canonical while a contester is on file. The admissibility bar is a property of the question and the attack type, never of who is filing: undermining cited evidence always requires evidence, and a question whose burden of proof rests on the challenger requires it too. AI and human challengers face the identical bar; what differs is only disclosure — an answer self-asserted by an AI agent surfaces an "answered by an AI agent" line and a louder invitation to contest it. Because a challenge claim is itself scheme-free it carries no critical questions of its own, so disputes fan out across many challenges on one question rather than nesting without bound; depth appears only through an explicit escalation to a structured counter-argument. The question returns to satisfied through any of its named exits.

**Dialogue Moves** are typed speech acts governed by protocol: Assert, Challenge, Defend, Concede, Retract, Request Clarification, and others. Each move creates specific obligations and permissions for the moves that follow it. The protocol ensures that challenges cannot be silently ignored: an unanswered challenge is itself a recorded datum.

**Commitment Stores** track what each participant has asserted, conceded, retracted, and is currently committed to. The store monitors consistency: if a participant's commitments contradict each other, the contradiction is flagged; if a commitment is retracted, the downstream arguments that depended on it are identified.

**Argument Chains** organize arguments into sequential or branching structures. Chains can be rendered in multiple views: list (linear sequence), thread (branching tree), canvas (spatial graph), brief (legal-style structured document), and auto-generated essay (prose narrative derived from the argument structure). Chains are authorable by hand and by model-context-protocol agents through `propose_argument_chain`: the conclusion claim of each link is reused as a premise of the next, so the chain is a genuine shared-claim spine in the argument graph instead of a sequence of disconnected arguments, and the engine reports the chain's weakest link so an inference is only as strong as its most exposed step.

**The Deliberation Dictionary** allows key terms to be formally defined, contested, and versioned within a deliberation. When a dispute turns on the meaning of a term, the term is entered in the dictionary with its proposed definition; the definition itself then becomes available for challenge and refinement through the same dialogue protocol.

**ASPIC+ Evaluation.** The platform computes grounded extensions (the maximal sets of mutually consistent arguments that can be simultaneously defended) using the ASPIC+ framework for structured argumentation. This provides a formal determination of which arguments survive challenge given the current state of the deliberation.

**Ludics Evaluation.** The entire deliberation can be modeled as an interactive game between Proponent and Opponent designs under Girard's Ludics semantics. Strategic landscapes can be heat-mapped to identify decisive positions (where the game is determined), turning positions (where a single move changes the outcome), and bottleneck positions (where progress depends on resolving a specific sub-argument).

### Stacks and Evidence Library

Document management integrated with the deliberation engine.

**Document Storage.** Upload, organize, and share PDFs, papers, reports, and other source materials. Documents are stored in Stacks: themed collections that can be shared across rooms or kept private.

**Executable Citations.** Four anchor types for linking evidence to arguments: page-level, passage-level, figure-level, and section-level. Each citation is executable: clicking it navigates to the exact location in the source document. Citations carry intent labels: supports, challenges, provides context, provides evidence, qualifies, or extends.

**Annotation and Promotion.** Source documents can be annotated in the library. Annotations are conversations: threaded discussions attached to specific passages. Any annotation can be promoted into the deliberation graph: a marginal note becomes a proposition, which can be workshopped into a claim, which can be structured into an argument.

**Knowledge Graph.** Sources, claims, arguments, and deliberations are connected in a navigable knowledge graph. Cross-deliberation source discovery identifies cases where the same document has been cited in multiple contexts, enabling communities to find related reasoning.

**Auto-Citation Engine.** Any URL or DOI pasted into the citation composer is resolved automatically into a verified bibliographic record, with no manual entry of title, authors, or year.

The resolver runs a waterfall in priority order:

1. **arXiv API** for preprints.
2. **Crossref** for DOIs, detected directly in the URL or surfaced by page scraping.
3. **Highwire / Dublin Core / OpenGraph metadata** for academic pages.
4. **OpenAlex** enrichment for abstracts and Open Access PDFs.
5. **GPT-4o-mini extraction** as a low-confidence fallback for pages with no structured metadata.
6. **Internet Archive (Wayback)** as a last-ditch lookup for unreachable URLs.

Successful resolutions are also enriched with a stable Wayback snapshot when one exists, so the cited evidence remains addressable even if the live URL rots.

Each resolution carries an explicit confidence tier: **high** (Crossref or arXiv canonical record), **medium** (page metadata only), **low** (LLM-extracted; flagged in the UI for verification), or **none** (URL kept as-is, retried after 24h). AI-authored arguments with empirical schemes are gated on having at least one non-`none` citation.

Bulk paste of up to 200 URLs into the New Library modal resolves in the background and hydrates citation chips as results arrive. Per-host rate limits, circuit breakers, polite-pool compliance for Crossref and OpenAlex, and a 30-day success / 24-hour failure cache keep the engine well-behaved against external services.

### The Article System

A full-featured publishing system integrated with the social and reasoning layers.

**Editor.** Rich text editing powered by TipTap with custom nodes (image, pull-quote, callout, KaTeX math block, code, embed, deliberation block) and a slash-command menu for fast block insertion. An advanced toolbar exposes the full formatting surface; paste sanitization safely handles content from external sources; a 20,000-character limit is tracked live.

**Templates.** Three article templates govern layout and reader chrome: **Standard** (clean minimal layout for most articles), **Feature** (magazine-style with hero image and large title), and **Interview** (Q&A format with speaker attribution).

**Publishing Workflow.** Draft → Published with metadata generation, autosave, revision history with version comparison, and a full Articles dashboard supporting search, filter, trash, and CRUD. Hero-image upload with cropping. Articles can be published to user profiles, rooms, or the platform's public knowledge base; published articles surface in the platform feed and render through template-specific reader layouts with cards, preview modals, and social actions (like, save, share).

**Anchored Comments.** Comment threads attach to specific passages in the article, with collision resolution when multiple comment threads target overlapping text ranges. A sidebar comment rail surfaces all threads in document order. Readers engage with the article at the level of the sentence, not the page.

**Rhetoric Analysis Overlays.** Visual overlays that surface the article's persuasive strategies (hedges, intensifiers, absolutes, analogies, metaphors), color-coded inline so readers and authors can see the rhetorical architecture beneath the prose alongside claim density, evidence distribution, and argument structure indicators.

**Proposition Composer.** Annotations and comments can be promoted directly into the deliberation engine through a composition interface that guides the user from informal observation to structured claim. The deliberation panel embeds the full deliberation system inside the article reader.

## Tech stack

- **Frontend** — Next.js 14 (App Router), React 18, TypeScript, Tailwind
- **Backend** — Node 18, Prisma, PostgreSQL, Redis
- **Workers** — BullMQ background jobs (confidence decay, re-embedding, source
  verification, knowledge-graph build)
- **ML services** — Python 3.11 microservices (embedding, ranking, explanation)
- **Formal core** — TypeScript engines with Agda mechanisations of key results

## Repository layout

```
app/          Next.js App Router routes and API handlers (app/api/**/route.ts)
components/    React UI
lib/           Domain logic by subsystem (aspic/, ludics/, dialogue/, aif/, …)
packages/      Workspaces (@app/sheaf-acl, ludics-core, aif-core, dialogue, …)
workers/       Background jobs
services/      Python microservices
RESEARCH_PROGRAMME/  Agda mechanisations and formal notes
```

## Getting started

Requires Node 18+ and a PostgreSQL database.

```bash
yarn install            # installs deps; builds @app/sheaf-acl workspace
cp .env.example .env    # fill in your own values
yarn dev                # Next dev server
```

Common scripts:

```bash
yarn build              # production build
yarn lint               # next lint
yarn test               # jest unit tests
yarn worker             # start background workers
```

The Prisma schema lives at `lib/models/schema.prisma`; apply it with
`npx prisma db push`.

## License

Released under the [MIT License](LICENSE).
