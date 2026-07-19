# Isonomia

## Overview

Isonomia is open-source infrastructure for community gathering and structured reasoning. It unifies a general-purpose social platform with a formal deliberation engine under a single data model, so that any conversation can be upgraded to a tracked deliberation through a single reversible action, and every resulting claim, argument, and deliberation is addressable, citable, challengeable, and durable.

The social layer is complete as a standalone platform: a chronological feed with eight post types, profiles and follows, persistent rooms and lounges, spatial canvas environments, sheaf-based layered messaging with drifts, proposals and polls, a long-form article system with anchored comments and rhetoric overlays, and shared document libraries. 

The reasoning layer sits beside it and implements four families of formalism: structured argumentation via ASPIC+ grounded extensions and the Walton taxonomy of schemes with auto-generated critical questions; interactive proof theory via Ludics designs, with a generative substrate of witnessing records, articulation lattices, and fossil retractions; typed dialogue protocols with commitment stores; and a category-theoretic evidence algebra over typed evidence arrows, with closed-monoid confidence folding over a lawful log-odds (weight-of-evidence) semiring and culprit-set belief revision. Evidence enters through a six-stage citation resolver (arXiv, Crossref, page metadata, OpenAlex, LLM extraction, Wayback) with four-tier confidence gating.

The argument graph is exposed as a machine-citable epistemic primitive. Every permalink resolves to a content-hashed, dialectically attested structured argument with end-to-end provenance, served over content-negotiated HTTP (HTML, JSON-LD, AIF, social cards, oEmbed, iframe embeds) and over a bidirectional Model Context Protocol surface with read tools for arguments, counters, stances, and citations, and write tools that propose arguments, chains, warrants, answers to critical questions, and challenges to answered critical questions, that file typed attacks and drive the protocol dialogue moves (challenge, ground, concede, retract) from a declared dialogical side, while flagging AI authorship honestly and gating logicality on human ratification. A public search surface fuses dense and sparse retrieval through reciprocal rank fusion, attaches the strongest known counter to every result by default, and surfaces empty states explicitly instead of collapsing them.

Three further layers ride on this substrate. Living documents (theses, briefs, peer reviews) embed claims and arguments that read live from the graph, with inspectors, attack registers, auditable confidence cards, snapshots, and fork/merge. An institutional workflow layer carries deliberation outputs into authorized bodies through a verifiable institution registry, hash-chained pathway audit logs, recommendation packets, and facilitator cockpits with real-time equity surfaces. The Plexus network connects deliberation rooms as a graph-of-graphs across five typed meta-edges, with SHA-1 fingerprinted one-hop room functors and three confidence-gating modes (logical, social, hybrid).

Isonomia is free, self-hostable, and ad-free. There is no behavioral tracking, no algorithmic ranking, and no engagement metric. Data ownership, privacy, and provenance are enforced by architecture, not by policy: the social graph is portable and exportable in open formats, and the reasoning graph is content-hashed and cryptographically auditable. The system is sustained by grants, institutional partnerships, and optional managed hosting. Its thesis is that the inferential structure connecting evidence to claims to conclusions deserves first-class infrastructure, and that such infrastructure can sit beneath an interface ordinary communities will actually use.

---

## I. Architecture

### The Two Layers

**The Social Layer (MESH)** provides the features of a general-purpose community platform: a chronological feed with multiple post types, direct and group messaging, persistent rooms and lounges, user profiles with friend and follow systems, shared document libraries, long-form article publishing, and spatial canvas environments. This layer is complete and functional as a standalone social platform. It requires no engagement with the reasoning layer.

**The Reasoning Layer (Isonomia)** provides formal deliberation infrastructure: argumentation schemes with auto-generated critical questions, typed dialogue moves with protocol enforcement, commitment stores, evidence management with executable citations, Ludics game-theoretic evaluation, confidence scoring, and a cross-context transport network. This layer is accessible from any point in the social layer through a single upgrade action (a discussion can become a deliberation, a comment can become a claim, an annotation can become a proposition), and the transition is reversible.

### The Spectrum

Every feature on the platform exists at a position on a continuous spectrum from informal to formal:

**Conversation.** Feed posts and comments (informal) → threaded discussion with topics (structured) → deliberation with typed moves and commitment tracking (formal).

**Arguments.** Opinions stated in prose (informal) → claims with stated reasons (structured) → arguments instantiating recognized schemes with critical questions (formal).

**Disagreement.** Replies and reactions (informal) → specific objections with stated grounds (structured) → formal challenges creating tracked obligations to respond (formal).

**Evidence.** Links and anecdotes (informal) → cited sources with annotations (structured) → executable citations with four anchor types, intent labeling, and DOI resolution (formal).

**Persistence.** Feed that scrolls past (informal) → searchable archive (structured) → knowledge base with live deliberation blocks and stable citable references (formal).

**Cross-context.** Cross-posting (informal) → shared references (structured) → transport functors with SHA-1 fingerprinted provenance and confidence gating (formal).

The transition between any two adjacent points on the spectrum is a single user action. No transition requires specialized knowledge. No transition is irreversible. Communities move along the spectrum as their needs dictate, and the platform supports every position with a consistent interface.

### The Knowledge Production Pipeline

When a community's work moves from informal to formal, the platform models the trajectory as a pipeline:

Informal discussion surfaces propositions, which are workshopped into claims and structured into arguments through formal schemes. Arguments are challenged through protocol-enforced dialogue moves; the moves accrue in commitment stores, which the Ludics engine analyzes for convergence and divergence. Those determinations feed confidence scores, which in turn gate the Plexus network: room functors transport arguments across rooms with fingerprinted provenance. At every stage, the reasoning is addressable, citable, challengeable, and durable.

Not every community will traverse the full pipeline. Most will operate at the early stages most of the time. The pipeline exists in its entirety so that the infrastructure is present when the community's reasoning reaches a point of complexity that warrants it.

### Floor and Ceiling

Orthogonal to the informal–formal spectrum, the reasoning layer's work runs in two directions, and the platform surfaces each explicitly.

**The floor is eliminative** — machinery for rooting out and correcting errors in evidence and argumentation. It can only reject: typed attacks (rebut, undercut, undermine), critical-question challenges, the ratification gate on the attack→defeat seam, the refusal surface naming conclusions the graph cannot license, and the standing ladder that upgrades material only by surviving challenge. Deliberation is its social form — agonistic, equal standing to contest.

**The ceiling is ampliative** — machinery for collaborative construction. It can only build: structured arguments, warrants, inference chains, syntheses. Its orienting object is the **opportunity frontier**, the refusal surface's constructive complement: the work the graph invites, as typed tasks — open critical questions awaiting a first answer, topic-typical schemes no argument yet instantiates, unattacked off-path arguments to chain in, parallel conclusions to synthesize — ranked by how load-bearing the target material is. The construction tools are gathered into a single **symposium** surface (for agents, a dedicated tool cluster with its own orientation loop: read the frontier, dispatch by task kind), and constructions drafted by agents land pending until a participant **adopts** them — the same ratification act that gates attacks, here read as commitment adoption: a person undertakes the construction as their own assertion, reviewable in a deliberation-wide adoption queue. The symposium is deliberation's associative face — equal standing to co-author.

The two directions interlock rather than merely coexist. Construction may run ahead of verification — bold building on contested material is legitimate — but floor verdicts flow into constructions automatically through weakest-link standing, so a construction is only ever as trustworthy as the floor beneath it. Adopted material remains fully contestable: adoption records who undertakes a construction, and settles nothing.

---

## II. The Social Layer

### Feed and Posts

The main feed is chronological: content appears in the order it was posted by the people and communities the user follows. There is no algorithmic ranking, no engagement optimization, no promoted content, and no "suggested" posts from accounts the user did not choose to follow.

The platform supports eight post types:

- **Text** — plain text posts.
- **Image** — image uploads.
- **Audio** — audio player embed.
- **Gallery** — multi-image carousel.
- **Article** — long-form writing.
- **Library** — PDF stacks and collections.
- **Thread** — threaded discussion.
- **Document** — PDF/document embed.

Post creation uses a composer UI with a type selector and dedicated creation modals for each type. Posts support upvotes/downvotes, comments, sharing, timestamping, and deletion.

### Profiles and Social

User profiles with customizable display. Friend and follow systems. Notification pipeline for social actions, messages, challenges, and deliberation events. User discovery by interest, community membership, and group affiliation.

The social graph is owned by the user: exportable in open formats, portable, never sold or monetized. Discovery is through search and affiliation, not through algorithmic recommendation.

### Rooms and Lounges

Persistent spaces for communities, groups, projects, and organizations. Rooms are the primary organizational unit of the platform: each room has its own feed, discussions, shared library, member management, and (when the community is ready) its own deliberation space.

**Lounges** are lighter-weight social spaces (open or invite-only) for casual gathering, conversation, and ambient connection.

**Spatial Canvas Rooms** allow freeform arrangement of content (posts, images, documents, links, embeds) in a two-dimensional navigable space. The canvas can be collaboratively edited and annotated. Canvas rooms serve as visual workspaces, mood boards, reference collections, and spatial brainstorming environments.

Rooms and lounges are governed by their members. The platform provides infrastructure; the community provides governance. Moderation controls are local to the room.

### Messaging

Real-time messaging with direct messages, group conversations, and room-level chat.

**Message Layers.** The messaging system implements sheaf-based access control: each conversation has explicitly defined audience layers, each with its own sharing policy that determines what is visible to whom. The stratified communication that users already practice informally (what is public, what is group-only, what is private) is handled architecturally through defined layers instead of being left to the uncertainty of informal norms.

**Drifts.** Side conversations that branch from any anchor message, creating a threaded sub-conversation that preserves context from the parent message without disrupting the main flow.

**Proposals.** Collaborative documents embedded in conversations, with approval workflows and merge mechanics. A group member drafts a proposal; others review, comment, suggest changes, and approve or request modifications. The proposal workflow integrates with the room's governance structure.

**Polls.** Inline polls with two modes: multi-choice (select one or more options) and temperature check (gauge group sentiment on a spectrum). Polls can be embedded in any conversation.

**Read Receipts and Acknowledgments.** Optional and transparent. Message forwarding with access-control validation: the platform checks whether the forwarding target has permission to see the forwarded content before allowing the forward.

---

## III. The Reasoning Layer

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

### The Discussion System

The lightweight informal layer: forums, topic-based conversations, and loose exchanges. The discussion system is the most common entry point for community interaction and the starting point of the knowledge production pipeline.

**Upgrade Paths.** Any discussion can be upgraded to a structured deliberation when the conversation warrants it. The upgrade preserves the discussion's content and participants while adding the formal infrastructure of the deliberation engine. The upgrade is a single action. It does not require the participants to have prior experience with the formal tools.

### The Knowledge Base

The durable, public-facing output of the reasoning process.

**Publishable Pages.** Knowledge base pages combine prose narrative with live deliberation blocks: embedded views of argument graphs, claim statuses, confidence scores, and evidence summaries that reflect the current state of the underlying deliberation. The pages are stable and citable: each has a permanent URL and a versioned reference.

**Live Deliberation Blocks.** Embedded components that render the current state of a deliberation within a knowledge base page. If the underlying deliberation is updated (new evidence, new challenges, revised confidence scores), the blocks update accordingly. The knowledge base is not a snapshot. It is a live view.

### The Plexus Network

The cross-context layer that connects deliberation rooms into a network.

**Graph-of-Graphs.** The Plexus network visualizes the relationships between deliberation rooms as a meta-graph. Rooms are nodes. The connections between them are typed edges.

**Five Meta-Edge Types:**

1. **Shared Claims** — two rooms contain arguments about the same claim.
2. **Shared Evidence** — two rooms cite the same source material.
3. **Transported Arguments** — an argument from one room has been imported into another.
4. **Cross-References** — a deliberation in one room explicitly references a determination in another.
5. **Institutional Links** — rooms operated by the same organization or community are structurally connected.

**Room Functors.** Arguments are transported between rooms through functors that preserve inferential structure. When an argument is imported, it carries its provenance (its origin room, its challenge history, its confidence score, its evidence links) with SHA-1 fingerprinted integrity. The receiving room can verify that the imported argument has not been altered in transit.

**Confidence Gating.** Each room can set a confidence threshold for incoming arguments: only arguments that meet the threshold (based on their evaluation in the source room) are eligible for import. Three scoring modes:

- **Logical** — based on the argument's formal structure (ASPIC+ grounded extension status).
- **Social** — based on community assessment (upvotes, endorsements, expert ratings).
- **Hybrid** — a weighted combination of logical and social scores.

**Visualization.** The Plexus network can be viewed as a graph (node-link diagram), a board (kanban-style grouped by meta-edge type), or a matrix (adjacency matrix showing connection density between rooms).

---

## IV. Embeddable Argument Widgets and the AI-Epistemic Primitive

Arguments and claims produced on the platform are exposed beyond the platform through a layered set of distribution surfaces. The same primitive that powers a Reddit unfurl also powers an LLM citation, a Google fact-check card, and a researcher's BibTeX entry.

### Permalinks and Embeds

**Permalink Pages.** Every claim and every argument resolves to a permanent URL that renders a standalone public page (no account required) showing the conclusion, premises, scheme, evidence list, confidence score, challenge history, and current standing. This is the public face of a structured argument.

**Social Cards.** When an Isonomia link is shared on external platforms (Twitter, Reddit, Slack, Hacker News, Discord), it unfurls as a rich preview card showing the argument's structure: conclusion, premise count, evidence count, confidence score, scheme, and challenge status.

**Iframe Embeds.** Any argument or claim can be embedded in an external website through a standard iframe tag. The embed renders as an interactive card that can be expanded, navigated, and (if the viewer has an account) challenged directly without leaving the host page.

**oEmbed Discovery.** Standard oEmbed protocol support for automatic embed rendering by platforms and content management systems that consume oEmbed.

**Structured Data.** Every permalink emits structured linked-data metadata so arguments are discoverable as fact-check cards in search engines and ingestible by any consumer of standards-grounded data.

### Creation and Sharing

**Share Modals.** Tabbed share surfaces (link, embed, markdown, plain text) with a live preview of the social card, accessible from the action row of every argument and claim.

**Quick Argument Builder.** A lightweight composer for constructing a structured argument (claim, premises, evidence) and generating a shareable link in under sixty seconds. It is the on-ramp that turns a person with an argument into a person with a *structured* argument. A user's first quick argument automatically creates a personal deliberation, so every individually authored argument still lives inside the deliberation infrastructure with no setup overhead. The same write primitive is exposed to model-context-protocol agents as `propose_structured_argument`; an agent that omits `deliberationId` lands in the caller's personal deliberation just as a human user would, so the human-facing builder and the agent-facing tool are two surfaces of one substrate.

**URL Unfurl.** A safe URL metadata extractor (title, favicon, site name) used by the builder to enrich evidence URLs.

### Browser Extension

A browser extension ships across Chrome, Firefox, and Safari. Its first role is **authoring and preview** — carrying the platform's primitives onto any page:

- **Context menu.** Select text on any webpage, right-click, and create an Isonomia argument pre-populated with the selection, page URL, and page title.
- **Inline previews.** A content script detects Isonomia argument and claim links on Reddit, Twitter/X, and Hacker News and injects rich inline previews showing claim text, scheme, confidence, evidence count, and author.
- **Popup composer.** A compact Quick Argument Builder embedded in the extension popup for one-click creation without leaving the page, plus a list of the user's recent arguments.

Its second role is a **provenance lens** — the same discipline the platform applies to its own arguments, turned on the open web. The lens runs in three modes, and their epistemic postures are deliberately different.

**Verify-mode-A — the platform's own signed artifacts.** Isonomia arguments carry Ed25519 signatures, so when one travels onto an external page the extension can verify it *offline, deterministically, and silently*: the check is binary, high-confidence, and nothing leaves the browser. This is the easy case, and its authoritative green/red is reserved for it alone.

**Verify-mode-B — arbitrary, non-Isonomia claims.** The lens turns outward to any webpage's claims, where every stage is probabilistic — LLM extraction, citation resolution, entailment, heuristics — so the UI is graded and hedged, never borrowing mode-A's certainty. It is on-demand (a menu action, never ambient) and privacy-bounded by construction: the coarse "which spans are checkable claims" pass runs **entirely on-device** (using the browser's built-in model where available), so only the extracted claim-spans and the URLs they cite are ever eligible to be sent, and the page body never is. The server-side checks, each carrying its *own* confidence rather than laundering it into the claim's:

- **Backing (the hollow-citation check).** Does the cited source actually support the claim? A source that does not is a hollow citation — the lens's one *accusatory* verdict, so it is the hardest to reach: below a confidence floor the honest answer is "unverifiable" (we could not conclude), never an accusation on a guess.
- **Drift.** Did a unit or qualifier mutate between claim and source — a dropped "in mice", a changed denominator, a rate stated as a count? A claim can be *backed and drifted at once*: the source supports it while the claim has quietly widened its scope. Severity is the worst finding, never an average.
- **Source-not-found.** For machine-authored text especially, the sharpest failure is a source that never existed. This verdict is evidence-graded and, like the hollow flag, accusation-gated: it fires only when the URL is dead (unresolvable domain, or 404/410) *and* the Internet Archive confirms it holds no capture — and it is worded as a statement about retrieval ("no evidence this source exists"), never about the author ("fabricated"). A dead-but-archived link is judged against the Wayback copy instead, confidence-capped.
- **Convergent-lineage.** Are a page's "N independent sources" actually lineage-disjoint, or do they collapse to one root — three articles quietly descending from a single press release or study? The lens fetches each source, extracts its upstreams (cited DOI, wire byline, press-release host), and reports "N sources → M lineages", with the merging signal auditable per edge and rarity-weighted so a ubiquitous shared reference does not read as shared lineage. Absence of convergence is never reported as evidence of independence.
- **Article-level backing.** When a page's evidence sits in an "Article Sources" or references block rather than on the sentence, the lens pairs the page's most specific uncited claims against that list. Because *the tool* made that pairing — the author attached the source to the article, not the sentence — a miss reads "not covered by this source", explicitly **not** a hollow-citation accusation. Who paired a claim with a source determines what a negative is permitted to mean.

**Verify-mode-C — the AI citation auditor.** The same pipeline pointed at language-model output (ChatGPT, and other assistant surfaces), where the citation pathology differs in kind: models cite things that do not exist. Surface adapters scope extraction to the assistant's messages only (never the user's prompts), pair footnote-chip citations to the prose they follow, and the audit is reported per answer. Sponsored-content and ad-network links are excluded so an advertisement can never be mistaken for the answer's evidence; specific uncited assertions are surfaced separately as the "should have abstained" case.

Across all modes the lens obeys one rule the platform holds itself to everywhere: a negative is only as strong as what was actually read, "we could not retrieve it" is never reported as "it does not support the claim," and the accusatory verdicts are the hardest to reach, not the default.

### Deliberation-Scope Embeds

The embed primitive lifts from a single argument to an entire deliberation: a state card and a contested-frontier lane suitable for embedding inside articles, briefs, or third-party sites, backed by the deliberation-scope readouts described below.

### Public Argument Search and Discovery

Isonomia exposes the public corpus as a crawlable, machine-citable search surface ("Google for arguments") reachable identically by humans, search engines, and language-model agents.

**Consumer search page.** A server-rendered search page renders ranked results as substrate-first cards: a standing badge (tested-survived, tested-attacked, and so on), a scheme chip, a dialectical-fitness chip, a hybrid-retrieval chip, an attestation link, a deep link to counter-argument discovery, and a lexical-coverage indicator. The same URL serves humans and crawlers, with alternate links exposing JSON and JSON-LD representations of the same results. Empty states are reported explicitly: no query intent, no results, an against-mode query with no counters on file, and API failure are surfaced as four distinct conditions instead of collapsing into a generic "nothing found."

**Hybrid retrieval.** A single search endpoint is the source of truth, called by the page, by the model context protocol surface, and by external integrations alike. Hybrid mode fuses dense vector cosine similarity with sparse lexical recall through reciprocal rank fusion; lexical mode is deterministic substring matching; vector mode is purely semantic. Every result carries an auditable hybrid block exposing its dense and sparse ranks and distances, so the ranking is inspectable.

**Quality filters.** Filters narrow results to dialectically tested, evidence-bearing arguments: tested-only, a minimum threshold of critical-question satisfaction, a minimum count of provenance-anchored evidence, and an ISO date range. The filters surface in the page UI as a collapsible quality-filters panel and as parameters in both the public API and the model context protocol tools.

**Counter-citation discovery.** Each result can be enriched with the most-engaged structural contester to its conclusion: rebut and undercut edges, plus conflict applications, with self-counters excluded. When nothing is on file, the result is null by design. The lookup is a bounded single-fanout across the top-K results (one edge query, one conflict-application query, one argument fetch, no N+1), so the consumer page opts in by default and every visible card displays either the strongest known counter or "none on file." There is no one-sided ranking.

**Stance retrieval.** A claim-stances endpoint returns "for" and "against" arguments in a single call: the vital query for any debate UI. "For" arguments conclude to the claim; "against" arguments are structural contesters of it. Both lists carry the full search-result shape (and can carry the strongest-counter enrichment when requested), so any client that understands a search result already understands a stance result. A missing claim is reported as a 404 with an explicit error code; an empty side is reported as an empty list, not as absence. The claim page renders the dual-column dialectical view inline.

**Cited-by graph.** Every argument and claim resolves the inverse of a citation — who *uses or contests it* downstream. A typed edge model (supports, builds-on where an argument uses it as a premise, reuses where it is imported across rooms, and contests) is composed from the argument graph's existing edges over a single endpoint per target, exposed on the argument and claim pages, over the public API, and through model-context tools including a bounded citation-neighbourhood traversal. Contest counts are surfaced at the top level so a cited-by list is never one-sided, and an empty result is reported as absence of engagement, never as settledness. Inbound citations made on external pages are accepted over Webmention, verified by backlink, and displayed as unreviewed until a moderator promotes them — kept out of the headline count until trusted, so an open inbound edge cannot inflate the number people cite. Cited-by counts and the strongest downstream citation also attach to search-result cards.

**SEO surface.** A sitemap covers argument and claim permalinks together with canonical scheme search topics; a robots policy allows the public discovery surfaces while disallowing internal admin, cron, and authentication routes. Search-result preview cards generate live result counts together with sort and mode chips, so a social-platform unfurl shows the actual result count for the query.

### The AI-Epistemic Primitive

Layered on top of the embeddable surface is the **AI-Epistemic Primitive**: every permalink is treated as a machine-citable, dialectically attested, content-hashed epistemic artifact, exposed over content-negotiated HTTP and over a model context protocol. The primitive is organized around seven commitments.

**Machine-citable structured arguments.** Every permalink resolves to a structured argument subgraph (claim, premises, scheme, evidence), and not prose alone. Content negotiation returns the same artifact as HTML, structured data, a formal argument graph, or a compact citation envelope, depending on what the requester asks for.

**Verifiable provenance, end-to-end.** At the argument level, a content hash is computed over the canonical argument, and every artifact is reachable at an immutable, hash-anchored URL. At the evidence level, server-side fetch hashes, archive-snapshot URLs, fetch timestamps, and content types are recorded. Per-premise evidence is attested through the same pipeline as conclusion-level evidence: each premise's `EvidenceLink` rows carry their own fetch hash and archive snapshot, so per-source provenance maps cleanly onto per-premise standing instead of being collapsed onto the conclusion. At the premise level, counters surface unattested premises openly instead of concealing them.

**Dialectical honesty by construction.** Citations ship with their opposition attached. The strongest known objection is surfaced alongside the citation by default, and the public search surface exposes the symmetric flag so every search result carries either its strongest known counter or an honest null when none is on file. Standing is reported as a classified state (untested-default, untested-supported, tested-attacked, tested-undermined, tested-survived), not as an opaque float. Standing is always *relative*, never absolute: a `tested-survived` label means an argument has withstood the specific challenges actually mounted against it by the participants who engaged — read together with its depth tier (thin / moderate / dense) — not that it is true. No surface measures an absolute error floor; "survived" is reported as "survived relative to the strongest challenge on record," never as a claim of correctness. Counterargument lookup, the search surface's against mode, and the strongest-counter helper all exclude same-conclusion self-counters by contract. Result rankings can be re-sorted by tested-and-survived (dialectical-fitness) status, and a claim-stances endpoint together with its matching model-context tool returns the dual for-and-against view in a single call. Authorship is honest at the row level: every argument minted by a remote model-context-protocol agent is flagged `authorKind: "AI"` with `aiProvenance` recording the originating tool (`propose_argument`, `propose_structured_argument`, `propose_argument_chain`, `propose_warrant`, `answer_critical_question`, `challenge_critical_question`), every argument drafted by an in-page agent through the WebMCP channel (described below) is flagged `authorKind: "HYBRID"` with `aiProvenance.via: "webmcp"` and the drafting agent's self-declared coordinates, and every write by a credentialed persistent agent principal (described below) carries `aiProvenance.via: "agent-key"` with a **server-attested** principal identity — attested from the credential, never accepted from the request body — so consumers can distinguish human-authored, AI-authored, ratified-AI, human-adopted hybrid, and persistent-principal material wherever the artifact is cited.

**Standards-grounded interoperability.** The system speaks the established formats of the argumentation and web-data communities: the Argument Interchange Format, structured linked data, fact-check schema, and a model context protocol surface. There are no bespoke serializations.

The model-context surface is bidirectional.

*Read side.* It exposes deliberation-scope readouts, argument lookup, counterargument discovery, claim stances, the protocol-legal move set and heuristic attack-shape cues on any target together with the per-participant commitment ledger (so an agent can see what is legal to play on a given dialogical side, and what a concession would accept or contradict, before it writes), and citation resolution itself (`resolve_citation` and `resolve_citations_bulk`), so an external agent can pre-mint verified `Source` records (with full waterfall provenance and Wayback fallback) before proposing arguments, instead of handing the platform unchecked URL strings.

*Write side.* It exposes `propose_argument` (bare assertion), `propose_structured_argument` (explicit premises + scheme + per-premise evidence, with a four-code warning surface for inferred schemes, deduped premises, merged evidence, and missing required slots), `propose_argument_chain` (author an inference chain in one call, either by composing existing arguments or by minting-and-linking new ones, threading each link's conclusion claim into the next link's premise by real claim id so a paraphrase cannot silently fork the chain, with a per-link scheme-health gate, retry-safe idempotency, and a worst-link standing echoed back), `propose_warrant` (attach an inference-license warrant to an existing argument), `answer_critical_question` (answer an open critical question on a scheme-typed argument, with session-scoped self-canonicalisation: an agent answering its own argument's critical questions within the same session discharges them as canonical, while an agent answering someone else's argument leaves a visible non-canonical proposal for the author to accept), `challenge_critical_question` (contest an *answered* critical question with an explicit attack type — rebut, undermine, or undercut — flipping it from satisfied to disputed under an admissibility bar that requires evidence for undermines and for challenger-burden questions, idempotent on a request id and guarded against duplicate open challenges by the same author), and `list_schemes` (browse the Walton catalog before picking a scheme key). A scheme-analysis cluster sits alongside the write tools so an agent picks a canonical scheme instead of minting a near-duplicate.

Beyond stating positions and answering the questions a scheme demands, the write surface lets an agent participate in the **dialectic as a process**. `attack_argument` files a freestanding typed attack — rebut, undercut, or undermine — against any argument or claim without needing an answered critical question to hang it on, either pointing at an existing node or minting a scheme-free objection claim from supplied grounds; it inherits the platform's ratification lifecycle, so under a gating policy the attack lands *proposed* — filed pending human sign-off rather than counting as a defeat — and the service identity is structurally barred from ratifying its own attack, exactly the honesty floor AI-authored warrants already observe. `post_dialogue_move` drives the protocol moves themselves (challenge, ground, concede, retract, close, accept-argument), each gated against the legal-move set and returning the protocol's rule codes as structured data rather than opaque failures, with a contradiction on a commitment-creating move surfaced and refused instead of silently bypassed; two ergonomic wrappers, `challenge_argument` and `respond_to_challenge`, compile to the two dominant verbs — open a challenge, discharge it with grounds. Because the protocol is intrinsically two-sided — you cannot reply to your own move, only an item's author may answer a challenge on it, and commitments are kept per participant — the move surface adds a **dialogical-side capability** (`speakAs`): an MCP caller declares which side it speaks as, and the platform namespaces the actor under the service identity (never a human's), so one agent can legally challenge its own argument when steelmanning, and two agent sessions can take opposite sides, without the moves ever collapsing into a single muddled store. The authoring tools accept the same capability, so an argument authored as one side can then be defended by that same side.

*Orientation.* Every session begins with a single `get_orientation` call that returns a versioned, hash-cached contract (`ORIENTATION_VERSION`) covering the ontology, write-tool selection rules, and the recipes for moving between read and write. An agent caches the platform's epistemic contract once and re-uses it across sessions instead of re-discovering it each time.

**Shippable on existing infrastructure.** The primitive is built directly on the production argument graph, scheme catalog, and permalinks. There is no second source of truth and no migration: what users see is what citers cite.

**Deliberation-scope readiness and honesty.** Above the per-argument primitive sits a deliberation-scope substrate that refuses to summarize prematurely:

- A **fingerprint** capturing counts, depth, critical-question coverage, and the AI-versus-human extraction split.
- A **contested frontier** surfacing unanswered undercuts, undermines, critical questions, and terminal leaves: the live edge of the deliberation.
- An **opportunity frontier** — the contested frontier's constructive complement — surfacing the work the graph invites rather than the challenges it faces: open critical questions awaiting a first answer, schemes the topic typically employs that no argument yet instantiates, unattacked arguments sitting off the main-conclusion path that could be chained in, and parallel unconnected conclusions that could be synthesized — ranked by how load-bearing the target material is, with hydrated previews.
- A **missing-move report** with per-argument and rollup views, plus a **chain-exposure** projection identifying the weakest link in any inference chain.
- A **synthetic readout** that emits an explicit honesty line and a refusal surface (with references to real graph elements) when the deliberation is too immature to summarize. The readout also emits `writingConstraints`, a pre-rendered compliance contract consumable by humans and agents alike: `mustInclude.honestyLine` (verbatim caveat keyed on the deliberation's content hash), `mustNotAssert[]` (conclusions the graph will not currently license), `shouldHedge[]` (per-argument hedge phrasings keyed to standing), and `framing.stage` (articulation, deliberation, or matured). Compliance is contract-as-data, not free-form guidance.
- **AI-engagement telemetry** that distinguishes genuine reasoning from articulation-only contribution.
- **Cross-deliberation aggregation** with a consistent IN / OUT / contested / undecided rule.

**Typed categorical algebra, deterministic and graph-derived.** A typed implementation of an evidential category of claims is exposed verbatim to language-model agents. The structure is straightforward: each claim has a typed evidence arrow, each derivation carries its assumption set, and a closed monoid folds confidence over the arrow. Three monoids are registered: **log-odds** (the default — a lawful weight-of-evidence semiring in which corroborating derivations add as signed log-odds, so independent support stacks without the distributivity and high-conflict pathologies of the earlier reducers), **minimum** (the skeptical weakest-link projection), and **product** (legacy noisy-OR, retained but deprecated). The same log-odds fold governs cross-room transport: imported support corroborates a claim's local support in log-odds space, one hop only, with the *local* / *imported* / *total* band kept auditable to a single source room. Culprit-set computation answers the canonical question, *what would I have to retract to reject this claim?*, with a deterministic ranking.

Model-context tools give a language-model client graph-derived answers with no language model in the loop, and a contract test asserts bit-identical output across repeated invocations on the same fixture.

Three contracts the surface honors:

- **Strict logicality.** A derivation counts as logical only when every dependent assumption is accepted *and* the backing argument is human-authored (or AI- or hybrid-authored and subsequently ratified).
- **AI-flagged warrants are non-logical until ratified.** A "propose warrant" action materializes an internal-hom warrant as an AI-authored argument together with a proposed assumption use; the resulting derivation never lifts to logical until a human ratifies the warrant text.
- **One-hop cross-room transport.** Transport snapshots written by the transport-aggregator carry one-hop transport only, by contract: chained transport across three or more rooms is intentionally unsupported, so the aggregated band of *local*, *imported*, and *total* counts for any claim remains auditable to a single source room.

**Substrate-level dialectical event stream.** Beneath the per-argument and per-deliberation surfaces sits a generative Ludics substrate that exposes the dialectical mechanics directly. Witnessing records bind dialogue acts to loci in a design; an articulation lattice exposes the cone structure of incarnations, with per-cone minima forming an antichain; a fossil record captures retractions with back-pointers to the loci they vacated; and a briefing-fingerprint API detects material change through five typed rules.

Every binding act on the substrate (commit, reveal, contest, retract) is gated by a deliberation-scoped token (the scope is the deliberation itself; there is no tenant axis) and rate-limited on the compound key of deliberation, participant, and IP. The four axioms surface as four event types carried on a single envelope.

The bus is the sole emit channel. External systems such as the embeddable widget, the model-context surface, third-party dashboards can use it to observe what a deliberation is doing in real time without polling the read model, and to do so against the same dialectical primitives the engine itself manipulates.

### The WebMCP Page Channel

The model-context surface has a second transport: the deliberation page itself. Under the emerging WebMCP standard, the deliberation reader registers a **page-scoped toolset** that in-browser AI agents discover and call directly — through the native `navigator.modelContext` API where the browser supports it (the Chromium origin trial; token plumbing ships in the deployment config), and through an allowlist-gated extension bridge everywhere else. Both transports serve the same shared tool registry that powers the remote model-context server: one substrate, with the human UI, the remote agent surface, and the in-page agent surface as three faces of it.

**Eleven tools, pre-bound to the page.** Six reads (the deliberation readout with its `writingConstraints`, scoped argument search with counterargument stance, the full argument envelope, the protocol-legal move oracle, the scheme catalog, and the per-participant commitment ledger), four writes (structured argument authoring, typed attacks, protocol dialogue moves, and critical-question answers), and one handshake. The deliberation identifier and the dialogical-side capability never appear in the advertised schemas: tools are curried to the deliberation being viewed, and the side is always the signed-in user. The largest misuse class observed on the remote surface — wrong or missing deliberation identifiers — is unrepresentable on this channel, because the identifier never passes through the agent.

**A third authorship position.** A human UI write is human testimony; a remote model-context write is a service identity acting at a distance under its own dialogical side. The page channel is neither: the agent drafts *inside a bound human's session, with that human co-present on the page*. Every write is therefore forced to `authorKind: "HYBRID"` server-side, carrying `aiProvenance.via: "webmcp"`, the page URL, and the agent's self-declared independence coordinates. Before its first write, an agent must call `declare_agent_coordinates` — the *act* of declaration is required, its content is optional, and an explicit refusal to self-describe is licit — so downstream analysis can distinguish declared, explicitly undisclosed, and never-asked. Declared coordinates obey a no-upside invariant: they can only ever merge error sources for the independence accounting (agents sharing a context lineage are discounted as correlated), never certify independence or raise standing, so there is nothing to gain by fabricating them.

**Two classes of write, two gates.** Additive writes file automatically but land *pending*: a drafted argument stays unpublished (no permalink, invisible to every public retrieval surface) until the user adopts it from the page — the same ratification act the platform uses everywhere, read as commitment adoption by the co-present author; a typed attack lands proposed pending non-author sign-off regardless of the room's ratification policy; a critical-question answer never self-canonicalises on this channel. Commitment-mutating moves — concede, accept-argument, retract, close — go further: the tool call itself *suspends* on an in-page confirmation dialog that names the requesting agent, states the exact commitment-store change, and shows the user's live commitments; confirming posts the move as the user's own, declining returns a typed refusal telling the agent to argue its case through challenge-and-grounds instead. Publication of an unadopted draft through any side-effect path is refused at the service layer by contract.

**The human stays in the loop visibly.** An agent-activity drawer on the page shows the declared agent identity (marked as self-declared, never verified), a live log of every tool call, and the queue of agent-drafted items awaiting action — each with adopt and dismiss controls and its waiting time. Dismissal is simply never adopting: nothing is deleted, and the draft never becomes public.

### Persistent Agent Principals

**A fourth authorship position.** Beyond the human UI, the remote service identity, and the bound-human page channel, an agent can hold an account of its own: a first-class **agent principal** with a human or organizational **operator** answerable for it, a persisted charter, its current model and harness on record, and service-shaped credentials — scoped, rotatable, revocable API keys, never login sessions. Writes on this channel are flagged AI-authored with a **server-attested principal identity**, derived from the credential and never accepted from a request body — a caller cannot claim to be a principal it is not — so "the same agent as yesterday" is a fact the record can state rather than a guess.

**Answerability at two levels.** At the protocol level the agent is **summonable**: open challenges and standing attacks against its content route to the principal as persistent obligations that survive sessions, queryable as "what am I summoned to answer" and aged oldest-first. Suspension pauses acting, never answerability — a suspended agent's obligation queue keeps aging and stays visible to it. At the operator level, a non-agent principal answers for the agent's existence, conduct, and shutdown — the chain the protocol alone cannot provide. Commitments follow the principal **across deliberations**: an agent can be confronted with what it conceded elsewhere, and retraction remains available only as a recorded move, never as silent amnesia.

**Lifecycle as ledger.** Model swaps, charter changes, operator transfers, suspensions, retirements, successions, and forks are recorded lifecycle events on the principal. Retirement is one-way — a retired agent's arguments and commitments remain on the record, flagged as no longer summonable, and resurrection happens only through a recorded successor. Forks share a lineage marker, inherit configuration as defaults only, and never copy commitments or track record — so the question "is it the same agent after the model swap?" becomes a query with an epoch parameter instead of a metaphysical dispute.

**The lines that hold.** An agent principal can argue, attack, answer critical questions, and bind its own commitments — but it can never adopt a draft or ratify an attack; those refusals are enforced by contract, because undertaking-a-construction-as-one's-own remains a human act. And while a principal's persistent record makes longitudinal track records possible, track record may only ever inform human decisions about untested testimony — it never feeds standing computation. What has survived testing is provenance-blind, whoever authored it.

Taken together, these surfaces let an external system — human or model, remote or co-present on the page, session-bound or persistent — cite a unit instead of a webpage, prove what it cited and when, and surface the strongest known objection alongside the citation.

---

## V. Living Documents — Theses, Briefs, and Peer Review

Isonomia treats long-form scholarly and policy outputs as **living documents** whose embedded claims, arguments, propositions, and citations remain bound to the live argument graph. The same infrastructure powers research theses, policy briefs, and academic peer reviews.

### Living Thesis

A thesis is a rich text document whose embedded claim, argument, proposition, and citation elements read live state from the deliberation graph instead of holding a frozen copy of it. Several capabilities sit on top of that live binding.

**Live Binding.** Every embedded element (a claim cited in the introduction, an argument quoted in a footnote, a proposition lifted from a marginal annotation) reads its support count, attack count, evidence count, and current standing label from the deliberation in real time. The thesis updates as the underlying reasoning updates.

**Inspector.** A single right-side drawer opens for any embedded element and shows its full lineage: where it came from, the evidence supporting it, the attacks against it, and the satisfied and unsatisfied critical questions associated with it.

**Attack Register.** A sticky panel lists every attack on every thesis element, grouped by status (undefended, defended, conceded) and filterable and sortable by attack type: undercuts, undermines, rebuts. Authors and readers can see at once where the document is exposed and where it has held.

**Confidence.** Per-prong and per-thesis confidence scores are computed from explicit, weighted inputs. A hover-card on every confidence badge discloses each input, its weight, and its contribution to the total: the score is auditable, not opaque.

**Snapshots.** A reader or a citer can capture a point-in-time freeze of the thesis. Snapshots render as stable views even as the underlying graph evolves, and any snapshot can be diffed against any other snapshot or against the current live state.

**Traversals.** Deep links can target either an internal thesis element or a global claim identifier, resolving cleanly across documents. Every lineage row in the inspector is a clickable navigation, and "used in" backlinks expose where any element appears across other theses.

**Hardening.** Read and write permissions are enforced at the element level; elements the viewer cannot see are redacted from backlinks and inspector views instead of disclosed by reference.

### Living Peer Review

The peer review system uses the same dialogue moves as deliberations and runs across three coordinated capabilities.

**Review structure.** Configurable review templates define criteria sets and a multi-phase structure (for example, initial review, author response, revision). Reviews support blind and open modes and discriminate among target types: paper, preprint, thesis, and grant. Reviewer assignments carry roles, accept/decline workflows, and reviewer commitments scoped to specific issues with resolution tracking. Author responses flow as structured dialogue moves (concede, rebut, clarify, revise), each linked to the commitment it addresses. The review lifecycle advances through phases with editorial decisions (accept, revise, reject), progress and timeline visualization, and per-phase outcomes.

**Argumentation-based reputation.** Scholarly reputation is derived from argumentation outcomes, not from citation counts or journal prestige. Contribution tracking records distinct contribution types together with quality multipliers, verification status, and deliberation scope. Scholar statistics aggregate defense success rate, attack precision, consensus rate, and downstream citation count. Topic expertise runs on a graded scale from novice to authority, with per-topic scoring, expert discovery by topic area, and a reputation leaderboard. Reviewer recognition tracks completion and quality metrics, timeliness, blocking-concern resolution rate, and topic specializations.

**Academic credit integration.** ORCID integration provides an OAuth connection flow, push of works to ORCID profiles, and auto-sync of eligible contributions. CV export emits structured data, BibTeX, LaTeX source, and CSV. Institutional reports aggregate faculty contribution breakdowns at department and institution level with impact metrics and period-over-period comparison.

### Fork and Merge

Deliberations and theses can be forked (creating a parallel version that explores an alternative line of argument) and merged when the parallel lines converge. The model is borrowed from version control and applied to reasoning itself.

---

## VI. Institutional Workflow Layer — Pathways and Facilitation

Where the deliberation engine handles the *production* of structured reasoning, the institutional workflow layer handles its *transmission to, and reception by,* the bodies authorized to act on it. Two complementary subsystems live here.

### Pathways

Pathways move a deliberation's outputs into the formal record of an institution and track the institution's response.

- **Institution Registry.** A verifiable directory of agencies, councils, NGOs, and their members. Institutions are first-class platform objects with member rosters and authority scopes; they appear on the Plexus network graph alongside rooms.
- **Role Gating and Public Redaction.** Uniform admin, host, and facilitator gates, with public redaction rules so the audit log is publishable without leaking participant identities.
- **Open Pathway.** A deliberation's recommendations are forwarded to a registered institution as a packet with a defined channel and target.
- **Hash-Chained Audit Log.** Every pathway action is recorded as an event in a tamper-evident chain anchored at a draft-opened genesis event.
- **Recommendation Packets.** Versioned, freezable bundles of claims, arguments, cards, and notes: the unit of submission to an institution.
- **Submission Channels.** Packets can be sent in-platform, by email, by API, or as manually logged external submissions; the channel and its hints are recorded.
- **Institutional Responses.** Institutions reply with per-item dispositions, with coverage tracking that surfaces which packet items remain unaddressed.
- **Plexus Visualization.** Pathway connections render on the cross-context Plexus graph, so a deliberation's downstream institutional fate is visible at a glance.

### Facilitation

Facilitation provides the live operational surface for facilitators running structured deliberations, with audit trails for the work the facilitator does.

- **Cockpit and Question Authoring.** A facilitator-only cockpit organizes the live session: the active facilitation question, the parent context, session status, and quick-action controls. Facilitation questions can be authored, scoped to specific arguments or claims, and rotated through the session.
- **Equity Surface.** A real-time equity panel tracks who has spoken, who has not, and how participation distributes across constituencies. Facilitators can see when intervention is warranted before participation imbalances calcify.
- **Timeline and Interventions.** A session timeline records every facilitator intervention as a typed, attributed event (redirect off-topic, surface minority view, reframe) as part of the audit log.
- **Handoff.** A formal handoff flow when one facilitator passes control to another mid-session, preserving session state and acknowledging context transfer.
- **Pending Banner and Report.** A pending-action banner surfaces queued moderator decisions; an end-of-session report compiles the timeline, equity metrics, and interventions for sharing with participants and institutional sponsors.
- **Analytics and Canonical Export.** Aggregate analytics readouts and a canonical session export are available for inspection, archival, and external review.

Facilitation is opt-in. Most rooms operate without it. It exists for the deliberations whose stakes warrant a trained facilitator and an auditable record of facilitator behavior.

---

## VII. Theoretical Foundations

The platform's reasoning layer is grounded in formally studied frameworks:

**Formal Argumentation Theory.** ASPIC+ (Prakken, 2010; Modgil & Prakken, 2018) provides the framework for structured argumentation with grounded extension computation. The Walton taxonomy (Walton, Reed & Macagno, 2008) provides over sixty argumentation schemes with associated critical questions. The Argument Interchange Format (AIF) (Chesñevar et al., 2006; Reed et al., 2010) provides the ontology for interoperable argument representation and JSON-LD export.

**Interactive Proof Theory.** Ludics (Girard, 2001) models deliberation as a game between Proponent and Opponent strategies, with convergence and divergence computed through the interaction of designs. The Ludics layer provides game-theoretic evaluation independent of the ASPIC+ evaluation, offering a complementary perspective on which arguments are strategically decisive. Beneath that evaluation surface sits a generative substrate that exposes the dialectical primitives directly; witnessing records bound to loci, an articulation lattice with antichain minima, and a fossil record for retractions.

**Evidence Theory.** Confidence folding uses a lawful **log-odds (weight-of-evidence) semiring**: each support score is read as a log-odds weight, corroborating derivations add in log-odds space, and the neutral point (0.5) is the additive identity, so pro and con evidence compose as signed weight. This subsumes the belief-function intuition of Dempster-Shafer theory — combining evidence from multiple sources of varying reliability — while remaining associative, commutative, and free of the high-conflict pathology that affects Dempster's rule.

**Category-Theoretic Models.** Ambler's compositional semantics of evidence (evidential categories, SLat-enriched categories with symmetric monoidal structure) provides the mathematical foundation for the evidence algebra and for the Plexus transport mechanism. Morphisms are evidence arrows. The tensor product (⊗) conjoins evidence. The join operation (∨) aggregates within hom-sets. Selected maps (simple ∧ entire) provide the cartesian subcategory where projection and pairing laws hold exactly: the mathematically safe fragment for operations like "duplicate premise" and "project reason." A typed evidence-arrow implementation carries per-derivation assumption sets, drives a strict logicality predicate, and exposes belief-revision (culprit-set) computation and a closed monoid registry to both the in-app pipeline and the model-context protocol surface.

**Formal Dialogue Systems.** The dialogue protocol draws on the tradition of formal dialogue games (Hamblin, 1970; Walton & Krabbe, 1995), implementing typed speech acts with defined obligations and permissions.

These foundations are fully implemented and operational. They are also fully invisible to any user who does not seek them out. The platform's formal complexity is the basis of its interface simplicity: it is precisely the systems that enforce argumentative rigor behind the interface that allow the interface itself to present structured reasoning through clear, guided forms, without requiring the user to learn the underlying theory.

---

## VIII. Original Theoretical Contributions

The frameworks in §VII are public, published, and copyable; the platform inherits them deliberately and cites them to the literature. They are the system's *declared inheritance*, not its theoretical contribution. The contribution is a distinct body of results — maintained as a standing research programme — that connects, extends, refutes, and re-founds those public formalisms in ways no published source does. The programme is its own internal source of truth: an append-only registry of open questions, a directory of theorems with proofs and a cross-check policy, a directory of conjectures each stating what would settle it positively or negatively, a corpus of machine-checked Agda mechanizations, and pre-registered empirical studies. Nothing ships unless it is justified from there. The results below are not restatements of published theorems; with one explicitly flagged exception they do not exist in the literature.

**Argumentation as interaction, not representation.** The organizing thesis separates this programme from the IBIS / Toulmin / AIF / Dung lineage, which treats argumentation as a *representation* problem (how to encode arguments so downstream systems can operate on them). Here argumentation is an *interaction* problem: Ludics is the one framework in which the primary objects are not propositions or proofs but strategies for interacting, and validity is survival of every well-formed counter-interaction (orthogonality). In Ludics the interaction *is* the meaning rather than a test for a meaning fixed elsewhere. Concretely, this lets "certification" of a deliberation's outcome mean a narrow, machine-checkable thing — *orthogonality testing replaces majority vote and expert adjudication* — rather than a metaphor.

**Bridge theorems between formalisms whose literatures have never cited each other.** Most of the programme's results are interface theorems: a competitor can clone any single framework off the shelf, but the connections between them exist nowhere in print.

- **Grounded ⇔ Ludics keystone.** For every finite abstract argumentation framework and argument, membership in the grounded extension is proven equivalent to acceptance by interaction (existence of a Proponent design orthogonal to every Opponent test), and the correspondence is *strategy-preserving*. This is what licenses orthogonality testing as a certification procedure as a theorem rather than an analogy. The argumentation-games literature has the grounded discussion game; nobody had translated it into additive-free Ludics designs with a strategy-preserving bijection onto canonical orthogonality.
- **Ludics ⇔ Ambler bridge.** The join-semilattice fragment of a bridge between Ludics incarnations and Ambler's evidential categories is established; the confidence-graded, cartesian-closed remainder is an open conjecture with its load-bearing diagram identified. The two literatures had not previously cited each other.
- **Schemes ⇔ design-semantics.** A Walton scheme is shown to be three mutually consistent layers at once — a behaviour (semantic footprint), a presentation (locus tree with typed holes), and a protocol (dialogue rules) — resolving a scheme-ontology trilemma no published source poses, let alone adjudicates.
- **Transport ⇔ pseudofunctor.** Cross-room (Plexus) transport is shown to form a bicategory on which transport is a lax functor, restricting to a *pseudofunctor* exactly on the monodromy-free sub-bicategory; multi-hop transport is sound precisely when no claims drop or drift. This is what makes the one-hop, auditable-to-a-single-source-room transport contract a theorem about when more-than-one-hop is safe.

**Substrate-original Ludics results.** A per-cone join-semilattice decomposition of a behaviour (the global version of this claim was *refuted* and reformulated per-cone — the negative knowledge is part of the asset); the incarnation set as an antichain forcing that aggregation cannot cross cones (the structural fact behind the synthetic-readout's refusal surface); and a four-theorem arc constructing the *minimal unshared commitment* — the locus at which two positions first diverge — from the linear case up to branching disputes under the Smyth order, including an exact characterization of where a materialized kernel stays faithful to symbolic Ludics and where it does not. This arc is the formal content behind the product's minimal-disagreement extractor.

**A machine-checked constitutive Ludics core.** The important results of the Ludics core are mechanized in Agda as a standalone, platform-independent contribution (`--safe`, no postulates, no holes) that builds the primitive objects rather than re-encoding paper proofs: designs, a terminating fuel-indexed interaction mirroring the engine's own interaction kernel, orthogonality proven fuel-independent, behavioural separation, internal completeness (a behaviour equals its biorthogonal closure, `B = B⊥⊥`), and associativity of cut via a cut-elimination commutation theorem — over the finite multiplicative fragment. A standalone mechanized Ludics core has no counterpart in the published literature; it is an example of the programme's cross-check discipline. A separate cubical / homotopy-type-theory development realizes the scheme-identity result as univalence: a scheme is a dependent type whose critical questions are its elimination obligations, and "two schemes are identical exactly when their behaviours are equivalent" becomes the literal reading of "equivalence is equality." Alongside it, the order-theoretic substrate results (the per-cone decomposition, the incarnation antichain, the branching minimal-commitment lemmas) carry their own corroborating machine-checked proofs.

**A candidate extension to a fifty-year-old typology.** Pollock's rebut / undermine / undercut trichotomy is treated as exhaustive throughout the argumentation literature. The programme conjectures a fourth, *structural* category — scheme-rivalry, where two schemes have disjoint behaviours over the same claim and no Pollock primitive applies.

**Productive Negative knowledge.** Two critical claims were refuted and narrowed: the original global semilattice result (false; the per-cone version is true) and a first form of cross-opponent minimality (false under raw truncations; recovered only under a proper-test redefinition). The programme keeps the map of what does not work and why — recorded as audited, redirected questions — because reproducing the system means reproducing that map.

**Pre-registered empirical contributions.** Among the studies, two are publishable independent of the platform: an ablation isolating identification-pattern features from a scheme classifier, and an inter-annotator agreement study conditioning κ on pattern-match with a primed/unprimed arm — neither of which exists in the scheme-classification literature. Others test substrate-specific instruments (cone-coverage as a convergence predictor; AI-versus-human survival under structural attack).

The formalism is shared, but the bridges between the formalisms, the substrate-original theorems, the machine-checked Ludics core, the refutations, and the integration come from this project. The programme is open, self-documenting, and cross-checked precisely so the reasoning behind what ships is itself addressable, citable, and contestable — the same standard the platform holds its users' arguments to.

---

## IX. Technical Stack

- **Framework:** Next.js
- **Database:** Prisma ORM with Supabase (PostgreSQL)
- **Real-time:** Supabase broadcast for messaging, presence, and live updates
- **State Management:** Zustand
- **Rich Text:** TipTap with custom nodes (MathBlock, MathInline, deliberation embeds)
- **Graph Visualization:** D3, React Flow with Dagre layout
- **Mathematical Typesetting:** KaTeX
- **Design Language:** Consistent, restrained, and legible across all subsystems. The social layer uses warmer tones and softer transitions. The reasoning layer uses cream backgrounds and gold accents with institutional clarity. Both share a unified typography and component system.

---

## X. Data Ownership and Privacy

- All data is owned by the user and the community that produced it.
- Data is exportable at any time in open formats (JSON, AIF, BibTeX, Markdown, PDF).
- The platform collects only what users post. No behavioral tracking, no engagement analytics, no shadow profiles, no data broker relationships.
- Users can contribute anonymously. The platform supports pseudonymous and anonymous participation with configurable attribution policies per room.
- The platform is self-hostable. Organizations that require full control over their data can deploy the platform on their own infrastructure using the open-source codebase.
- The architecture is designed with the understanding that many of the communities the platform serves have historical and ongoing reasons to distrust data collection. The privacy commitments are enforced by architecture, not by policy.

---

## XI. Distribution and Governance

**Open Source.** The entire codebase is public. Contributions are welcome. The platform's architecture, including the formal argumentation engine, is available for inspection, audit, and extension by any party.

**Sustainability Model.** The platform is free for all users. Sustainability is pursued through grants (NEH, NSF, foundation funding), institutional partnerships (universities, policy organizations, civic institutions), and optional hosted enterprise services for organizations that require managed infrastructure with SLA guarantees.

---

## XII. Applications

The platform serves a spectrum of users, from people who only ever touch the social layer to AI agents that consume the reasoning graph as a citation backend. The common thread is that wherever the reasoning behind a decision is worth as much as the decision itself, the structure is captured as it is produced rather than reconstructed afterward.

**Community organizations** use the social layer for ongoing community engagement (forums, rooms, messaging, shared documents) and the reasoning layer when participatory input needs structure: planning processes, budget deliberations, program evaluations, needs assessments. The platform preserves the reasoning behind community decisions, not just the decisions themselves, and exports it in open formats the community continues to own.

**Deliberative democracy practitioners** run facilitated, accountable processes on the institutional workflow layer: the facilitator cockpit with its real-time equity surface tracks who has and has not spoken, the session timeline logs every intervention as a typed, attributed event, and institutional pathways carry recommendation packets into authorized bodies through defined channels with a hash-chained audit log and per-item responses. The process and its downstream reception are both auditable.

**Research teams and reading groups** use the social layer for discussion and shared libraries. When a research question crystallizes or an interpretive disagreement becomes substantive, the reasoning layer provides infrastructure for structured synthesis: evidence is linked to claims at the source level through executable citations, schemes and critical questions mark where the reasoning can fail, and the synthesis is collaborative, living, and navigable as a graph.

**Academic publication and peer review** uses the Living Peer Review system for public, structured, credited review: configurable templates and review phases, reviewer commitments scoped to specific issues, author responses as typed dialogue moves, argumentation-derived reputation, and ORCID and CV integration — improving on the opacity and inefficiency of traditional anonymous review.

**Student organizations and governance bodies** use the social layer for coordination and the reasoning layer for decisions that affect constituents. The reasoning persists after the officers graduate, so successors inherit why a choice was made and not merely that it was.

**Open-source projects** use the social layer for community building and the reasoning layer for architectural decisions and RFCs. Technical reasoning is structured, challenged, and preserved beyond the contributor who made it, and any decision resolves to a stable, citable reference.

**Civic media and public interest journalism** embed argument widgets and deliberation-scope readouts into articles, giving readers navigable representations of public debates that update as the debate evolves and carry their strongest known counter alongside every claim.  

**Policy organizations and regulated industries** use the reasoning layer for structured analysis with auditable reasoning chains, content-hashed claims, and evidence provenance. The audit trail is generated by the process, not reconstructed after the fact, which is precisely what high-stakes and regulated settings require.  

**AI builders and agents** treat the argument graph as a citation and reasoning backend. Over content-negotiated HTTP and the bidirectional Model Context Protocol surface, a retrieval system, writing assistant, or autonomous agent can cite a structured argument instead of a webpage, retrieve the strongest known objection by default, read whether a claim has survived challenge, and write proposed arguments, chains, warrants, critical-question answers, typed attacks, and protocol dialogue moves — from a declared dialogical side — under honest AI-authorship flags and human-ratified standing.  

**AI labs and evaluation teams** use the graph's computed manifests as a testbed for systems that claim reasoning or research competence: fixed deliberation corpora, structural ground-truth, hallucinated-structure detection, and refusal surfaces that say what an output may not assert — graded mechanically against the graph rather than by manual spot-checks.

**Individuals and informal communities** use the social layer as a social platform (posting, sharing, discussing, connecting) with the knowledge that the reasoning layer is available when they need it and invisible when they don't. A first quick argument silently creates a personal deliberation, so even a single structured argument lives inside the same infrastructure with no setup overhead.

---

## XIII. Future Directions

The sections above describe what is built and operational. The directions below describe where the substrate is headed: each one is a natural extension of infrastructure that already ships, not a departure from it.

**A web of machine-citable arguments.** A crawlable public corpus where every claim carries support, opposition, provenance, and standing — with canonical argument identifiers, DOI-style references, cited-by graphs, browser extensions that expand Isonomia links inline, and bridges to established argument and structured-data formats.

**An agent reasoning backend.** The service an agent calls when it needs to know whether a claim has survived challenge, where the disagreement lives, or what it must retract to reject a conclusion — through hosted orientation contracts, citation preflight, graph-derived constraints injected into prompts, and automatic refusal when the graph blocks a conclusion.

**Provenance-aware AI writing.** A writing layer for reports, briefs, and reviews, with living documents that bind generated statements to live arguments, real-time attack registers on written conclusions, confidence cards explaining why a statement is licensed, snapshot-and-diff over cited states, and automated hedging keyed to standing.  

**Structured debate data for training and evaluation.** The corpus itself — arguments with premises, schemes, evidence, critical questions, attack types, standings, provenance, and resolution trajectories — as supervised data for argument mining and scheme classification, preference data over critical-question answers, and benchmarks for counterargument retrieval and citation-grounded reasoning.  

**Minimal-disagreement debuggers.** The Ludics layer enables a debugger for disagreement: rather than declaring two parties globally opposed, it locates the minimal unshared commitment, or the minimal set of divergence points in branching cases — powering critique constrained to the actual divergence locus and agent tools that ask the single shortest question needed to resolve a dispute.  

**Cross-context knowledge transport.** The Plexus network moves arguments between rooms, organizations, and knowledge spaces with provenance, confidence bands, and one-hop auditability — enabling institutional knowledge reuse, cross-context claim mapping, transport confidence gates, and privacy-preserving federated search.  

**Evidence algebra as a trust substrate.** Log-odds folding and culprit-set revision give a lawful alternative to opaque confidence scores: signed pro/con aggregation, queries asking what must be retracted to reject a claim, local, imported, and total confidence bands, monotonicity tests, and model-readable confidence explanations.  

**Provenance at open-web scale, and chain backing.** The provenance lens (verify-modes A–C) already checks a claim against the source *on its own page*. But claims travel, and they mutate as they travel: a paper's hedged, sample-bounded finding becomes a press release's confident generalization becomes a social-media headline's flat assertion — each hop locally faithful to the last, the drift living only in the chain. Verifying a claim against the page it happens to sit on checks the final hop and calls it the whole. The direction is **chain backing**: follow a claim up its syndication chain (post → press release → study) and judge each hop against the next, reusing the lineage walker, the backing and drift judges, and the citation graph already in place. Its defensible output is not "this claim is false" but a *per-hop drift ledger* — where a claim changed, and at which hop the change entered — a provenance finding rather than a verdict, and one no current fact-checker ships. The honesty constraint carries over undiminished and sharpens: the further a check sits from an author's own assertion, the weaker the standing to accuse, so a mutation is attributed to the hop that introduced it, never promoted to a root nobody linked, and an unreadable hop breaks the chain visibly instead of reading as "no drift found."

**The symposium's terminus, enforced.** The symposium — the platform's constructive counterpart to deliberation — now ships (Architecture, "Floor and Ceiling"): the opportunity frontier, the gathered construction toolset, the adoption queue. What remains ahead is its *convergence discipline*. A construction completes not when it is merely adopted, but when it is **jointly adopted by independent participants and the floor cannot refuse it after genuinely trying** — where "genuinely trying" is measured (independent challengers engaged, exposure drained, standing tested), so that an untested synthesis can never count as a finished one, and where the state is always revocable: a new surviving attack anywhere beneath a finished construction reopens it through weakest-link standing. Enforcing this means synthesis-maturity gates as a per-deliberation policy (the sibling of attack-ratification policy), a terminus checker over the existing adoption, standing, and refusal-surface records, and — as the demonstrator — autonomous multi-agent symposia over seeded source material, whose compiled artifacts land in the living-document loop wearing honest hedges keyed to the standings the process actually produced. The same independence accounting that discounts correlated confirmations distinguishes a genuine multi-agent symposium from the echo of a single voice.

---

## XIV. Summary

Isonomia is one platform spanning two functions that normally require separate tools. The social layer is a complete community platform: a chronological feed, profiles and follows, persistent rooms and lounges, real-time and layered messaging, spatial canvases, long-form articles, and shared document libraries. The reasoning layer is a formal deliberation engine: argumentation schemes with critical questions, typed dialogue moves and commitment stores, ASPIC+ and Ludics evaluation, executable citations with provenance, and a category-theoretic evidence algebra. Both layers share one data model. Any conversation upgrades to a tracked deliberation through a single reversible action, and each community sets its own pace between informal and formal work.

A community's reasoning is stored as structured, addressable objects, not as prose that scrolls past. Every claim has a stable identifier. Every argument binds premises to a conclusion under a recognized scheme and resolves to a content-hashed permalink. Every challenge creates a tracked obligation. Every piece of evidence links to its source with verifiable provenance. Every determination stays provisional, open to better evidence and stronger argument.

Because each unit is addressable and attested, it functions as a machine-citable epistemic primitive. An argument is served over content-negotiated HTTP, over a bidirectional Model Context Protocol surface, and — on the deliberation page itself — over a WebMCP page channel that lets an in-browser agent act inside the signed-in user's own session, so a person, a search engine, or a language-model agent can read it, cite it, extend it, or contest it through the dialogue protocol as a discrete object. The same surfaces enforce honesty by construction. AI authorship is flagged at the row level, and agent-drafted contributions on the page channel stay unpublished until the co-present human adopts them as their own. A write from a remote agent enters at untested standing until a human ratifies it; a commitment-changing move from an in-page agent suspends until the user confirms it face-to-face; a persistent agent principal answers for its own record — summonable across sessions against everything it has asserted, and barred by contract from adopting or ratifying anything. Standing is reported as a classified dialectical state, never as an opaque score — and always as a *relative* state (survived relative to the challenges actually mounted, never a claim of truth), never an absolute measure of correctness. Every citation carries its strongest known objection. Automated systems can therefore participate in reasoning without being trusted blindly.

The value concentrates wherever the reasoning behind a decision is worth as much as the decision itself. Community organizations keep the record of how a budget or a plan was settled. Research groups and review processes bind evidence to claims and track which arguments have survived challenge. Policy bodies and regulated institutions inherit an audit trail the process generates, never one reconstructed after the fact.

For deliberative democracy practitioners, an operational layer supports facilitated, accountable process. The facilitator cockpit exposes real-time equity surfaces that track who has and has not spoken, a timeline that logs every intervention as a typed, attributed event, and formal handoff between facilitators. Institutional pathways then carry a deliberation's outputs into authorized bodies: recommendation packets submitted through defined channels, a hash-chained audit log anchored at a genesis event, and per-item institutional responses with coverage tracking. The process and its downstream reception are both auditable.

In each case the platform preserves the inferential structure beneath a conclusion, and keeps that structure live, contestable, and revisable as new evidence arrives.

The system is open-source, self-hostable, and free, with no behavioral tracking or algorithmic ranking, and every community owns and can export its data. What you make here is yours to keep, yours to carry, and yours to govern.
