"use client";

/**
 * AI-Epistemic-Infrastructure Demo Page
 *
 * Explanatory walkthrough of Isonomia's AI-citation primitive: every
 * permalink as a machine-citable, dialectically-attested, content-hashed
 * epistemic artifact, exposed over MCP and content-negotiated HTTP.
 *
 * Illustrative — uses inline example payloads rather than hitting live
 * seeded data. For the live-data demo, point at one of the seeded
 * showcase chains (scripts/showcase/) directly.
 *
 * Accessible at: /test/ai-epistemic
 */

import { useState } from "react";
import dynamic from "next/dynamic";
import {
  Activity,
  ArrowRight,
  Award,
  BarChart3,
  BookMarked,
  Boxes,
  CheckCircle2,
  Cpu,
  Database,
  Eye,
  ExternalLink,
  FileJson,
  Fingerprint,
  Gauge,
  GitBranch,
  Globe,
  Hash,
  HelpCircle,
  Layers,
  Library,
  Link2,
  ListChecks,
  Lock,
  MessageCircle,
  MessageSquare,
  Network,
  PenLine,
  PlugZap,
  Quote,
  Radio,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Split,
  Swords,
  Target,
  Terminal,
  Waypoints,
  Workflow,
  type LucideIcon,
  Triangle,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";

// Pt. 4 deliberation-scope widgets — dynamically imported so this demo page
// stays cheap on first paint and the SWR fetchers only fire when the user
// actually mounts them with a deliberation id.
const DeliberationStateCard = dynamic(
  () =>
    import("@/components/deliberation/DeliberationStateCard").then(
      (m) => m.DeliberationStateCard,
    ),
  { ssr: false, loading: () => <WidgetLoading label="DeliberationStateCard" /> },
);
const FrontierLane = dynamic(
  () =>
    import("@/components/deliberation/FrontierLane").then((m) => m.FrontierLane),
  { ssr: false, loading: () => <WidgetLoading label="FrontierLane" /> },
);

// ─────────────────────────────────────────────────────────────────────────────
// CONTENT
// ─────────────────────────────────────────────────────────────────────────────

interface PillarCard {
  id: string;
  icon: LucideIcon;
  label: string;
  title: string;
  body: string;
  status: "shipped" | "partial" | "planned";
  evidence: string[];
  color: string;
  iconColor: string;
}

const PILLARS: PillarCard[] = [
  {
    id: "machine-citable",
    icon: FileJson,
    label: "Pillar 1",
    title: "Machine-citable structured arguments",
    body:
      "Every permalink resolves to a structured AIF subgraph — claim, premises, scheme, evidence — not just prose. LLMs cite a unit, not a webpage.",
    status: "shipped",
    color: "from-sky-500/10 to-blue-500/15",
    iconColor: "text-sky-600",
    evidence: [
      "Content negotiation: /a/{id} returns HTML, JSON-LD, AIF, or attestation",
      "?format=jsonld emits AIF + Schema.org composite",
      "?format=attestation returns the compact citation envelope",
    ],
  },
  {
    id: "verifiable-provenance",
    icon: Fingerprint,
    label: "Pillar 2",
    title: "Verifiable provenance, end-to-end",
    body:
      "Three layers of evidence: a sha256 over the canonical AIF subgraph; a server-side fetch hash plus archive.org snapshot per source; and a counter that surfaces unattested premises honestly.",
    status: "shipped",
    color: "from-violet-500/10 to-purple-500/15",
    iconColor: "text-violet-600",
    evidence: [
      "Argument contentHash = sha256 over canonical(claim, premises, scheme, evidence)",
      "Immutable URL: /a/{shortCode}@{hash}",
      "Evidence: contentSha256, archive.url, fetchedAt, contentType",
      "cite_argument exposes provenance.unattestedPremises",
    ],
  },
  {
    id: "dialectical-honesty",
    icon: Swords,
    label: "Pillar 3",
    title: "Dialectical honesty by construction",
    body:
      "The citation ships with its opposition attached. Counter-arguments are inline, standing scores are classified (not raw floats), and empty results are honestly empty.",
    status: "shipped",
    color: "from-rose-500/10 to-pink-500/15",
    iconColor: "text-rose-600",
    evidence: [
      "cite_argument.strongestObjection (default: on)",
      "standingState: untested-default | tested-attacked | tested-survived | …",
      "find_counterarguments excludes same-conclusion-MOID self-counters",
      "?sort=dialectical_fitness re-ranks by tested-and-survived",
    ],
  },
  {
    id: "standards-grounded",
    icon: Library,
    label: "Pillar 4",
    title: "Standards-grounded interoperability",
    body:
      "AIF, JSON-LD, Schema.org, MCP. No bespoke formats — any client that speaks one of these can consume Isonomia today.",
    status: "shipped",
    color: "from-emerald-500/10 to-teal-500/15",
    iconColor: "text-emerald-600",
    evidence: [
      "AIF context with aif:/as:/cq: prefixes",
      "Schema.org composite: Claim + ScholarlyArticle + ClaimReview",
      "MCP server (6 tools, stdio)",
      "OpenAPI 3.1 spec + Scalar docs at /api/v3/docs",
    ],
  },
  {
    id: "shippable",
    icon: Triangle,
    label: "Pillar 5",
    title: "Shippable on existing infrastructure",
    body:
      "Built on production Isonomia: same argument graph, same scheme catalog, same permalinks. No migration, no second source of truth.",
    status: "shipped",
    color: "from-amber-500/10 to-orange-500/15",
    iconColor: "text-amber-600",
    evidence: [
      "54/54 attestation verifier passing",
      "37/37 MCP verifier passing",
      "MCP installable into Claude Desktop in three lines",
      "Seedable showcase chain via scripts/seed-showcase-chain.ts",
    ],
  },
  {
    id: "deliberation-honesty",
    icon: Eye,
    label: "Pillar 6",
    title: "Deliberation-scope readiness & honesty",
    body:
      "Above the per-argument primitive sits a deliberation-scope substrate: a structural fingerprint, a contested frontier, a missing-moves audit, chain-fragility projections, and a deterministic readout that refuses to summarise prematurely.",
    status: "shipped",
    color: "from-indigo-500/10 to-violet-500/15",
    iconColor: "text-indigo-600",
    evidence: [
      "DeliberationFingerprint: counts, depth, CQ coverage, AI-vs-human split",
      "ContestedFrontier: unanswered undercuts / undermines / CQs, terminal leaves",
      "MissingMoveReport (per-argument + rollup) + ChainExposure (weakestLink)",
      "SyntheticReadout: deterministic honestyLine + refusalSurface (real node ids)",
      "Cross-deliberation aggregation: consistent-IN / OUT / contested / undecided",
      "AiDraftEngagement telemetry \u2192 articulationOnly chip",
      "DeliberationFingerprintCache (contentHash-keyed) + 30s SWR dedupe",
    ],
  },
];

interface TrackRow {
  id: string;
  label: string;
  title: string;
  status: "shipped" | "partial" | "planned";
  note?: string;
}

const TRACKS: { letter: string; name: string; rows: TrackRow[] }[] = [
  {
    letter: "A",
    name: "Make every permalink machine-first",
    rows: [
      { id: "A.1", label: "A.1", title: "Multi-format content negotiation", status: "shipped" },
      { id: "A.2", label: "A.2", title: "Rich JSON-LD (Claim + ScholarlyArticle + ClaimReview activation)", status: "shipped" },
      { id: "A.3", label: "A.3", title: "Stable content addressing (sha256, /a/{id}@{hash})", status: "shipped" },
      { id: "A.4", label: "A.4", title: "Evidence provenance hardening (fetch + hash + archive.org)", status: "shipped" },
    ],
  },
  {
    letter: "B",
    name: "Become the protocol surface LLMs reach for",
    rows: [
      { id: "B.1", label: "B.1", title: ".well-known/llms.txt + argument-graph", status: "shipped" },
      { id: "B.2", label: "B.2", title: "MCP server (search, get, claim, counters, cite, propose)", status: "shipped" },
      { id: "B.3", label: "B.3", title: "OpenAPI 3.1 spec", status: "shipped" },
      { id: "B.4", label: "B.4", title: "Attestation envelope on every retrieval", status: "shipped" },
    ],
  },
  {
    letter: "C",
    name: "Argument-native search & retrieval",
    rows: [
      { id: "C.1", label: "C.1", title: "Hybrid retrieval + dialectical-fitness re-rank", status: "partial", note: "Re-rank function shipped; Pinecone hybrid pending" },
      { id: "C.2", label: "C.2", title: "Stance retrieval (for / against)", status: "partial", note: "v0 textual; true negation index pending" },
      { id: "C.3", label: "C.3", title: "Counter-citation discovery in citation primitive", status: "shipped" },
      { id: "C.4", label: "C.4", title: "Public embedding artifact", status: "planned" },
    ],
  },
  {
    letter: "D",
    name: "Federated, signed, portable arguments",
    rows: [
      { id: "D.1", label: "D.1", title: "Cryptographically signed arguments (Ed25519)", status: "planned" },
      { id: "D.2", label: "D.2", title: "W3C Verifiable Credentials wrapping", status: "planned" },
      { id: "D.3", label: "D.3", title: "AIF/Argdown federation protocol", status: "planned" },
      { id: "D.4", label: "D.4", title: "Replication / archival partnerships", status: "planned" },
    ],
  },
  {
    letter: "E",
    name: "The scholarly-object UX",
    rows: [
      { id: "E.1", label: "E.1", title: "Citation block (APA/MLA/Chicago/BibTeX)", status: "partial", note: "Markdown citation in MCP; on-page formats pending" },
      { id: "E.2", label: "E.2", title: "DOI-style identifiers", status: "planned", note: "Content-hash substrate exists" },
      { id: "E.3", label: "E.3", title: "Argument-object landing-page polish", status: "partial" },
      { id: "E.4", label: "E.4", title: "Cited-by graph", status: "planned", note: "Awaits embed analytics (Phase 4.3)" },
    ],
  },
  {
    letter: "F",
    name: "Deliberation-scope readiness layer (Pt. 4)",
    rows: [
      { id: "F.1", label: "F.1", title: "DeliberationFingerprint + ContestedFrontier + MissingMoveReport", status: "shipped" },
      { id: "F.2", label: "F.2", title: "ChainExposure (weakestLink projection)", status: "shipped" },
      { id: "F.3", label: "F.3", title: "SyntheticReadout (deterministic honestyLine + refusalSurface)", status: "shipped" },
      { id: "F.4", label: "F.4", title: "Cross-deliberation aggregation (consistent-IN / OUT / contested)", status: "shipped" },
      { id: "F.5", label: "F.5", title: "AiDraftEngagement telemetry \u2192 articulationOnly chip", status: "shipped" },
      { id: "F.6", label: "F.6", title: "DeliberationFingerprintCache + SWR dedupe", status: "shipped" },
      { id: "F.7", label: "F.7", title: "7 new MCP tools + 6 new HTTP endpoints", status: "shipped" },
      { id: "F.8", label: "F.8", title: "MaterialCard + propose_materials (review-track)", status: "planned" },
    ],
  },
  {
    letter: "G",
    name: "Ludics generative substrate (Phase 1)",
    rows: [
      { id: "G.1", label: "G.1", title: "DB schema: LudicMove / WitnessRecord / Design / Behaviour / DesignInclusion", status: "shipped" },
      { id: "G.2", label: "G.2", title: "Write seam: bind_participant_to_design + S1–S4 invariants (T4 non-attribution)", status: "shipped" },
      { id: "G.3", label: "G.3", title: "Witnessing reads: get_witnesses / get_unwitnessed_exposure / get_instantiation", status: "shipped" },
      { id: "G.4", label: "G.4", title: "Structural reads: get_deliberation_schema / get_behaviour_at_locus / get_exposure_map", status: "shipped" },
      { id: "G.5", label: "G.5", title: "Articulation lattice (6 tools): lattice reads + compress_articulation + compute_articulation_join", status: "shipped" },
      { id: "G.6", label: "G.6", title: "Fossil record (get_fossil_record) + briefing-fingerprint API (5 material-change rules)", status: "shipped" },
      { id: "G.7", label: "G.7", title: "Scorecard v1.5: coverage-exposure dimension + manifest extensions (openExposurePoints, coverageRatio, fossilCount)", status: "shipped" },
      { id: "G.8", label: "G.8", title: "Staging migration + stratum-labeling benchmark (< 500ms p95 target)", status: "planned" },
      { id: "G.9", label: "G.9", title: "Fossil retraction lifecycle (argument / locus deletion → fossilize + witness rescission)", status: "shipped" },
      { id: "G.10", label: "G.10", title: "AI synthesis workflow: compute_articulation_join → bind_participant_to_design end-to-end", status: "planned" },
    ],
  },
  {
    letter: "H",
    name: "Ludics generative substrate (Phase 2 — production)",
    rows: [
      { id: "H.1", label: "H.1", title: "Inc(B) antichain decomposition + ∨_⊥⊥ Reading A (per-cone synthesis)", status: "shipped" },
      { id: "H.2", label: "H.2", title: "R1–R5 fingerprint material-change rules (R1 new fossil · R2 stratum delta · R3 minimum-shift · R4 join-eligible · R5 antichain widen)", status: "shipped" },
      { id: "H.3", label: "H.3", title: "OQ-JSL proof pass (Inc(B) antichain invariant verified across the suite)", status: "shipped" },
      { id: "H.4", label: "H.4", title: "Redis-only fingerprint cache (WS-1 / B12) — Postgres truth, Upstash read-through, horizontal-scale convergence", status: "shipped" },
      { id: "H.5", label: "H.5", title: "Compound rate-limit (WS-2 / B11) — (deliberationId, participantId, IP) keyed; bind / propose / retract", status: "shipped" },
      { id: "H.6", label: "H.6", title: "Scoped session tokens (WS-3 / B6) — deliberation-bound JWT via jose; scope mismatch → 403", status: "shipped" },
      { id: "H.7", label: "H.7", title: "Announcement bus A1–A4 — witness_committed / design_revealed / witness_contested / witness_rescinded (BullMQ; idempotent on (eventType,subjectId,occurredAt); replayable from Postgres)", status: "shipped" },
      { id: "H.8", label: "H.8", title: "v2.5 cutover — bus is sole emit channel (no console.info dual-emit); LUDICS_LEGACY_BEARER + ludics legacy bearer branch removed", status: "shipped" },
      { id: "H.9", label: "H.9", title: "Upstash p99 latency dashboard + ElastiCache migration trigger threshold", status: "planned", note: "ops task — outside code-side sprint" },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// EXAMPLE PAYLOADS (illustrative; do not hit a live endpoint)
// ─────────────────────────────────────────────────────────────────────────────

const EXAMPLE_ATTESTATION = {
  permalink: "https://isonomia.app/a/Bx7kQ2mN",
  immutablePermalink:
    "https://isonomia.app/a/Bx7kQ2mN@7c1a4f0e2b9d8c6a5e4f3d2c1b0a9988",
  contentHash:
    "sha256:7c1a4f0e2b9d8c6a5e4f3d2c1b0a99887766554433221100ffeeddccbbaa9988",
  version: 3,
  retrievedAt: "2026-04-29T12:34:56Z",
  conclusion: {
    moid: "9f1b3a…",
    text: "Smartphone-based social media use is a primary cause of the post-2012 rise in adolescent depression and anxiety.",
  },
  scheme: { key: "cause_to_effect", name: "Argument from Cause to Effect" },
  premises: [
    { moid: "p1…", text: "Adolescent depression rose sharply post-2012…" },
    { moid: "p2…", text: "Jonathan Haidt has reviewed the literature…" },
    { moid: "p3…", text: "Several studies report a dose-response relationship…" },
  ],
  evidence: [
    {
      uri: "https://www.anxiousgeneration.com/book",
      contentSha256: "sha256:b3a2…",
      archive: { url: "https://web.archive.org/web/2026.../…", capturedAt: "2026-04-29T12:34:50Z" },
      fetchedAt: "2026-04-29T12:34:48Z",
    },
    { uri: "https://www.hhs.gov/sites/default/files/sg-youth-mental-health…", contentSha256: "sha256:7e5c…", archive: { url: "…" } },
    { uri: "https://jonathanhaidt.substack.com/p/the-evidence-keeps-piling-up", contentSha256: null, archive: { url: null } },
  ],
  dialecticalStatus: {
    incomingAttacks: 1,
    incomingSupports: 0,
    incomingAttackEdges: 1,
    criticalQuestionsRequired: 5,
    criticalQuestionsAnswered: 1,
    criticalQuestionsOpen: 4,
    isTested: true,
    testedness: "lightly_tested",
    standingScore: 0.62,
  },
  author: { username: "panand", name: "Dr. Priya Anand" },
};

const EXAMPLE_ANNOUNCEMENT = {
  eventType: "witness_rescinded",
  version: 1,
  scopeId: "delib_7c1a4f0e",
  actorParticipantId: "participant_panand",
  subjectId: "wr_9f1b3a2c",
  occurredAt: "2026-05-24T18:42:11.083Z",
  payload: {
    ludicMoveId: "lm_bx7kqm",
    fossilizedAt: "2026-05-24T18:42:11.080Z",
    retractLayer: "witness",
    retractReason: "Premise p2 revised; original commitment no longer load-bearing.",
  },
};

const EXAMPLE_SCOPED_JWT_CLAIMS = {
  iss: "mesh-ludics",
  sub: "participant_panand",
  scope: { deliberationId: "delib_7c1a4f0e" },
  iat: 1748112000,
  exp: 1748115600,
};

const EXAMPLE_CITE = {
  permalink: "https://isonomia.app/a/Bx7kQ2mN",
  immutablePermalink:
    "https://isonomia.app/a/Bx7kQ2mN@7c1a4f0e2b9d8c6a5e4f3d2c1b0a9988",
  contentHash: "sha256:7c1a4f0e2b9d…",
  version: 3,
  retrievedAt: "2026-04-29T12:34:56Z",
  pullQuote:
    "Smartphone-based social media use is a primary cause of the post-2012 rise in adolescent depression and anxiety.",
  dialecticalStatus: {
    standingScore: 0.62,
    standingState: "tested-attacked",
    testedness: "lightly_tested",
    criticalQuestionsAnswered: 1,
    criticalQuestionsRequired: 5,
    incomingAttacks: 1,
    incomingSupports: 0,
  },
  provenance: {
    premiseCount: 3,
    evidenceAttachedCount: 3,
    evidenceWithProvenanceCount: 2,
    unattestedPremises: false,
  },
  strongestObjection: {
    permalink: "https://isonomia.app/a/Q9pT3nLk",
    shortCode: "Q9pT3nLk",
    conclusionText:
      "The available evidence shows only small, inconsistent associations between adolescent social media use and mental health outcomes, insufficient to establish smartphones as a primary cause.",
    scheme: "expert_opinion",
    dialecticalFitness: 1.25,
    attestationUrl:
      "https://isonomia.app/api/a/Q9pT3nLk/aif?format=attestation",
  },
};

const EXAMPLE_CHAIN = {
  chainId: "cmpvvmxqk002s8c99uxmsho4v",
  permalink: "https://isonomia.app/chains/cmpvvmxqk002s8c99uxmsho4v",
  chainType: "GRAPH",
  idempotentReplay: false,
  counts: { links: 11, edges: 9, scopes: 2, objections: 2, maxDepth: 3 },
  keystone: {
    argumentId: "cmpvvmpcq00198c99f9hzafic",
    conclusionText:
      "Draining peat admits oxygen and drives microbial oxidation, releasing CO\u2082/N\u2082O at a rate that rises with water-table depth; raising the table reverses it.",
    branchesInto: ["emissions-magnitude strand", "cost-effectiveness strand"],
  },
  weakestLink: {
    argumentId: "cmpvvmqyq001j8c994hie4r98",
    conclusionText:
      "Raising water tables on drained organic soils is among the most cost-effective land-based climate measures.",
    incomingAttacks: 2,
    reason:
      "Both objections land here: an UNDERCUT (land-use displacement) and an UNDERMINE (methane re-establishment).",
  },
  warnings: [],
};

const EXAMPLE_CQ_ANSWER = {
  argumentId: "cmpxc03k500078coxgiqhsl73",
  permalink: "https://isonomia.app/a/OgLPrvIq",
  cqKey: "domain_fit",
  schemeKey: "expert_opinion",
  groundsText:
    "The cited author holds a chair in the relevant field and the claim sits squarely within their published area of expertise.",
  canonical: true,
  responseStatus: "CANONICAL",
  cqStatusEnum: "SATISFIED",
  responseId: "cmpxc18y6000d8coxrg1npzfg",
  idempotentReplay: false,
  standingAfter: "untested-supported",
  warnings: [],
};

const EXAMPLE_CQ_CHALLENGE = {
  argumentId: "cmpxc03k500078coxgiqhsl73",
  cqKey: "bias",
  schemeKey: "expert_opinion",
  attackType: "UNDERMINE",
  groundsText:
    "The cited expert is funded by an industry body with a direct stake in the conclusion, which gives a concrete reason to discount the testimony.",
  objectionClaimId: "cmpxd02aa00098coxq1f7zk21",
  cqStatusAfter: "DISPUTED",
  attackEdge: { type: "UNDERMINES", target: "canonical-answer" },
  evidenceRequired: true,
  idempotentReplay: false,
};

// ─────────────────────────────────────────────────────────────────────────────
// PRIMITIVES
// ─────────────────────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: TrackRow["status"] }) {
  const map = {
    shipped: { label: "shipped", cls: "bg-emerald-50 border-emerald-200 text-emerald-700" },
    partial: { label: "partial", cls: "bg-amber-50 border-amber-200 text-amber-700" },
    planned: { label: "planned", cls: "bg-slate-50 border-slate-200 text-slate-500" },
  } as const;
  const m = map[status];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border ${m.cls}`}
    >
      {status === "shipped" && <CheckCircle2 className="w-3 h-3" />}
      {m.label}
    </span>
  );
}

function CodeBlock({
  language = "json",
  children,
}: {
  language?: string;
  children: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-950/95 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-800 bg-slate-900/80">
        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
          {language}
        </span>
      </div>
      <pre className="text-[12px] leading-relaxed text-slate-100 px-4 py-3 overflow-x-auto font-mono whitespace-pre">
        {children}
      </pre>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTIONS
// ─────────────────────────────────────────────────────────────────────────────

function AboutSection() {
  return (
    <section className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-slate-800">
          AI-native infrastructure for verifiable reasoning
        </h2>
        <p className="text-sm text-slate-700 mt-0.5">
          Refining the unit of citation itself.
        </p>
      </div>

      <div className="rounded-xl modalv2  p-6 space-y-4">
        <p className="text-[15px] font-medium text-slate-800 leading-relaxed">
          Language models are good at producing prose about a debate and bad at
          preserving its structure. They can summarise an argument but lose track
          of which premise carries the weight, which objection is decisive, which
          source backs which claim, and which conclusion the evidence does not
          actually support. They cite web pages, which are the wrong unit: a page
          mixes claims, evidence, rhetoric, and unstated assumptions into a single
          document-shaped blob.
        </p>
        <p className="text-[15px] font-medium text-slate-800 leading-relaxed">
          Isonomia replaces the page with the argument. Claims, premises,
          objections, evidence, and the state of a dispute become machine-citable
          objects — content-hashed, provenance-bearing, standards-compatible, and
          exposed through web, data, API, and Model Context Protocol surfaces. A
          system querying Isonomia learns not just what a source says, but what
          supports it, what attacks it, what remains unresolved, and what it is
          not yet licensed to conclude. The product is a living graph of reasoned
          claims that AI systems can cite, query, challenge, and extend.
        </p>
      </div>
{/* The AI problem — three failure shapes */}
      <div className="rounded-xl modalv2 bg-white p-6">
        <p className="text-[15px] font-semibold text-slate-800 mb-1 flex items-center gap-2">
          <Target className="w-4 h-4 text-slate-500" /> The problem has three shapes
        </p>
        <p className="text-[14px] text-slate-700 mb-4 leading-relaxed">
          Prose-generation fixes none of them. Isonomia stops relying on generated
          judgment for the things that can be computed.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            {
              hdr: "Lost topology",
              body: "A model can render a debate fluently while flattening it — treating a load-bearing premise and a decorative one as equals, or missing that an objection attacks the inference rather than the conclusion.",
            },
            {
              hdr: "Coarse citation",
              body: "The epistemic unit is smaller than a page: a single premise, a single inference, a single piece of evidence. Citing the page is like citing a library when you mean a sentence.",
            },
            {
              hdr: "Unstable judgment",
              body: "Asking one model to grade another's summary yields a verdict that shifts with phrasing. Standings, refusal surfaces, CQ coverage, and provenance are deterministic functions of the graph instead.",
            },
          ].map((f) => (
            <div
              key={f.hdr}
              className="rounded-md border-indigo-200 border bg-white p-3"
            >
              <p className="text-[14px] font-semibold text-slate-800 mb-1">{f.hdr}</p>
              <p className="text-[14px] text-slate-600 leading-snug">{f.body}</p>
            </div>
          ))}
        </div>
        <p className="text-[14px] text-slate-600 mt-4 leading-relaxed">
          Better models do not make the external graph obsolete — they make it more
          valuable. High-stakes reasoning still needs state outside the model:
          transparent, inspectable, versioned, challengeable, and computable. The
          durable layer is not a workaround for weak models; it is epistemic
          infrastructure for stronger ones.
        </p>
      </div>
      {/* Three layers, one data model */}
      <div className="rounded-xl modalv2  p-6 space-y-2">
        <p className="text-[16px] font-semibold text-slate-800 mb-3 flex items-center gap-2">
          <Layers className="w-4 h-4 text-slate-700" /> Three layers on one data model
        </p>
        <div className="flex flex-col gap-4 rounded-xl  ">
          {[
            {
              icon: Network,
              label: "Collaboration layer",
              body: "Feeds, profiles, rooms, messaging, long-form articles, document libraries, annotations, and shared source collections. Communities post, publish, and gather evidence without touching the formal machinery underneath.",
              color: "from-sky-500/10 to-blue-500/15",
              iconColor: "text-sky-600",
            },
            {
              icon: GitBranch,
              label: "Reasoning layer",
              body: "Any comment, annotation, passage, or source note becomes a structured object — a claim, argument, scheme instance, critical question, challenge, piece of evidence, or dialogue move. Addressable, versioned, citable, durable.",
              color: "from-violet-500/10 to-purple-500/15",
              iconColor: "text-violet-600",
            },
            {
              icon: Cpu,
              label: "AI layer",
              body: "Exposes the graph to models. One permalink resolves as whatever the caller needs — page, linked data, AIF graph, attestation envelope, embed, social card, or MCP artifact — so a model never has to reconstruct the context around a claim.",
              color: "from-emerald-500/10 to-teal-500/15",
              iconColor: "text-emerald-600",
            },
          ].map((l) => {
            const Icon = l.icon;
            return (
              <div key={l.label} className="cardv2 bg-white/50 h-full p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`p-2 rounded-xl bg-gradient-to-br ${l.color} ${l.iconColor} shrink-0`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <p className="font-semibold text-slate-900 text-[16px]">{l.label}</p>
                </div>
                <p className="text-[14px] text-slate-800 leading-snug">{l.body}</p>
              </div>
            );
          })}
        </div>
    
      </div>

      

      {/* Concrete example callout */}
      <div className="rounded-xl  border border-indigo-200 bg-white shadow-sm shadow-indigo-400 p-6">
        <div className="flex items-start gap-3">
          <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700 shrink-0">
            <Split className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-indigo-900">
              A graph, not a paragraph
            </p>
            <p className="text-[13.5px] text-indigo-800/90 mt-1 leading-relaxed">
              An agent recently posted a policy argument — that the EU should fund
              peatland rewetting through a results-based payment indexed to
              water-table depth. It did not land as prose but as a graph: eleven
              arguments, nine connections, three levels deep. One keystone premise
              branches to feed both an emissions-magnitude strand and a
              cost-effectiveness strand; five strands of evidence converge on the
              proposal; two objections are wired against different targets (one{" "}
              <span className="font-mono">undercuts</span> an inference, one{" "}
              <span className="font-mono">undermines</span> a premise); and two
              further claims are isolated in scopes so they cannot leak into what
              the argument asserts. An agent that cites it inherits all of that —
              schemes, evidence, attack topology, scope boundaries, and current
              standing — rather than a URL.
            </p>
            <a
              href="https://isonomia.app/chains/cmpvvmxqk002s8c99uxmsho4v"
              target="_blank"
              rel="noreferrer"
              className="text-[12px] text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1 mt-2 font-medium"
            >
              <Link2 className="w-3 h-3" />
              View the live chain
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>
        </div>
      </div>

      {/* Positioning line */}
      {/* <div className="rounded-xl cardv2 bg-indigo-50 p-5">
        <p className="text-lg text-indigo-800 text-center leading-relaxed">
         
          <span className="font-medium text-indigo-800">
            Isonomia functions as the epistemic substrate for AI agents.
          </span>
        </p>
      </div> */}
    </section>
  );
}

function PillarsSection() {
  return (
    <section>
      <div className="mb-4 ">
        <h2 className="text-xl font-semibold text-slate-800">The six pillars</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          What an Isonomia permalink means when an LLM cites it.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {PILLARS.map((p) => {
          const Icon = p.icon;
          return (
            <div key={p.id} className="cardv2 bg-white h-full flex flex-col">
              <div className="p-2 ">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-xl bg-gradient-to-br ${p.color} ${p.iconColor} shrink-0`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold text-slate-400 font-mono">{p.label}</span>
                      <p className="font-semibold text-slate-900 text-[14px] leading-tight">{p.title}</p>
                    </div>
                  </div>
                  <StatusPill status={p.status} />
                </div>
                <p className="text-xs text-slate-500 mt-3 leading-snug">{p.body}</p>
              </div>
              {/* <div className="px-5 pb-5 flex-1">
                <ul className="space-y-1.5">
                  {p.evidence.map((e) => (
                    <li
                      key={e}
                      className="flex items-start gap-2 text-[12.5px] text-slate-600 leading-snug"
                    >
                      <div className="w-1 h-1 rounded-full bg-sky-400/70 flex-shrink-0 mt-[5px]" />
                      {e}
                    </li>
                  ))}
                </ul>
              </div> */}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TracksSection() {
  return (
    <section>
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-slate-800">Roadmap tracks</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Eight capability tracks, ordered by leverage. Each is independently shippable.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {TRACKS.map((t) => (
          <div
            key={t.letter}
            className="rounded-xl  cardv2  bg-white p-5"
          >
            <div className="flex items-baseline gap-3 mb-3">
              <span className="text-3xl font-bold text-slate-300 leading-none">
                {t.letter}
              </span>
              <h3 className="text-sm font-semibold text-slate-700">{t.name}</h3>
            </div>
            <ul className="space-y-2">
              {t.rows.map((r) => (
                <li key={r.id} className="flex items-start gap-2.5">
                  <span className="text-[10px] font-mono font-semibold text-slate-400 mt-0.5 w-7 shrink-0">
                    {r.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[13px] text-slate-700 leading-snug">
                        {r.title}
                      </span>
                      <StatusPill status={r.status} />
                    </div>
                    {r.note && (
                      <p className="text-[11px] text-slate-400 mt-0.5">{r.note}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function PermalinkExplainer() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <Globe className="w-4 h-4 text-slate-500" /> One URL, four representations
        </p>
        <p className="text-sm text-slate-600 leading-relaxed mb-4">
          The same permalink resolves differently depending on what asks for it.
          Browsers get HTML; LLM clients get the AIF subgraph; citation managers
          get JSON-LD; and the compact attestation envelope is one query
          parameter away.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { hdr: "Accept: text/html", body: "Human page (claim, premises, scheme, evidence)" },
            { hdr: "Accept: application/ld+json", body: "Rich JSON-LD: Claim + ScholarlyArticle + AIF + ClaimReview" },
            { hdr: "Accept: application/json", body: "AIF graph (RA + I-nodes, conflict, support)" },
            { hdr: "?format=attestation", body: "Compact citation envelope (the LLM unit)" },
          ].map((row) => (
            <div
              key={row.hdr}
              className="rounded-md border border-slate-200 bg-slate-50/60 p-3"
            >
              <p className="text-[11px] font-mono text-indigo-700 mb-1">{row.hdr}</p>
              <p className="text-[12px] text-slate-600 leading-snug">{row.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
        <p className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Hash className="w-4 h-4 text-slate-500" /> Content addressing
        </p>
        <p className="text-sm text-slate-600 leading-relaxed">
          Each argument&apos;s canonical AIF subgraph is sha256-hashed (sorted-keys JSON).
          The hash and version ride alongside the permalink in response headers and an
          immutable URL form, so a citation can pin to the exact state at retrieval time.
        </p>
        <CodeBlock language="http">
{`HTTP/1.1 200 OK
Content-Type: application/json
ETag: "sha256:7c1a4f0e2b9d…"
Link: </a/Bx7kQ2mN@7c1a4f0e2b9d8c6a5e4f3d2c1b0a9988>; rel="canonical"
X-Isonomia-Content-Hash: sha256:7c1a4f0e2b9d…
X-Isonomia-Permalink-Version: 3`}
        </CodeBlock>
        <p className="text-[12px] text-slate-500">
          The mutable form (<span className="font-mono text-slate-700">/a/Bx7kQ2mN</span>) follows
          edits; the immutable form
          (<span className="font-mono text-slate-700">/a/Bx7kQ2mN@&lt;hash&gt;</span>) is forever.
        </p>
      </div>
    </div>
  );
}

function AttestationExplainer() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-slate-500" /> The attestation envelope
        </p>
        <p className="text-sm text-slate-600 leading-relaxed">
          What an LLM should embed when it cites Isonomia. Verifiable, dated,
          and dialectically scored.
        </p>
      </div>
      <CodeBlock>{JSON.stringify(EXAMPLE_ATTESTATION, null, 2)}</CodeBlock>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-md border border-slate-200 bg-slate-50/60 p-3">
          <p className="text-[11px] uppercase font-semibold text-slate-500 tracking-wide mb-1">
            Argument-level provenance
          </p>
          <p className="text-[12px] text-slate-600 leading-snug">
            <span className="font-mono">contentHash</span> +{" "}
            <span className="font-mono">immutablePermalink</span> pin the exact
            graph state. <span className="font-mono">version</span> ratchets on
            each edit.
          </p>
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50/60 p-3">
          <p className="text-[11px] uppercase font-semibold text-slate-500 tracking-wide mb-1">
            Evidence-level provenance
          </p>
          <p className="text-[12px] text-slate-600 leading-snug">
            <span className="font-mono">contentSha256</span> proves what the
            source said when fetched.{" "}
            <span className="font-mono">archive.url</span> survives link rot.
          </p>
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50/60 p-3">
          <p className="text-[11px] uppercase font-semibold text-slate-500 tracking-wide mb-1">
            Dialectical state
          </p>
          <p className="text-[12px] text-slate-600 leading-snug">
            CQ counters, inbound attacks/supports,{" "}
            <span className="font-mono">testedness</span> bucket, and a{" "}
            <span className="font-mono">standingScore</span> that is{" "}
            <em>null</em> when there&apos;s no signal — never a misleading 1.0.
          </p>
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50/60 p-3">
          <p className="text-[11px] uppercase font-semibold text-slate-500 tracking-wide mb-1">
            Author
          </p>
          <p className="text-[12px] text-slate-600 leading-snug">
            Stable handle for downstream citation. Future:{" "}
            <span className="font-mono">Ed25519</span> signature wraps the
            envelope (Track D.1).
          </p>
        </div>
      </div>
    </div>
  );
}

function CounterCitationExplainer() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-5">
        <div className="flex items-start gap-3">
          <div className="p-1.5 rounded-lg bg-rose-100 text-rose-600 shrink-0">
            <Swords className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-rose-800">
              No other citation system ships its opposition
            </p>
            <p className="text-sm text-rose-700 mt-1 leading-relaxed">
              When an LLM calls <span className="font-mono">cite_argument</span>,
              the citation block arrives with the strongest known counter-argument
              <em> already attached</em>. There is no path to citing an Isonomia
              argument that hides what attacks it.
            </p>
          </div>
        </div>
      </div>
      <CodeBlock>{JSON.stringify(EXAMPLE_CITE, null, 2)}</CodeBlock>
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <Gauge className="w-4 h-4 text-slate-500" /> standingState — readable, not raw
        </p>
        <p className="text-sm text-slate-600 leading-relaxed mb-3">
          A naive consumer reading <span className="font-mono">standingScore: 1.0</span>{" "}
          might infer &quot;this argument has survived everything.&quot; That can be
          misleading: a scheme requiring zero critical questions, with no
          inbound traffic, would also produce 1.0. So we classify:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {[
            { state: "untested-default", note: "scheme requires no CQs, no inbound traffic — score is null", cls: "border-slate-200 bg-slate-50 text-slate-600" },
            { state: "untested-supported", note: "no attacks yet, but supports present", cls: "border-blue-200 bg-blue-50 text-blue-700" },
            { state: "tested-attacked", note: "inbound attacks exist, some CQ work has been done", cls: "border-amber-200 bg-amber-50 text-amber-700" },
            { state: "tested-undermined", note: "attacked, no CQs answered yet", cls: "border-rose-200 bg-rose-50 text-rose-700" },
            { state: "tested-survived", note: "CQs answered, no live attacks", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
          ].map((row) => (
            <div
              key={row.state}
              className={`rounded-md border p-3 ${row.cls}`}
            >
              <p className="text-[12px] font-mono font-semibold">{row.state}</p>
              <p className="text-[11px] mt-0.5 leading-snug opacity-90">{row.note}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AuthoringExplainer() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-sky-200 bg-sky-50/40 p-5">
        <div className="flex items-start gap-3">
          <div className="p-1.5 rounded-lg bg-sky-100 text-sky-700 shrink-0">
            <PenLine className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-sky-900">
              The MCP surface is bidirectional
            </p>
            <p className="text-sm text-sky-800/90 mt-1 leading-relaxed">
              Agents do more than read. Over the same graph and API that power
              the product, a model can propose a structured argument, build a
              branching argument chain, answer a scheme&apos;s critical
              questions, and challenge an answer it disputes. AI-authored
              contributions are flagged at the row level, and logical standing is
              gated on provenance and human ratification — model output never
              silently becomes knowledge.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-slate-500" /> Branching argument chains
        </p>
        <p className="text-sm text-slate-600 leading-relaxed mb-4">
          <span className="font-mono">propose_argument_chain</span> captures the
          real shape of a case rather than a flattened serial line. Several
          independent strands of evidence converge on a conclusion, and one
          premise can branch to feed more than one downstream claim. Each link
          carries its argumentation scheme, per-premise evidence anchored to a
          precise locator (page, figure, timestamp), and a Carneades premise type.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            {
              hdr: "Typed objection targets",
              body: "An objection wires against the right target — REBUTS a conclusion, UNDERMINES a premise, or UNDERCUTS the inference even when the premises hold.",
              icon: Swords,
            },
            {
              hdr: "Walled-off suppositions",
              body: "Counterfactual and hypothetical \u201cif X, then \u2026\u201d reasoning lives in scopes, so it cannot leak into what the chain asserts as fact (SCOPE_LEAK).",
              icon: Boxes,
            },
            {
              hdr: "Fork-proof threading",
              body: "A later link reuses a prior link\u2019s conclusion as a premise by claim id — a shared, content-hashed claim, not repeated text.",
              icon: Hash,
            },
            {
              hdr: "Idempotent writes",
              body: "A stable requestId makes a timed-out write retry-safe: the server replays the landed chain (idempotentReplay) rather than duplicating it.",
              icon: RefreshCw,
            },
          ].map((row) => {
            const Icon = row.icon;
            return (
              <div
                key={row.hdr}
                className="rounded-md border border-slate-200 bg-slate-50/60 p-3"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="w-3.5 h-3.5 text-sky-600" />
                  <p className="text-[12px] font-semibold text-slate-800">{row.hdr}</p>
                </div>
                <p className="text-[11px] text-slate-600 leading-snug">{row.body}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-sm font-semibold text-slate-700 mb-1 flex items-center gap-2">
          <Split className="w-4 h-4 text-slate-500" /> A real chain — peatland rewetting policy
        </p>
        <p className="text-sm text-slate-600 leading-relaxed mb-4">
          An agent posted a policy argument as a graph, not a paragraph: 11
          arguments, 9 connections, 3 levels deep. One keystone premise branches
          to feed two strands; five strands of evidence converge on the proposal;
          two objections are wired against different targets; two further claims
          are isolated in scopes so they cannot leak into what is asserted.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-md border border-emerald-200 bg-emerald-50/50 p-3">
            <p className="text-[11px] uppercase font-semibold tracking-wide text-emerald-700 mb-1">
              Converging strands → proposal
            </p>
            <ul className="text-[12px] text-slate-700 leading-snug space-y-1 list-disc pl-4">
              <li>Magnitude / leverage</li>
              <li>Cost-effectiveness</li>
              <li>Robust co-benefits</li>
              <li>Design rationale (water-table band)</li>
              <li>Funding / feasibility (CAP reallocation)</li>
            </ul>
          </div>
          <div className="rounded-md border border-rose-200 bg-rose-50/50 p-3">
            <p className="text-[11px] uppercase font-semibold tracking-wide text-rose-700 mb-1">
              Objections, by target
            </p>
            <ul className="text-[12px] text-slate-700 leading-snug space-y-1.5">
              <li>
                <span className="font-mono text-rose-700">UNDERCUTS</span> —
                land-use displacement severs the inference from on-site savings to
                net benefit.
              </li>
              <li>
                <span className="font-mono text-rose-700">UNDERMINES</span> —
                methane re-establishment lowers the cost-effectiveness premise.
              </li>
            </ul>
            <p className="text-[11px] text-slate-500 mt-2">
              Two claims walled off in{" "}
              <span className="font-mono">COUNTERFACTUAL</span> /{" "}
              <span className="font-mono">HYPOTHETICAL</span> scopes.
            </p>
          </div>
        </div>
      </div>
      <CodeBlock>{JSON.stringify(EXAMPLE_CHAIN, null, 2)}</CodeBlock>

      <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-5">
        <p className="text-sm font-semibold text-emerald-900 mb-2 flex items-center gap-2">
          <ListChecks className="w-4 h-4 text-emerald-700" /> answer_critical_question — self-canonicalising
        </p>
        <p className="text-sm text-emerald-800/90 leading-relaxed">
          Every scheme ships with critical questions — the standard challenges its
          inference must survive. Answering one submits grounds against a specific{" "}
          <span className="font-mono">cqKey</span>. When the answering{" "}
          <span className="font-mono">sessionId</span> matches the session that
          created the argument, the answer self-canonicalises in a single
          transaction; otherwise it is recorded as a pending proposal a human
          approves. Writes are idempotent on{" "}
          <span className="font-mono">requestId</span>.
        </p>
      </div>
      <CodeBlock>{JSON.stringify(EXAMPLE_CQ_ANSWER, null, 2)}</CodeBlock>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {[
          {
            state: "CANONICAL",
            note: "sessionId matched the creating session — promoted directly, responseStatus CANONICAL, cqStatusEnum SATISFIED",
            cls: "border-emerald-200 bg-emerald-50 text-emerald-700",
          },
          {
            state: "PENDING",
            note: "different/absent session or a human-authored target — recorded as a proposal (CQ_SELF_CANONICAL_DENIED), never a hard error",
            cls: "border-amber-200 bg-amber-50 text-amber-700",
          },
        ].map((row) => (
          <div key={row.state} className={`rounded-md border p-3 ${row.cls}`}>
            <p className="text-[12px] font-mono font-semibold">{row.state}</p>
            <p className="text-[11px] mt-0.5 leading-snug opacity-90">{row.note}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-5">
        <p className="text-sm font-semibold text-rose-900 mb-2 flex items-center gap-2">
          <Swords className="w-4 h-4 text-rose-700" /> challenge_critical_question — contest an answer
        </p>
        <p className="text-sm text-rose-800/90 leading-relaxed">
          Challenging an already-answered CQ files a typed attack edge against the
          canonical answer and flips it{" "}
          <span className="font-mono">SATISFIED → DISPUTED</span>. There is no
          self-canonical floor — challenging is not a self-discharging act, so any
          caller files on equal footing, the original author included. The attack
          type is never inferred: <span className="font-mono">REBUT</span>,{" "}
          <span className="font-mono">UNDERMINE</span>, or{" "}
          <span className="font-mono">UNDERCUT</span> — and an{" "}
          <span className="font-mono">UNDERMINE</span> must cite evidence.
        </p>
      </div>
      <CodeBlock>{JSON.stringify(EXAMPLE_CQ_CHALLENGE, null, 2)}</CodeBlock>
    </div>
  );
}

interface LiveResult {
  argumentId: string;
  permalink: string;
  shortCode: string;
  version: number;
  text: string;
  conclusion: { claimId: string; moid: string; text: string } | null;
  scheme: { key: string; name: string; title?: string } | null;
  accessCount: number;
  createdAt: string | null;
  attestationUrl: string;
  dialecticalFitness?: number;
}

function LiveVerification() {
  const [results, setResults] = useState<LiveResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ count: number; sort: string; fetchedAt: string } | null>(
    null
  );

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        "/api/v3/search/arguments?sort=dialectical_fitness&limit=3",
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setResults(json.results ?? []);
      setMeta({
        count: json.count ?? 0,
        sort: json.query?.sort ?? "recent",
        fetchedAt: new Date().toISOString(),
      });
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setResults(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 shrink-0">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-800">
                Live call against this server
              </p>
              <p className="text-sm text-emerald-700 mt-1 leading-relaxed">
                Hits{" "}
                <span className="font-mono text-[12px] bg-white/60 px-1.5 py-0.5 rounded border border-emerald-200">
                  GET /api/v3/search/arguments?sort=dialectical_fitness&amp;limit=3
                </span>{" "}
                and renders the top three. Each row links to the live
                permalink and to its attestation envelope.
              </p>
            </div>
          </div>
          <button
            onClick={run}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            {results === null ? "Run live query" : loading ? "Fetching…" : "Re-run"}
          </button>
        </div>
        {meta && (
          <p className="text-[11px] text-emerald-600 mt-3 font-mono">
            sort={meta.sort} · count={meta.count} · {meta.fetchedAt}
          </p>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-[12px] text-rose-700">
          <span className="font-semibold">Fetch failed:</span> {error}
        </div>
      )}

      {results && results.length === 0 && !loading && (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-[13px] text-slate-600">
          No public arguments returned. Seed a showcase chain via{" "}
          <span className="font-mono">scripts/seed-showcase-chain.ts</span>.
        </div>
      )}

      {results && results.length > 0 && (
        <div className="space-y-3">
          {results.map((r, i) => (
            <div
              key={r.argumentId}
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {r.scheme && (
                      <span className="text-[10px] uppercase font-semibold tracking-wide text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded">
                        {r.scheme.name}
                      </span>
                    )}
                    {typeof r.dialecticalFitness === "number" && (
                      <span className="text-[10px] uppercase font-semibold tracking-wide text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded">
                        fitness {r.dialecticalFitness.toFixed(2)}
                      </span>
                    )}
                    <span className="text-[10px] font-mono text-slate-400">
                      v{r.version} · {r.shortCode}
                    </span>
                  </div>
                  {r.conclusion && (
                    <p className="text-[13px] text-slate-800 font-medium leading-snug mb-1">
                      {r.conclusion.text}
                    </p>
                  )}
                  {r.text && r.text !== r.conclusion?.text && (
                    <p className="text-[12px] text-slate-500 leading-snug line-clamp-2">
                      {r.text}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <a
                      href={r.permalink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1"
                    >
                      <Link2 className="w-3 h-3" />
                      permalink
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                    <a
                      href={r.attestationUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1"
                    >
                      <ShieldCheck className="w-3 h-3" />
                      attestation
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                    {r.accessCount > 0 && (
                      <span className="text-[11px] text-slate-400 font-mono">
                        {r.accessCount} accesses
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {results === null && !loading && !error && (
        <p className="text-[12px] text-slate-500 italic">
          Click <span className="font-semibold">Run live query</span> to call
          the local API. Nothing is fetched on page load.
        </p>
      )}
    </div>
  );
}

function McpExplainer() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <PlugZap className="w-4 h-4 text-slate-500" /> Argument primitive — 6 tools
        </p>
        <p className="text-sm text-slate-600 leading-relaxed mb-4">
          The MCP server is a stateless wrapper over the public API.
          Installable into Claude Desktop, Cursor, Cline, Continue, or any
          MCP-speaking client in three lines of config.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { name: "search_arguments", desc: "Free-text search; supports sort=dialectical_fitness", icon: Search },
            { name: "get_argument", desc: "Full attestation envelope by permalink", icon: FileJson },
            { name: "get_claim", desc: "Claim by MOID + supporting permalinks", icon: Quote },
            { name: "find_counterarguments", desc: "Counter-arguments for a target claim; honest-empty", icon: Swords },
            { name: "cite_argument", desc: "Citation block + strongest objection + provenance counters", icon: Award },
            { name: "propose_argument", desc: "Create a new argument (token-gated)", icon: MessageCircle },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <div
                key={t.name}
                className="rounded-md border border-slate-200 bg-slate-50/60 p-3"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="text-[12px] font-mono font-semibold text-slate-800">
                    {t.name}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-snug">{t.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
      <div className="rounded-xl border border-sky-200 bg-sky-50/30 p-5">
        <p className="text-sm font-semibold text-sky-900 mb-3 flex items-center gap-2">
          <PenLine className="w-4 h-4 text-sky-700" /> Authoring & dialectic — write surface
        </p>
        <p className="text-sm text-sky-800/90 leading-relaxed mb-4">
          The graph is writable. Agents propose structure, chain it, answer the
          scheme&apos;s critical questions, and challenge answers — all under
          row-level AI provenance and human-ratified standing.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { name: "propose_structured_argument", desc: "Create an argument with explicit premises + scheme; per-premise evidence (token-gated)", icon: FileJson },
            { name: "propose_argument_chain", desc: "Branching DAG: convergent strands, typed objections, walled-off scopes, fork-proof threading", icon: GitBranch },
            { name: "answer_critical_question", desc: "Answer a scheme CQ; self-canonicalises when sessionId matches the creating session", icon: ListChecks },
            { name: "challenge_critical_question", desc: "Contest an answered CQ; files a typed attack and flips SATISFIED \u2192 DISPUTED", icon: Swords },
            { name: "propose_warrant", desc: "Attach an inference-license warrant to an argument (AI-authored, awaiting ratification)", icon: Workflow },
            { name: "resolve_citation", desc: "Auto-Citation Engine: URL/DOI \u2192 verified Source row with provenance + archive fallback", icon: Library },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <div
                key={t.name}
                className="rounded-md border border-sky-200/80 bg-white/80 p-3"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="w-3.5 h-3.5 text-sky-700" />
                  <span className="text-[12px] font-mono font-semibold text-slate-800">
                    {t.name}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-snug">{t.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
      <div className="rounded-xl border border-amber-200 bg-amber-50/30 p-5">
        <p className="text-sm font-semibold text-amber-900 mb-3 flex items-center gap-2">
          <Eye className="w-4 h-4 text-amber-700" /> Deliberation primitive — 7 new tools
        </p>
        <p className="text-sm text-amber-800/90 leading-relaxed mb-4">
          The deliberation-scope substrate is exposed over the same MCP
          surface. These tools let an LLM ask <em>&quot;is this debate ready to
          summarise?&quot;</em> before it tries to.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { name: "get_deliberation_fingerprint", desc: "Counts, depth, CQ coverage, AI-vs-human extraction split", icon: Fingerprint },
            { name: "get_contested_frontier", desc: "Unanswered undercuts/undermines/CQs + terminal leaves", icon: Swords },
            { name: "get_missing_moves", desc: "Per-argument + rollup audit of structurally missing moves", icon: ListChecks },
            { name: "get_chains", desc: "Inference chains projected from the graph + weakestLink", icon: GitBranch },
            { name: "get_synthetic_readout", desc: "Editorial primitive: deterministic honestyLine + refusalSurface", icon: BookMarked },
            { name: "summarize_debate", desc: "Refusal-aware narrative; refuses with cited blockers when not ready", icon: MessageSquare },
            { name: "get_cross_context", desc: "Cross-deliberation acceptance: consistent-IN / OUT / contested", icon: Network },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <div
                key={t.name}
                className="rounded-md border border-amber-200/80 bg-white/80 p-3"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="w-3.5 h-3.5 text-amber-700" />
                  <span className="text-[12px] font-mono font-semibold text-slate-800">
                    {t.name}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-snug">{t.desc}</p>
              </div>
            );
          })}
        </div>
        <div className="mt-4 rounded-md border border-amber-200/70 bg-white/60 p-3">
          <p className="text-[11px] uppercase font-semibold tracking-wide text-amber-800 mb-1.5">
            HTTP equivalents
          </p>
          <ul className="text-[11px] font-mono text-slate-700 space-y-0.5">
            <li>GET /api/v3/deliberations/&#123;id&#125;/fingerprint</li>
            <li>GET /api/v3/deliberations/&#123;id&#125;/frontier</li>
            <li>GET /api/v3/deliberations/&#123;id&#125;/missing-moves</li>
            <li>GET /api/v3/deliberations/&#123;id&#125;/chains</li>
            <li>GET /api/v3/deliberations/&#123;id&#125;/synthetic-readout</li>
            <li>GET /api/v3/deliberations/&#123;id&#125;/cross-context</li>
          </ul>
        </div>
      </div>
      <div className="rounded-xl border border-violet-200 bg-violet-50/30 p-5">
        <p className="text-sm font-semibold text-violet-900 mb-3 flex items-center gap-2">
          <Workflow className="w-4 h-4 text-violet-700" /> Ludics substrate — 14 new tools
        </p>
        <p className="text-sm text-violet-800/90 leading-relaxed mb-4">
          The generative substrate exposes the dialectical structure beneath deliberations: incarnation lattices, witnessing records, fossil transcripts, and a briefing-fingerprint for agent staleness detection. These tools give LLMs the algebraic layer of the argument graph, not just the graph surface.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { name: "bind_participant_to_design", desc: "Write seam: bind a witnessing act to a Ludics move (I1–I4 invariants, token-gated)", icon: Lock },
            { name: "get_witnesses", desc: "Witnessing record for a Ludics move; anonymous by default (T4)", icon: Eye },
            { name: "get_unwitnessed_exposure", desc: "Unaddressed structural objections filtered by stratum (witnessable / latent / all)", icon: Search },
            { name: "get_instantiation", desc: "Which Ludics node does a dialogue act commit to? Partiality + delocation flag", icon: Waypoints },
            { name: "get_deliberation_schema", desc: "Locus tree for D_P + witnessing summary (walkedLoci / coverageRatio / openExposurePoints)", icon: Database },
            { name: "get_behaviour_at_locus", desc: "All incarnations at a locus with fitness scores and stratum labels", icon: Target },
            { name: "get_exposure_map", desc: "Full exposure map: walked / witnessable / latent strata + hub-set topology", icon: Network },
            { name: "get_articulation_lattice", desc: "Art(B) DAG with per-cone minima + inclusion edges (Inc(B) is antichain post-2e)", icon: GitBranch },
            { name: "find_minimal_incarnations", desc: "Antichain of cone minima in Inc(B) — one minimum-commitment design per cone", icon: Layers },
            { name: "find_equivalent_articulations", desc: "Biorthogonal equivalence class of a design: other ways to say the same thing", icon: RefreshCw },
            { name: "find_substitute_premises", desc: "Incarnations that reach the same conclusion without dropped premises", icon: Workflow },
            { name: "compress_articulation", desc: "Meet D₁ ∧ D₂ in Art(B), per-cone (Phase 2e: partial in B; cross-cone returns 200 with kind: 'cross-cone-rejected')", icon: Hash },
            { name: "compute_articulation_join", desc: "Synthesis D₁ ∨_⊥⊥ D₂ within a cone (Phase 2f Reading A: literal union, closureSteps=0; cross-cone returns 200 with kind: 'cross-cone-rejected')", icon: Boxes },
            { name: "get_fossil_record", desc: "Retraction history with locus back-pointers; fossilizedAt + retractLayer + retractReason (free-text)", icon: BookMarked },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <div
                key={t.name}
                className="rounded-md border border-violet-200/80 bg-white/80 p-3"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="w-3.5 h-3.5 text-violet-700" />
                  <span className="text-[12px] font-mono font-semibold text-slate-800">
                    {t.name}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-snug">{t.desc}</p>
              </div>
            );
          })}
        </div>
        <div className="mt-4 rounded-md border border-violet-200/70 bg-white/60 p-3">
          <p className="text-[11px] uppercase font-semibold tracking-wide text-violet-800 mb-1.5">
            HTTP equivalents (selection)
          </p>
          <ul className="text-[11px] font-mono text-slate-700 space-y-0.5">
            <li>POST /api/v3/ludics/bind-witness</li>
            <li>GET /api/v3/ludics/witnesses?ludicMoveId=&#123;id&#125;</li>
            <li>GET /api/v3/ludics/fossil-record?deliberationId=&#123;id&#125;</li>
            <li>GET /api/v3/deliberations/&#123;id&#125;/briefing-fingerprint</li>
            <li>GET /api/v3/deliberations/&#123;id&#125;/briefing-fingerprint/check?hash=sha256:…</li>
            <li>GET /api/v3/behaviours/&#123;id&#125;/articulation-lattice</li>
          </ul>
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <Terminal className="w-4 h-4 text-slate-500" /> Claude Desktop config
        </p>
        <CodeBlock language="json">{`{
  "mcpServers": {
    "isonomia": {
      "command": "node",
      "args": ["/abs/path/to/packages/isonomia-mcp/dist/server.js"],
      "env": {
        "ISONOMIA_BASE_URL": "https://isonomia.app",
        "ISONOMIA_API_TOKEN": "<optional, only for propose_argument>"
      }
    }
  }
}`}</CodeBlock>
      </div>
    </div>
  );
}

function LudicsSubstrateTab() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-5">
        <div className="flex items-start gap-3">
          <div className="p-1.5 rounded-lg bg-violet-100 text-violet-700 shrink-0">
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-violet-900">
              Substrate v2.5 — typed, scoped, replayable
            </p>
            <p className="text-sm text-violet-800/90 mt-1 leading-relaxed">
              Phase 1 shipped the read model: witnessing, fossils, articulation
              lattice. Phase 2 hardened the perimeter and made the substrate
              observable from outside. Every binding act on the substrate now
              (a) writes through a deliberation-scoped JWT, (b) is rate-limited
              on a compound key, and (c) emits a typed announcement that is
              persisted in Postgres and dispatched at-least-once via BullMQ.
              v2.5 retired the last <span className="font-mono">console.info</span>{" "}
              dual-emit and the legacy shared bearer; the bus is now the sole channel.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <Radio className="w-4 h-4 text-slate-500" /> Announcement envelope (A1–A4)
        </p>
        <p className="text-sm text-slate-600 leading-relaxed mb-3">
          Four event types map onto Ludics&apos; four axioms — A1 commit, A2 reveal,
          A3 contest, A4 retract — and ride a single Zod-validated envelope.
          Idempotency key is the triple{" "}
          <span className="font-mono">(eventType, subjectId, occurredAt)</span>;
          subscribers must dedupe.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
          {[
            { type: "witness_committed", axiom: "A1", note: "new WitnessRecord persisted at a locus" },
            { type: "design_revealed", axiom: "A2", note: "first published synthesis (same-cone-join)" },
            { type: "witness_contested", axiom: "A3", note: "counter-witness bound to the same locus" },
            { type: "witness_rescinded", axiom: "A4", note: "witness retracted → fossil emitted" },
          ].map((e) => (
            <div key={e.type} className="rounded-md border border-violet-200/70 bg-violet-50/40 p-2.5">
              <p className="text-[10px] uppercase font-semibold tracking-wide text-violet-700">{e.axiom}</p>
              <p className="text-[12px] font-mono font-semibold text-slate-800 mt-0.5">{e.type}</p>
              <p className="text-[11px] text-slate-600 leading-snug mt-0.5">{e.note}</p>
            </div>
          ))}
        </div>
        <CodeBlock>{JSON.stringify(EXAMPLE_ANNOUNCEMENT, null, 2)}</CodeBlock>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <Lock className="w-4 h-4 text-slate-500" /> Scoped session token (JWT claims)
        </p>
        <p className="text-sm text-slate-600 leading-relaxed mb-3">
          Every write to the substrate (bind / propose / retract) verifies a
          short-lived JWT signed with{" "}
          <span className="font-mono">LUDICS_JWT_SIGNING_KEY</span>. The token&apos;s{" "}
          <span className="font-mono">scope.deliberationId</span> must match
          the request body — a mismatch returns{" "}
          <span className="font-mono">403 SCOPE_MISMATCH</span>, an expired token returns{" "}
          <span className="font-mono">401 EXPIRED_TOKEN</span>. There is no tenant
          axis in this repo (WS-0 audit), so the scope unit is the
          deliberation itself.
        </p>
        <CodeBlock>{JSON.stringify(EXAMPLE_SCOPED_JWT_CLAIMS, null, 2)}</CodeBlock>
        <p className="text-[11px] text-slate-500 mt-3">
          Mint locally via{" "}
          <span className="font-mono">
            npx tsx scripts/mintMcpToken.ts --deliberation &lt;id&gt; --participant &lt;id&gt; --ttl 3600
          </span>.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-slate-500" /> Production-readiness invariants (§6.6 suite)
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { hdr: "Fingerprint cache (WS-1)", body: "Postgres truth + Upstash read-through; cold-miss writes Redis; recordFingerprint invalidates; two PrismaClient instances converge." },
            { hdr: "Compound rate-limit (WS-2)", body: "(deliberationId, participantId) + (deliberationId, IP) buckets; cross-deliberation isolation; Retry-After header set on 429." },
            { hdr: "Scoped JWT (WS-3)", body: "Valid token + matching scope → 200; wrong deliberationId → 403; expired → 401; unparseable bearer → 401 INVALID_TOKEN." },
            { hdr: "Announcement bus (A1–A4)", body: "Envelope shape · idempotency on (eventType,subjectId,occurredAt) · replay-from-Postgres · dispatcher retries · DLQ on terminal failure." },
          ].map((row) => (
            <div key={row.hdr} className="rounded-md border border-slate-200 bg-slate-50/60 p-3">
              <p className="text-[11px] uppercase font-semibold text-slate-500 tracking-wide mb-1">{row.hdr}</p>
              <p className="text-[12px] text-slate-600 leading-snug">{row.body}</p>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-slate-500 mt-3 font-mono">
          npx jest __tests__/invariants __tests__/eval · 22 suites · 390 tests + 1 todo at v2.5 cutover
        </p>
      </div>

      <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-5">
        <p className="text-sm font-semibold text-emerald-900 mb-2 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-700" /> v2.5 cutover — sole-channel emit
        </p>
        <ul className="text-[12px] text-emerald-900/90 leading-relaxed space-y-1 list-disc pl-5">
          <li>
            Removed the{" "}
            <span className="font-mono">console.info({"{ event: \"witness_rescinded\", … }"})</span>{" "}
            dual-emit from <span className="font-mono">app/api/v3/ludics/retract-witness/route.ts</span> —
            the bus is the only channel.
          </li>
          <li>
            Dropped <span className="font-mono">LUDICS_LEGACY_BEARER</span> and the legacy{" "}
            <span className="font-mono">MCP_API_TOKEN</span> branch in{" "}
            <span className="font-mono">server/ludics/auth.ts</span>. Resolution is now
            (1) Bearer → scoped JWT, (2) Session cookie.
          </li>
          <li>
            JWT-failure catch re-throws the precise{" "}
            <span className="font-mono">LudicsAuthError</span> code
            (<span className="font-mono">SCOPE_MISMATCH</span> /{" "}
            <span className="font-mono">EXPIRED_TOKEN</span> /{" "}
            <span className="font-mono">INVALID_TOKEN</span>) instead of silently collapsing.
          </li>
          <li>
            The <span className="font-mono">MCP_API_TOKEN</span> env var itself is preserved —
            it is still consumed by <span className="font-mono">lib/citation/mcpAuth.ts</span>{" "}
            and the isonomia MCP OpenAPI surface (non-ludics).
          </li>
        </ul>
      </div>
    </div>
  );
}

function FlowExplainer() {
  const steps = [
    {
      n: 1,
      title: "User asks an LLM about a contested issue",
      body: '"Are GLP-1 medications safe for long-term use?" → LLM identifies key claims and formulates a search query',
      icon: HelpCircle,
    },
    {
      n: 2,
      title: "LLM searches Isonomia via MCP",
      body: "search_arguments(query, sort='dialectical_fitness') → ranked permalinks with attestation URLs",
      icon: Search,
    },
    {
      n: 3,
      title: "LLM fetches attestation envelopes",
      body: "get_argument(permalink) → AIF subgraph + content hash + dialectical state + provenance",
      icon: FileJson,
    },
    {
      n: 4,
      title: "LLM cites with the counter attached",
      body: "cite_argument(permalink) → markdown citation + standingState + strongestObjection",
      icon: Quote,
    },
    {
      n: 5,
      title: "User can verify, audit, and contest",
      body: "Click the immutable @hash URL → the exact state at citation time. File a counter-argument via propose_argument.",
      icon: ShieldCheck,
    },
  ];
  return (
    <div className="space-y-3">
      {steps.map((s) => {
        const Icon = s.icon;
        return (
          <div
            key={s.n}
            className="flex items-start gap-4 rounded-xl cardv2 p-4"
          >
            <div className="flex flex-col items-center gap-1 shrink-0">
              <span className="w-8 h-8 rounded-full bg-indigo-600 text-white text-sm font-semibold flex items-center justify-center">
                {s.n}
              </span>
              {s.n < steps.length && <span className="w-px h-6 bg-slate-200" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Icon className="w-4 h-4 text-slate-500" />
                <p className="text-sm font-semibold text-slate-800">{s.title}</p>
              </div>
              <p className="text-[13px] text-slate-600 leading-relaxed">{s.body}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

function WidgetLoading({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-[12px] text-slate-500">
      Loading <span className="font-mono">{label}</span>…
    </div>
  );
}

function DeliberationReadoutTab() {
  const [pendingId, setPendingId] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-5">
        <div className="flex items-start gap-3">
          <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700 shrink-0">
            <Eye className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-900">
              Deliberation readiness — the layer above the citation primitive
            </p>
            <p className="text-sm text-amber-800/90 mt-1 leading-relaxed">
              The Pt. 4 substrate publishes a structural fingerprint, a
              contested frontier, a missing-moves audit, chain fragility, and
              cross-deliberation acceptance for any deliberation in the
              system. The widgets below mount the same primitives that ship
              inside DeepDive and the embeddable widget. Paste a deliberation
              id to see live data.
            </p>
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <input
                type="text"
                value={pendingId}
                onChange={(e) => setPendingId(e.target.value)}
                placeholder="deliberationId (uuid or slug)"
                className="flex-1 min-w-[240px] px-3 py-1.5 rounded-md border border-amber-300 bg-white text-[12px] font-mono text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <button
                onClick={() => setActiveId(pendingId.trim() || null)}
                disabled={!pendingId.trim()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Mount widgets
              </button>
              {activeId && (
                <button
                  onClick={() => setActiveId(null)}
                  className="text-[11px] text-amber-700 hover:text-amber-900 underline"
                >
                  unmount
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {activeId ? (
        <div className="space-y-4">
          <div>
            <p className="text-[11px] uppercase font-semibold tracking-wide text-slate-500 mb-2 flex items-center gap-1.5">
              <Fingerprint className="w-3 h-3" /> DeliberationStateCard
            </p>
            <DeliberationStateCard deliberationId={activeId} />
          </div>
          <div>
            <p className="text-[11px] uppercase font-semibold tracking-wide text-slate-500 mb-2 flex items-center gap-1.5">
              <Swords className="w-3 h-3" /> FrontierLane
            </p>
            <FrontierLane deliberationId={activeId} />
          </div>
        </div>
      ) : (
        <p className="text-[12px] text-slate-500 italic">
          No widgets mounted. Paste a deliberation id and click{" "}
          <span className="font-semibold">Mount widgets</span> to fetch live
          synthetic-readout + frontier data.
        </p>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
        <p className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-slate-500" /> Honesty invariants
        </p>
        <ul className="text-[12px] text-slate-600 leading-relaxed space-y-1.5 list-disc pl-5">
          <li>
            <span className="font-mono text-slate-800">honestyLine</span> is a
            deterministic template — no generative prose. The same fingerprint
            always renders the same string.
          </li>
          <li>
            <span className="font-mono text-slate-800">refusalSurface.blockerIds</span>{" "}
            cite real graph node ids. <span className="font-mono">summarize_debate</span>{" "}
            refuses with these citations rather than confabulating.
          </li>
          <li>
            <span className="font-mono text-slate-800">articulationOnly</span>{" "}
            chip is gated by 30-day rolling{" "}
            <span className="font-mono">AiDraftEngagement</span> — it only
            appears when humans have not actually engaged with AI-seeded
            drafts.
          </li>
          <li>
            Cross-deliberation aggregation rule:{" "}
            <span className="font-mono">consistent-IN</span> /{" "}
            <span className="font-mono">consistent-OUT</span> /{" "}
            <span className="font-mono">contested</span> /{" "}
            <span className="font-mono">undecided</span> — no implicit
            majority-wins.
          </li>
          <li>
            <span className="font-mono text-slate-800">DeliberationFingerprintCache</span>{" "}
            keyed by <span className="font-mono">contentHash</span> — cache
            hit is O(1); SWR dedupes within 30s.
          </li>
        </ul>
      </div>

      <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-5">
        <p className="text-sm font-semibold text-indigo-900 flex items-center gap-2">
          <Waypoints className="w-4 h-4 text-indigo-700" /> Embeddable surface
        </p>
        <p className="text-sm text-indigo-800/90 mt-1 leading-relaxed">
          The same primitives are wired into{" "}
          <a
            href="/test/embeddable-widget-pt4"
            className="underline font-semibold hover:text-indigo-900"
          >
            /test/embeddable-widget-pt4
          </a>{" "}
          (IsonomiaWidget §6) so any host page can render a deliberation
          readout in an iframe.
        </p>
      </div>
    </div>
  );
}

const ROUTES = [
  { method: "GET", path: "/a/{shortCode}", description: "Content-negotiated permalink (HTML / JSON-LD / AIF / attestation)", tag: "Page" },
  { method: "GET", path: "/a/{shortCode}@{hash}", description: "Immutable, content-addressed permalink", tag: "Page" },
  { method: "GET", path: "/api/v3/search/arguments", description: "Hybrid retrieval; ?sort=dialectical_fitness re-rank", tag: "API" },
  { method: "GET", path: "/api/v3/arguments/{shortCode}/attestation", description: "Compact citation envelope (the LLM unit)", tag: "API" },
  { method: "GET", path: "/api/v3/deliberations/{id}/synthetic-readout", description: "Deterministic readout + refusalSurface (real node ids)", tag: "API" },
  { method: "GET", path: "/api/v3/deliberations/{id}/fingerprint", description: "Structural fingerprint (counts, depth, CQ coverage)", tag: "API" },
  { method: "GET", path: "/api/v3/ludics/fossil-record", description: "Retraction history with locus back-pointers", tag: "API" },
  { method: "GET", path: "/api/v3/docs", description: "OpenAPI 3.1 spec (Scalar UI)", tag: "API" },
  { method: "MCP", path: "cite_argument", description: "Citation block + strongest objection + provenance counters", tag: "MCP" },
  { method: "MCP", path: "propose_argument_chain", description: "Branching chain: convergent strands, typed objections, walled-off scopes", tag: "MCP" },
  { method: "MCP", path: "answer_critical_question", description: "Answer a scheme CQ; self-canonicalises on a matching session", tag: "MCP" },
  { method: "MCP", path: "challenge_critical_question", description: "Contest an answered CQ; flips SATISFIED \u2192 DISPUTED", tag: "MCP" },
  { method: "MCP", path: "get_synthetic_readout", description: "Editorial primitive: deterministic honestyLine + refusalSurface", tag: "MCP" },
  { method: "MCP", path: "summarize_debate", description: "Refusal-aware narrative; refuses with cited blockers when not ready", tag: "MCP" },
  { method: "MCP", path: "bind_participant_to_design", description: "Write seam: scoped JWT + rate-limit + announcement bus (A1)", tag: "MCP" },
];

export default function AIEpistemicInfrastructurePage() {
  const [tab, setTab] = useState("permalink");
  return (
    <TooltipProvider>
      <div
        className="min-h-screen"
        style={{
          background:
            "linear-gradient(145deg, #f5faff 0%, #eef5ff 25%, #faf6ff 60%, #fff6f8 100%)",
        }}
      >
        {/* Sticky header */}
        <div
          className="border-b-2 border-indigo-500/[0.07] bg-white/35 backdrop-blur-xl sticky top-0 z-40 px-6 py-3"
          style={{
            boxShadow:
              "0 1px 3px rgba(99,102,241,0.06), 0 4px 16px -8px rgba(99,102,241,0.08)",
          }}
        >
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600">
                  <Cpu className="w-5 h-5 text-white" />
                </div>
                Isonomia for AI Epistemic Infrastructure
              </h1>
             
            </div>
            
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
         

          {/* About */}
          <AboutSection />
 {/* Strategic context banner */}
          <div className="rounded-xl surfacev2 bg-gradient-to-r from-indigo-50 via-violet-50 to-pink-50 border border-indigo-400/80 p-5">
            <div className="flex items-start gap-4">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shrink-0">
                <Target className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900 mb-1">
                  What an Isonomia citation contains
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  A standard web citation resolves to an HTML page: the
                  underlying claim, evidence, and counter-arguments are not
                  addressable, hashed, or typed. An Isonomia permalink
                  resolves to an AIF subgraph that includes the claim, its
                  premises and inference scheme, sha256-addressed evidence,
                  a dialectical standing value, and the highest-ranked known
                  counter-argument. The same resource is served over
                  content-negotiated HTTP and MCP, and returns an explicit
                  &quot;not yet&quot; state when no signal is available.
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {[
                    { label: "Content-negotiated permalinks", color: "bg-indigo-100 text-indigo-700" },
                    { label: "AIF + JSON-LD + Schema.org", color: "bg-violet-100 text-violet-700" },
                    { label: "sha256 content addressing", color: "bg-fuchsia-100 text-fuchsia-700" },
                    { label: "archive.org snapshots", color: "bg-amber-100 text-amber-700" },
                    { label: "MCP (~40 tools)", color: "bg-teal-100 text-teal-700" },
                    { label: "Counter-citation by default", color: "bg-rose-100 text-rose-700" },
                    { label: "Honest-empty failure mode", color: "bg-emerald-100 text-emerald-700" },
                    { label: "Dialectical-fitness re-rank", color: "bg-yellow-100 text-yellow-700" },
                    { label: "Deterministic synthetic readout", color: "bg-amber-100 text-amber-800" },
                    { label: "Cross-deliberation aggregation", color: "bg-sky-100 text-sky-700" },
                    { label: "Ludics bus (A1–A4)", color: "bg-violet-100 text-violet-700" },
                    { label: "Deliberation-scoped JWT", color: "bg-pink-100 text-pink-700" },
                    { label: "Bidirectional write surface", color: "bg-sky-100 text-sky-700" },
                    { label: "Branching argument chains", color: "bg-indigo-100 text-indigo-700" },
                    { label: "Self-canonicalising CQ answers", color: "bg-lime-100 text-lime-700" },
                    { label: "Human-ratified standing", color: "bg-purple-100 text-purple-700" },
                  ].map((chip) => (
                    <span
                      key={chip.label}
                      className={`text-xs font-medium px-2.5 py-1 rounded-full ${chip.color}`}
                    >
                      {chip.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
          {/* Pillars */}
          <PillarsSection />

          {/* End-to-end flow */}
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-slate-800">
                Example Flow
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">
                What an LLM does when a user asks about a contested issue with the Isonomia MCP server installed.
              </p>
            </div>
            <FlowExplainer />
          </section>

           {/* Audience callout */}
          <section className="rounded-xl bg-white/50 boder-white border  shadow-sm shadow-indigo-400   p-5">
            <p className="text-[16px] font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <Boxes className="w-4 h-4 text-slate-700" /> Three audiences converge here
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  who: "Scalable-oversight researchers",
                  examples: "Schmidt Sciences, OpenPhil, ARIA, Anthropic Society & Alignment, METR",
                  need: "Argument-shaped artifacts that humans and AIs can co-evaluate",
                },
                {
                  who: "Retrieval-augmented LLM builders",
                  examples: "Perplexity, You, OpenAI, Anthropic, Google",
                  need: "Citations that point at adjudicated reasoning, not prose",
                },
                {
                  who: "Fact-checking & journalism",
                  examples: "ClaimReview consortium, Google Fact Check, IFCN signatories",
                  need: "Schema.org primitives backed by structured arguments at scale",
                },
              ].map((a) => (
                <div
                  key={a.who}
                  className="bg-white cardv2  p-3"
                >
                  <p className="text-[14px] font-semibold text-slate-800">{a.who}</p>
                  <p className="text-[14px] text-slate-700 mt-1 italic">{a.examples}</p>
                  <p className="text-[14px] text-slate-600 mt-2 leading-snug">{a.need}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Roadmap tracks */}
          {/* <TracksSection /> */}
          
          {/* Deep-dive tabs */}
          <section>
            <hr className="my-4 border-indigo-400" />
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-slate-800">Deep dive</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Shapes and contracts: permalink, attestation, counter-citation, authoring, MCP, deliberation, substrate.
              </p>
            </div>
            <Tabs value={tab} onValueChange={setTab} className="space-y-4">
              <TabsList>
                <TabsTrigger value="permalink" className="gap-1.5">
                  <Link2 className="w-4 h-4" />
                  Permalink
                </TabsTrigger>
                <TabsTrigger value="attestation" className="gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  Attestation
                </TabsTrigger>
                <TabsTrigger value="counter" className="gap-1.5">
                  <Swords className="w-4 h-4" />
                  Counter-citation
                </TabsTrigger>
                <TabsTrigger value="authoring" className="gap-1.5">
                  <PenLine className="w-4 h-4" />
                  Authoring
                </TabsTrigger>
                <TabsTrigger value="mcp" className="gap-1.5">
                  <PlugZap className="w-4 h-4" />
                  MCP
                </TabsTrigger>
                <TabsTrigger value="deliberation" className="gap-1.5">
                  <Eye className="w-4 h-4" />
                  Deliberation
                </TabsTrigger>
                <TabsTrigger value="substrate" className="gap-1.5">
                  <Radio className="w-4 h-4" />
                  Ludics substrate
                </TabsTrigger>
                <TabsTrigger value="live" className="gap-1.5">
                  <Activity className="w-4 h-4" />
                  Live verification
                </TabsTrigger>
              </TabsList>
              <TabsContent value="permalink">
                <PermalinkExplainer />
              </TabsContent>
              <TabsContent value="attestation">
                <AttestationExplainer />
              </TabsContent>
              <TabsContent value="counter">
                <CounterCitationExplainer />
              </TabsContent>
              <TabsContent value="authoring">
                <AuthoringExplainer />
              </TabsContent>
              <TabsContent value="mcp">
                <McpExplainer />
              </TabsContent>
              <TabsContent value="deliberation">
                <DeliberationReadoutTab />
              </TabsContent>
              <TabsContent value="substrate">
                <LudicsSubstrateTab />
              </TabsContent>
              <TabsContent value="live">
                <LiveVerification />
              </TabsContent>
            </Tabs>
          </section>

         

          {/* Routes & MCP tools */}
          <section>
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-slate-800">Routes &amp; MCP tools</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                The full surface, identical for humans, crawlers, and language-model agents.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden divide-y">
              {ROUTES.map((r, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3">
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 font-mono ${
                      r.tag === "Page"
                        ? "bg-emerald-100 text-emerald-700"
                        : r.tag === "API"
                        ? "bg-sky-100 text-sky-700"
                        : "bg-violet-100 text-violet-700"
                    }`}
                  >
                    {r.method}
                  </span>
                  <code className="font-mono text-xs text-slate-700 flex-1 truncate">{r.path}</code>
                  <span className="text-xs text-slate-400 hidden md:block truncate max-w-[55%] text-right">
                    {r.description}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Footer */}
          <footer className="py-6 border-t border-slate-900/[0.06] flex items-center justify-between text-xs text-slate-400 flex-wrap gap-3">
            <span className="font-medium text-slate-500 inline-flex items-center gap-1.5">
              <Activity className="w-3 h-3" />
              Live verifiers: 54/54 attestation · 37/37 MCP
            </span>
            <div className="flex items-center gap-3 flex-wrap">
              <a
                href="/test/argument-search-discovery"
                className="text-indigo-500 hover:underline inline-flex items-center gap-1"
              >
                Search &amp; Discovery <ExternalLink className="w-3 h-3" />
              </a>
              <span className="text-slate-300">·</span>
              <a
                href="/test/living-thesis"
                className="text-indigo-500 hover:underline inline-flex items-center gap-1"
              >
                Living Thesis <ExternalLink className="w-3 h-3" />
              </a>
              <span className="text-slate-300">·</span>
              <a
                href="/test/embeddable-widget-pt4"
                className="text-amber-600 hover:underline inline-flex items-center gap-1"
              >
                Embeddable widget (Pt. 4) <ExternalLink className="w-3 h-3" />
              </a>
              <span className="text-slate-300">·</span>
              <span>May 2026</span>
            </div>
          </footer>
        </div>
      </div>
    </TooltipProvider>
  );
}
