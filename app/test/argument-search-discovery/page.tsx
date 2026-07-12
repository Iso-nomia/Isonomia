"use client";

/**
 * Public Argument Search & Discovery — Demo
 *
 * Interactive demonstration of the "Google for arguments" surface
 * (Phases 1–6 of the Argument Google Scholar Roadmap):
 *
 * - Consumer search page (substrate-first cards: standing, scheme,
 *   dialectical fitness, hybrid audit chip, attestation, counter deep
 *   link, lexical coverage)
 * - Hybrid retrieval (RRF over dense + sparse) with auditable per-result
 *   rank/distance disclosure
 * - Quality filters (tested-only, min critical-question coverage,
 *   min evidence count, ISO date range)
 * - Counter-citation discovery (Phase 5 — strongest structural contester
 *   per result, honest-null when none on file, self-counter excluded)
 * - Stance retrieval (Phase 6 — for/against dual-column dialectical
 *   view from /api/v3/claims/[moid]/stances)
 * - Four honest empty states (no intent, no results, against-with-no-
 *   counters, API failure) reported as distinct conditions
 * - MCP read surface (search_arguments, get_claim_stances,
 *   get_argument_counterargs) — same single source of truth
 *
 * Accessible at: /test/argument-search-discovery
 */

import { useMemo, useState } from "react";
import {
  Search,
  Sparkles,
  Shield,
  Scale,
  Hash,
  Filter,
  Layers,
  ArrowRight,
  Check,
  Copy,
  Terminal,
  Zap,
  AlertTriangle,
  AlertCircle,
  Inbox,
  Wifi,
  ChevronDown,
  ChevronRight,
  Bot,
  Globe,
  ExternalLink,
  Eye,
  ShieldCheck,
  Calendar,
  FileText,
  Circle,
} from "lucide-react";
import { toast, Toaster } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA — shape mirrors the real /api/v3/search/arguments response
// ─────────────────────────────────────────────────────────────────────────────

const BASE_URL = "https://isonomia.app";

type StandingState =
  | "tested-survived"
  | "tested-attacked"
  | "tested-undermined"
  | "untested-supported"
  | "untested-default";

type Result = {
  argumentId: string;
  shortCode: string;
  permalink: string;
  text: string;
  conclusion: { claimId: string; moid: string; text: string };
  scheme: { key: string; title: string };
  standingState: StandingState;
  attestationUrl: string;
  accessCount: number;
  createdAt: string;
  dialecticalFitness: number;
  evidenceCount: number;
  cqCoverage: number; // 0..1
  hybrid: {
    rrfScore: number;
    sparseRank: number | null;
    denseRank: number | null;
    denseDistance: number | null;
  };
  lexicalCoverage: { matched: number; outOf: number };
  strongestCounter: {
    shortCode: string;
    permalink: string;
    conclusion: { moid: string; text: string };
    source: "edge" | "conflict" | "edge+conflict";
  } | null;
};

const STANDING_LABELS: Record<StandingState, { label: string; tone: string; bg: string; text: string; border: string }> = {
  "tested-survived": { label: "Tested · Survived", tone: "good", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  "tested-attacked": { label: "Tested · Under attack", tone: "warn", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  "tested-undermined": { label: "Tested · Undermined", tone: "bad", bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
  "untested-supported": { label: "Untested · Supported", tone: "neutral", bg: "bg-sky-50", text: "text-sky-700", border: "border-sky-200" },
  "untested-default": { label: "Untested", tone: "muted", bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200" },
};

const MOCK_RESULTS: Result[] = [
  {
    argumentId: "arg-1",
    shortCode: "rK7pA2mN",
    permalink: `${BASE_URL}/a/rK7pA2mN`,
    text: "Engagement-optimized recommendation systems systematically select for emotionally activating content over informative content; the selection pressure compounds at scale to produce a degraded epistemic commons.",
    conclusion: {
      claimId: "claim-1",
      moid: "CLAIM-7A3B",
      text: "Recommendation algorithms produce systemic epistemic harm in democratic contexts",
    },
    scheme: { key: "argument_from_analogy", title: "Argument from Analogy" },
    standingState: "tested-survived",
    attestationUrl: `${BASE_URL}/api/v3/arguments/rK7pA2mN/attestation`,
    accessCount: 412,
    createdAt: "2026-04-22T10:00:00Z",
    dialecticalFitness: 0.74,
    evidenceCount: 5,
    cqCoverage: 0.83,
    hybrid: { rrfScore: 0.0287, sparseRank: 1, denseRank: 2, denseDistance: 0.142 },
    lexicalCoverage: { matched: 3, outOf: 4 },
    strongestCounter: {
      shortCode: "qT9rB4xP",
      permalink: `${BASE_URL}/a/qT9rB4xP`,
      conclusion: {
        moid: "CLAIM-9F2C",
        text: "Algorithmic amplification effects are smaller than user homophily effects",
      },
      source: "edge+conflict",
    },
  },
  {
    argumentId: "arg-2",
    shortCode: "mB4qC8dX",
    permalink: `${BASE_URL}/a/mB4qC8dX`,
    text: "Carbon pricing creates a direct cost signal that propagates through supply chains, incentivizes substitution, and generates revenue for progressive redistribution. No alternative achieves comparable reductions at lower cost.",
    conclusion: {
      claimId: "claim-2",
      moid: "CLAIM-2F9E",
      text: "Carbon pricing is the most economically efficient mechanism for reducing emissions at scale",
    },
    scheme: { key: "practical_reasoning", title: "Practical Reasoning" },
    standingState: "tested-attacked",
    attestationUrl: `${BASE_URL}/api/v3/arguments/mB4qC8dX/attestation`,
    accessCount: 289,
    createdAt: "2026-03-14T14:00:00Z",
    dialecticalFitness: 0.51,
    evidenceCount: 4,
    cqCoverage: 0.67,
    hybrid: { rrfScore: 0.0264, sparseRank: 3, denseRank: 1, denseDistance: 0.118 },
    lexicalCoverage: { matched: 2, outOf: 4 },
    strongestCounter: {
      shortCode: "vN6wL2hG",
      permalink: `${BASE_URL}/a/vN6wL2hG`,
      conclusion: {
        moid: "CLAIM-5E8A",
        text: "Sectoral standards reduce emissions faster than carbon pricing in regulated markets",
      },
      source: "edge",
    },
  },
  {
    argumentId: "arg-3",
    shortCode: "zP3kJ7tQ",
    permalink: `${BASE_URL}/a/zP3kJ7tQ`,
    text: "Despite extensive correlational evidence, no large-scale randomized study has shown engagement-optimized feeds cause measurable polarization at the population level after controlling for self-selection.",
    conclusion: {
      claimId: "claim-3",
      moid: "CLAIM-3D1B",
      text: "Causal evidence for algorithm-driven polarization remains weak",
    },
    scheme: { key: "argument_from_lack_of_evidence", title: "Argument from Lack of Evidence" },
    standingState: "untested-supported",
    attestationUrl: `${BASE_URL}/api/v3/arguments/zP3kJ7tQ/attestation`,
    accessCount: 94,
    createdAt: "2026-04-30T09:00:00Z",
    dialecticalFitness: 0.42,
    evidenceCount: 3,
    cqCoverage: 0.50,
    hybrid: { rrfScore: 0.0213, sparseRank: 2, denseRank: 5, denseDistance: 0.187 },
    lexicalCoverage: { matched: 2, outOf: 4 },
    strongestCounter: null, // honest null
  },
  {
    argumentId: "arg-4",
    shortCode: "hL5xR8nW",
    permalink: `${BASE_URL}/a/hL5xR8nW`,
    text: "An expert consensus statement from an interdisciplinary panel of platform researchers does not, by itself, settle a contested empirical question; expert opinion warrants premise-level evidence on each cited mechanism.",
    conclusion: {
      claimId: "claim-4",
      moid: "CLAIM-8C4F",
      text: "Expert consensus alone is insufficient evidence for platform policy",
    },
    scheme: { key: "argument_from_expert_opinion", title: "Argument from Expert Opinion" },
    standingState: "tested-undermined",
    attestationUrl: `${BASE_URL}/api/v3/arguments/hL5xR8nW/attestation`,
    accessCount: 47,
    createdAt: "2026-01-08T11:00:00Z",
    dialecticalFitness: 0.21,
    evidenceCount: 1,
    cqCoverage: 0.20,
    hybrid: { rrfScore: 0.0163, sparseRank: 5, denseRank: 4, denseDistance: 0.211 },
    lexicalCoverage: { matched: 1, outOf: 4 },
    strongestCounter: {
      shortCode: "yK2jD9pE",
      permalink: `${BASE_URL}/a/yK2jD9pE`,
      conclusion: {
        moid: "CLAIM-1B7D",
        text: "Convergent expert testimony plus mechanism evidence justifies provisional action",
      },
      source: "conflict",
    },
  },
];

// Stance retrieval mock
const STANCE_CLAIM = {
  moid: "CLAIM-7A3B",
  text: "Recommendation algorithms produce systemic epistemic harm in democratic contexts",
};
const STANCE_FOR: Result[] = [MOCK_RESULTS[0]];
const STANCE_AGAINST: Result[] = [
  {
    ...MOCK_RESULTS[0],
    argumentId: "arg-c1",
    shortCode: "qT9rB4xP",
    permalink: `${BASE_URL}/a/qT9rB4xP`,
    text: "Within-platform user homophily and pre-existing political identity account for the bulk of variance in feed composition; algorithmic uplift is a small additional factor.",
    conclusion: {
      claimId: "claim-c1",
      moid: "CLAIM-9F2C",
      text: "Algorithmic amplification effects are smaller than user homophily effects",
    },
    standingState: "tested-survived",
    dialecticalFitness: 0.69,
    strongestCounter: null,
    hybrid: { rrfScore: 0.0241, sparseRank: 1, denseRank: 1, denseDistance: 0.131 },
  },
  {
    ...MOCK_RESULTS[0],
    argumentId: "arg-c2",
    shortCode: "kF8wM3sT",
    permalink: `${BASE_URL}/a/kF8wM3sT`,
    text: "Cross-platform natural experiments (deactivation studies, default-feed swaps) show null or small effects on measured polarization, in tension with the systemic-harm claim.",
    conclusion: {
      claimId: "claim-c2",
      moid: "CLAIM-4G3H",
      text: "Cross-platform experiments fail to detect systemic algorithmic harm",
    },
    standingState: "tested-attacked",
    dialecticalFitness: 0.55,
    strongestCounter: null,
    hybrid: { rrfScore: 0.0218, sparseRank: 2, denseRank: 3, denseDistance: 0.156 },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// FEATURES
// ─────────────────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    id: "consumer-page",
    step: "1–4",
    title: "Consumer Search Page",
    description: "Server-rendered substrate-first results page; same URL serves humans, crawlers, and agents",
    icon: Search,
    color: "from-sky-500/10 to-blue-500/15",
    iconColor: "text-sky-600",
    items: [
      "Route: /search/arguments — server component, no client JS required for first paint",
      "Each card: standing badge, scheme chip, dialectical-fitness chip, hybrid chip, attestation link, counter deep link, lexical coverage",
      "Alternate links in <head>: JSON and JSON-LD representations of the same query",
      "Four distinct empty states surfaced (not collapsed): no-intent, no-results, no-counters, API-failure",
      "Sort order is data-driven: standing first, then dialectical fitness, then hybrid score",
    ],
  },
  {
    id: "hybrid",
    step: "2",
    title: "Hybrid Retrieval (RRF)",
    description: "Reciprocal rank fusion of dense (vector cosine) and sparse (lexical) recall — auditable per result",
    icon: Layers,
    color: "from-violet-500/10 to-purple-500/15",
    iconColor: "text-violet-600",
    items: [
      "Single endpoint: GET /api/v3/search/arguments — source of truth for page, MCP, and external integrations",
      "Three modes: hybrid (default), lexical (deterministic substring), vector (purely semantic)",
      "Per-result hybrid block exposes RRF score, sparse rank, dense rank, dense distance",
      "Hybrid chip on each card (hover for the audit triplet) — ranking is inspectable, not opaque",
      "alternate=json and alternate=jsonld link rels expose the raw response",
    ],
  },
  {
    id: "filters",
    step: "3",
    title: "Quality Filters",
    description: "Narrow results to dialectically tested, evidence-bearing arguments via four orthogonal filters",
    icon: Filter,
    color: "from-emerald-500/10 to-teal-500/15",
    iconColor: "text-emerald-600",
    items: [
      "tested_only=1 — exclude untested-default standing",
      "min_cq=0..1 — minimum critical-question coverage threshold",
      "min_evidence=N — minimum count of provenance-anchored evidence rows",
      "since=YYYY-MM-DD & until=YYYY-MM-DD — ISO date range on createdAt",
      "Same filter params surface in the page UI (collapsible quality-filters panel) and in MCP tools",
    ],
  },
  {
    id: "counter",
    step: "5",
    title: "Counter-Citation Discovery",
    description: "Each result enriched with its strongest known structural contester — honest-null when none on file",
    icon: Shield,
    color: "from-amber-500/10 to-orange-500/15",
    iconColor: "text-amber-600",
    items: [
      "include_strongest_counter=1 + strongest_counter_k=N (default 1)",
      "Sources: rebut edges + undercut edges + ASPIC+ conflict applications (union)",
      "Self-counters excluded by conclusion MOID — same contract as counterargs and against mode",
      "Bounded single-fanout across top-K results (1 edge query + 1 conflict query + 1 argument fetch — no N+1)",
      "Ranked by permalink.accessCount desc, then createdAt desc",
      "Consumer page opts in by default → every visible card displays counter or 'none on file'",
    ],
  },
  {
    id: "stances",
    step: "6",
    title: "Claim Stance Retrieval",
    description: "For/against dual-column dialectical view in a single endpoint call — the killer query for any debate UI",
    icon: Scale,
    color: "from-pink-500/10 to-rose-500/15",
    iconColor: "text-pink-600",
    items: [
      "Route: GET /api/v3/claims/[moid]/stances — 404 only on missing MOID, [] per side when empty",
      "Internally: two delegated calls to the same /api/v3/search/arguments endpoint",
      "'for' = ?conclusion_moid={moid} (arguments concluding to the claim)",
      "'against' = ?against={moid} (structural contesters of the claim)",
      "Both lists carry the full search-result shape (and can carry strongest-counter enrichment)",
      "Claim page (/c/[moid]) renders the dual-column dialectical view inline",
    ],
  },
  {
    id: "mcp",
    step: "1–6",
    title: "Model Context Protocol Surface",
    description: "Same single source of truth exposed to language-model agents via stdio JSON-RPC",
    icon: Bot,
    color: "from-indigo-500/10 to-violet-500/15",
    iconColor: "text-indigo-600",
    items: [
      "search_arguments — every parameter from the HTTP route, including conclusion_moid + include_strongest_counter",
      "get_claim_stances — wraps the stances endpoint",
      "get_argument_counterargs — direct counterarg lookup with same self-counter exclusion",
      "Zod-validated input schemas; output is verbatim the HTTP JSON",
      "OpenAPI 3.1 spec at lib/api/isonomiaOpenapi.ts, served at /api/v3/docs (Scalar UI)",
    ],
  },
];

const ROUTES = [
  { method: "GET", path: "/search/arguments", description: "Consumer search page (server-rendered)", tag: "Page" },
  { method: "GET", path: "/c/[moid]", description: "Claim page with inline dual-column stance view", tag: "Page" },
  { method: "GET", path: "/api/v3/search/arguments", description: "Single source of truth — hybrid/lexical/vector retrieval", tag: "API" },
  { method: "GET", path: "/api/v3/claims/[moid]/stances", description: "For/against dual-column stance retrieval", tag: "API" },
  { method: "GET", path: "/api/v3/arguments/[shortCode]/attestation", description: "Per-argument attestation envelope (provenance, hash)", tag: "API" },
  { method: "GET", path: "/api/v3/docs", description: "OpenAPI 3.1 spec (Scalar UI)", tag: "API" },
  { method: "MCP", path: "search_arguments", description: "All HTTP search params, including conclusion_moid + counter enrichment", tag: "MCP" },
  { method: "MCP", path: "get_claim_stances", description: "Dual for/against view for a claim MOID", tag: "MCP" },
  { method: "MCP", path: "get_argument_counterargs", description: "Direct counter-argument lookup (self-counter excluded)", tag: "MCP" },
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function useCopy() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedKey(key);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1800);
  };
  return { copiedKey, copy };
}

function truncate(s: string, n: number): string {
  if (!s) return "";
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trimEnd() + "…";
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE CARD
// ─────────────────────────────────────────────────────────────────────────────

function FeatureCard({ feature }: { feature: (typeof FEATURES)[0] }) {
  const Icon = feature.icon;
  return (
    <div className="cardv2 h-full flex flex-col">
      <div className="p-5 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`p-2 rounded-xl bg-gradient-to-br ${feature.color} ${feature.iconColor} shrink-0`}>
              <Icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-slate-400 font-mono">Phase {feature.step}</span>
              <p className="font-semibold text-slate-900 text-[14px] leading-tight">{feature.title}</p>
              <p className="text-xs text-slate-500 mt-0.5 leading-snug">{feature.description}</p>
            </div>
          </div>
          <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-700 border border-emerald-500/25">
            <Check className="w-2.5 h-2.5" />
            Shipped
          </span>
        </div>
      </div>
      <div className="px-5 pb-5 flex-1">
        <ul className="space-y-1.5">
          {feature.items.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-[12.5px] text-slate-600 leading-snug">
              <div className="w-1 h-1 rounded-full bg-sky-400/70 flex-shrink-0 mt-[5px]" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RESULT CARD — mirrors components/search/ArgumentResultCard.tsx
// ─────────────────────────────────────────────────────────────────────────────

function ResultCard({ result, showCounter = true }: { result: Result; showCounter?: boolean }) {
  const standing = STANDING_LABELS[result.standingState];
  return (
    <article className={`rounded-xl border ${standing.border} bg-white p-4 space-y-3`}>
      <header className="flex flex-wrap items-center gap-1.5">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${standing.bg} ${standing.text} border ${standing.border}`}>
          {standing.label}
        </span>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-violet-50 text-violet-700 border border-violet-200">
          {result.scheme.title}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-help">
              fitness {result.dialecticalFitness.toFixed(2)}
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            Dialectical fitness — CQs answered + supports − attacks − conflicts + provenance
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-sky-50 text-sky-700 border border-sky-200 cursor-help font-mono">
              hybrid
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs font-mono text-[11px]">
            RRF {result.hybrid.rrfScore.toFixed(4)} · sparse #{result.hybrid.sparseRank ?? "—"} · dense #{result.hybrid.denseRank ?? "—"} · dist {result.hybrid.denseDistance?.toFixed(3) ?? "—"}
          </TooltipContent>
        </Tooltip>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-50 text-slate-600 border border-slate-200 font-mono">
          {result.lexicalCoverage.matched}/{result.lexicalCoverage.outOf} terms
        </span>
        <a
          href={result.attestationUrl}
          className="ml-auto inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-700"
          onClick={(e) => e.preventDefault()}
        >
          <ShieldCheck className="w-3 h-3" />
          attestation
        </a>
      </header>

      <h3 className="text-[15px] font-semibold text-slate-900 leading-snug">
        {truncate(result.conclusion.text, 200)}
      </h3>
      <p className="text-[13px] text-slate-600 leading-relaxed">
        {truncate(result.text, 280)}
      </p>

      {showCounter && (
        <aside className="rounded-lg border border-rose-200/80 bg-rose-50/40 p-3 w-full">
          <div className="flex w-full items-center gap-1.5 mb-2 ">
            <Shield className="w-3 h-3 text-rose-600" />
            <span className="text-[11px] text-nowrap font-semibold text-rose-700 uppercase tracking-wide">
              Strongest counter
            </span>
            {result.strongestCounter && (
              <span className="text-[10px] font-mono text-rose-500 ">
                via {result.strongestCounter.source}
              </span>
            )}
          </div>
          {result.strongestCounter ? (
            <p className="text-[13px] text-slate-700 leading-snug">
              {truncate(result.strongestCounter.conclusion.text, 180)}
            </p>
          ) : (
            <p className="text-[13px] text-slate-400 italic">
              none on file (honest null — not absence-by-omission)
            </p>
          )}
        </aside>
      )}

      <footer className="flex items-center gap-3 text-[11px] text-slate-500 pt-1">
        <span className="font-mono">/a/{result.shortCode}</span>
        <span>·</span>
        <span>{result.evidenceCount} evidence</span>
        <span>·</span>
        <span>CQ {Math.round(result.cqCoverage * 100)}%</span>
        <span>·</span>
        <span>{result.accessCount} views</span>
        <a
          href={`/search/arguments?against=${result.conclusion.moid}`}
          className="ml-auto inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700"
          onClick={(e) => e.preventDefault()}
        >
          counter-arguments
          <ArrowRight className="w-3 h-3" />
        </a>
      </footer>
    </article>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DEMO 1 — SEARCH RESULTS
// ─────────────────────────────────────────────────────────────────────────────

const QUERIES = [
  { q: "recommendation algorithms epistemic harm", mode: "hybrid" },
  { q: "carbon pricing efficiency", mode: "hybrid" },
  { q: "expert consensus", mode: "lexical" },
  { q: "polarization causal evidence", mode: "vector" },
];

function SearchResultsDemo() {
  const [activeQ, setActiveQ] = useState(0);
  const [showCounter, setShowCounter] = useState(true);
  const [showAuditJSON, setShowAuditJSON] = useState(false);
  const { copiedKey, copy } = useCopy();
  const query = QUERIES[activeQ];

  const apiUrl = `GET /api/v3/search/arguments?q=${encodeURIComponent(query.q)}&mode=${query.mode}&include_strongest_counter=${showCounter ? 1 : 0}&strongest_counter_k=1`;

  const auditJSON = JSON.stringify(
    {
      ok: true,
      query: { q: query.q, mode: query.mode, include_strongest_counter: showCounter },
      results: MOCK_RESULTS.slice(0, 2).map((r) => ({
        argumentId: r.argumentId,
        shortCode: r.shortCode,
        standingState: r.standingState,
        dialecticalFitness: r.dialecticalFitness,
        hybrid: r.hybrid,
        lexicalCoverage: r.lexicalCoverage,
        strongestCounter: showCounter
          ? r.strongestCounter && {
              shortCode: r.strongestCounter.shortCode,
              source: r.strongestCounter.source,
              conclusion: { moid: r.strongestCounter.conclusion.moid },
            }
          : undefined,
      })),
      counts: { total: MOCK_RESULTS.length },
    },
    null,
    2
  );

  return (
    <div className="space-y-4">
      {/* Query controls */}
      <div className="rounded-xl border bg-white p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 uppercase tracking-wide">
          <Search className="w-3.5 h-3.5" />
          Try a query
        </div>
        <div className="flex flex-wrap gap-2">
          {QUERIES.map((q, i) => (
            <button
              key={i}
              onClick={() => setActiveQ(i)}
              className={`text-xs px-3 py-1.5 rounded-full border transition ${
                i === activeQ
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
              }`}
            >
              <span className="font-mono mr-1.5 opacity-70">[{q.mode}]</span>
              {q.q}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={showCounter}
              onChange={(e) => setShowCounter(e.target.checked)}
              className="rounded"
            />
            <span className="font-medium">include_strongest_counter</span>
            <span className="text-slate-400">(consumer page default: on)</span>
          </label>
          <button
            onClick={() => setShowAuditJSON((v) => !v)}
            className="ml-auto text-xs text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1"
          >
            {showAuditJSON ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            View raw API response
          </button>
        </div>
        <div className="rounded-lg bg-slate-900 text-slate-100 px-3 py-2 font-mono text-[11px] flex items-center gap-2">
          <span className="text-emerald-400 shrink-0">$</span>
          <span className="truncate">{apiUrl}</span>
          <button
            onClick={() => copy(apiUrl, "url")}
            className="ml-auto text-slate-400 hover:text-white shrink-0"
            aria-label="Copy"
          >
            {copiedKey === "url" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
        {showAuditJSON && (
          <pre className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-[11px] text-slate-700 font-mono overflow-x-auto max-h-72">
            {auditJSON}
          </pre>
        )}
      </div>

      {/* Results */}
      <div className="space-y-3">
        {MOCK_RESULTS.map((r) => (
          <ResultCard key={r.argumentId} result={r} showCounter={showCounter} />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DEMO 2 — QUALITY FILTERS
// ─────────────────────────────────────────────────────────────────────────────

function QualityFiltersDemo() {
  const [testedOnly, setTestedOnly] = useState(false);
  const [minCQ, setMinCQ] = useState(0);
  const [minEvidence, setMinEvidence] = useState(0);
  const [since, setSince] = useState("");

  const filtered = useMemo(() => {
    return MOCK_RESULTS.filter((r) => {
      if (testedOnly && r.standingState === "untested-default") return false;
      if (r.cqCoverage < minCQ) return false;
      if (r.evidenceCount < minEvidence) return false;
      if (since && r.createdAt < since) return false;
      return true;
    });
  }, [testedOnly, minCQ, minEvidence, since]);

  const params: string[] = [];
  if (testedOnly) params.push("tested_only=1");
  if (minCQ > 0) params.push(`min_cq=${minCQ}`);
  if (minEvidence > 0) params.push(`min_evidence=${minEvidence}`);
  if (since) params.push(`since=${since}`);
  const url = `GET /api/v3/search/arguments?q=...${params.length ? "&" + params.join("&") : ""}`;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-white p-5 space-y-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 uppercase tracking-wide">
          <Filter className="w-3.5 h-3.5" />
          Quality Filters Panel
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 cursor-pointer hover:border-slate-300">
            <input type="checkbox" checked={testedOnly} onChange={(e) => setTestedOnly(e.target.checked)} />
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <div className="text-xs">
              <p className="font-semibold text-slate-800">Tested only</p>
              <p className="text-slate-500 font-mono">tested_only=1</p>
            </div>
          </label>
          <div className="rounded-lg border border-slate-200 px-3 py-2">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2 text-xs">
                <Eye className="w-4 h-4 text-violet-600" />
                <p className="font-semibold text-slate-800">Min critical-question coverage</p>
              </div>
              <span className="text-xs font-mono text-slate-600">{Math.round(minCQ * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={minCQ}
              onChange={(e) => setMinCQ(parseFloat(e.target.value))}
              className="w-full"
            />
            <p className="text-[10px] text-slate-400 font-mono mt-1">min_cq={minCQ}</p>
          </div>
          <div className="rounded-lg border border-slate-200 px-3 py-2">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2 text-xs">
                <FileText className="w-4 h-4 text-amber-600" />
                <p className="font-semibold text-slate-800">Min evidence count</p>
              </div>
              <span className="text-xs font-mono text-slate-600">{minEvidence}</span>
            </div>
            <input
              type="range"
              min={0}
              max={5}
              step={1}
              value={minEvidence}
              onChange={(e) => setMinEvidence(parseInt(e.target.value, 10))}
              className="w-full"
            />
            <p className="text-[10px] text-slate-400 font-mono mt-1">min_evidence={minEvidence}</p>
          </div>
          <div className="rounded-lg border border-slate-200 px-3 py-2">
            <div className="flex items-center gap-2 text-xs mb-1.5">
              <Calendar className="w-4 h-4 text-pink-600" />
              <p className="font-semibold text-slate-800">Created since (ISO)</p>
            </div>
            <input
              type="date"
              value={since}
              onChange={(e) => setSince(e.target.value)}
              className="w-full text-xs px-2 py-1 border border-slate-200 rounded font-mono"
            />
            <p className="text-[10px] text-slate-400 font-mono mt-1">since={since || "—"}</p>
          </div>
        </div>

        <div className="rounded-lg bg-slate-900 text-slate-100 px-3 py-2 font-mono text-[11px] truncate">
          <span className="text-emerald-400">$ </span>
          {url}
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">
            <span className="font-semibold text-slate-700">{filtered.length}</span> of {MOCK_RESULTS.length} results match
          </span>
          {filtered.length === 0 && (
            <span className="text-amber-600 font-medium inline-flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Honest empty: no_results (filters too strict)
            </span>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {filtered.map((r) => (
          <ResultCard key={r.argumentId} result={r} showCounter={false} />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DEMO 3 — STANCE DUAL COLUMN
// ─────────────────────────────────────────────────────────────────────────────

function StanceDemo() {
  const { copiedKey, copy } = useCopy();
  const apiUrl = `GET /api/v3/claims/${STANCE_CLAIM.moid}/stances`;
  const responseShape = JSON.stringify(
    {
      ok: true,
      query: { moid: STANCE_CLAIM.moid },
      claim: { moid: STANCE_CLAIM.moid, text: STANCE_CLAIM.text },
      for: STANCE_FOR.map((r) => ({ shortCode: r.shortCode, standingState: r.standingState })),
      against: STANCE_AGAINST.map((r) => ({ shortCode: r.shortCode, standingState: r.standingState })),
      counts: { for: STANCE_FOR.length, against: STANCE_AGAINST.length },
      links: {
        forSearch: `/search/arguments?conclusion_moid=${STANCE_CLAIM.moid}`,
        againstSearch: `/search/arguments?against=${STANCE_CLAIM.moid}`,
      },
    },
    null,
    2
  );

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-white p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 uppercase tracking-wide">
          <Scale className="w-3.5 h-3.5" />
          Claim · stance retrieval
        </div>
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
          <p className="text-[11px] text-slate-500 font-mono mb-1">{STANCE_CLAIM.moid}</p>
          <p className="text-sm text-slate-800 font-medium">{STANCE_CLAIM.text}</p>
        </div>
        <div className="rounded-lg bg-slate-900 text-slate-100 px-3 py-2 font-mono text-[11px] flex items-center gap-2">
          <span className="text-emerald-400 shrink-0">$</span>
          <span className="truncate">{apiUrl}</span>
          <button
            onClick={() => copy(apiUrl, "stances")}
            className="ml-auto text-slate-400 hover:text-white shrink-0"
            aria-label="Copy"
          >
            {copiedKey === "stances" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          Internally: two delegated calls to the same single-source endpoint.{" "}
          <code className="bg-slate-100 px-1 rounded font-mono">for</code> uses{" "}
          <code className="bg-slate-100 px-1 rounded font-mono">?conclusion_moid={STANCE_CLAIM.moid}</code>;{" "}
          <code className="bg-slate-100 px-1 rounded font-mono">against</code> uses{" "}
          <code className="bg-slate-100 px-1 rounded font-mono">?against={STANCE_CLAIM.moid}</code>. Both
          lists carry the full search-result shape. 404 only on missing MOID — empty side returns{" "}
          <code className="bg-slate-100 px-1 rounded font-mono">[]</code>, not absence.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200">
            <Check className="w-4 h-4 text-emerald-600" />
            <p className="text-sm font-semibold text-emerald-800">For ({STANCE_FOR.length})</p>
            <span className="ml-auto text-[10px] font-mono text-emerald-600">
              ?conclusion_moid=...
            </span>
          </div>
          <div className="space-y-3">
            {STANCE_FOR.map((r) => (
              <ResultCard key={r.argumentId} result={r} showCounter={false} />
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-50 border border-rose-200">
            <Shield className="w-4 h-4 text-rose-600" />
            <p className="text-sm font-semibold text-rose-800">Against ({STANCE_AGAINST.length})</p>
            <span className="ml-auto text-[10px] font-mono text-rose-600">?against=...</span>
          </div>
          <div className="space-y-3">
            {STANCE_AGAINST.map((r) => (
              <ResultCard key={r.argumentId} result={r} showCounter={false} />
            ))}
          </div>
        </div>
      </div>

      <details className="rounded-xl border bg-white p-4">
        <summary className="text-xs font-semibold text-slate-700 cursor-pointer flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5" />
          Response shape
        </summary>
        <pre className="mt-3 rounded-lg bg-slate-50 border border-slate-200 p-3 text-[11px] text-slate-700 font-mono overflow-x-auto">
          {responseShape}
        </pre>
      </details>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DEMO 4 — HONEST EMPTY STATES
// ─────────────────────────────────────────────────────────────────────────────

const EMPTY_STATES = [
  {
    id: "no-intent",
    label: "No query intent",
    description: "Empty / missing q parameter — surfaced as a distinct state, not collapsed into 'no results'",
    icon: Search,
    color: "slate",
    when: "GET /api/v3/search/arguments  (no q, no against, no conclusion_moid)",
    response: { ok: true, results: [], counts: { total: 0 }, hint: "no_query_intent" },
  },
  {
    id: "no-results",
    label: "No results",
    description: "Query was well-formed but matched nothing in the corpus (or filters too strict)",
    icon: Inbox,
    color: "amber",
    when: "GET /api/v3/search/arguments?q=verylongnonsensequery&min_evidence=10",
    response: { ok: true, results: [], counts: { total: 0 }, hint: "no_results" },
  },
  {
    id: "no-counters",
    label: "Against mode · no counters on file",
    description: "?against={moid} ran successfully — there are no structural contesters yet",
    icon: Shield,
    color: "rose",
    when: "GET /api/v3/search/arguments?against=CLAIM-3D1B",
    response: { ok: true, results: [], counts: { total: 0 }, hint: "no_counters_on_file" },
  },
  {
    id: "api-failure",
    label: "API failure",
    description: "Upstream error — never collapsed into 'no results'; rendered as distinct error UI",
    icon: Wifi,
    color: "violet",
    when: "GET /api/v3/search/arguments?q=...  (e.g., embedding service down)",
    response: { ok: false, error: "embedding_unavailable", retryAfter: 30 },
  },
];

function EmptyStatesDemo() {
  const [active, setActive] = useState(EMPTY_STATES[0].id);
  const state = EMPTY_STATES.find((s) => s.id === active)!;
  const Icon = state.icon;

  const colorMap: Record<string, { bg: string; border: string; text: string; iconBg: string }> = {
    slate: { bg: "bg-slate-50", border: "border-slate-200", text: "text-slate-700", iconBg: "bg-slate-100 text-slate-600" },
    amber: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", iconBg: "bg-amber-100 text-amber-600" },
    rose: { bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-700", iconBg: "bg-rose-100 text-rose-600" },
    violet: { bg: "bg-violet-50", border: "border-violet-200", text: "text-violet-700", iconBg: "bg-violet-100 text-violet-600" },
  };
  const c = colorMap[state.color];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-white p-4">
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5" />
          Four distinct empty states — surfaced separately, never collapsed
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {EMPTY_STATES.map((s) => {
            const SIcon = s.icon;
            return (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                className={`text-left rounded-lg border px-3 py-2 transition ${
                  active === s.id
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <SIcon className="w-3.5 h-3.5" />
                  <span className="text-xs font-semibold">{s.label}</span>
                </div>
                <p className={`text-[10px] leading-snug ${active === s.id ? "text-slate-300" : "text-slate-500"}`}>
                  {s.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <div className={`rounded-xl border ${c.border} ${c.bg} p-6`}>
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-xl ${c.iconBg}`}>
            <Icon className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold ${c.text} mb-1`}>{state.label}</p>
            <p className="text-xs text-slate-600 mb-3">{state.description}</p>
            <div className="rounded-lg bg-slate-900 text-slate-100 px-3 py-2 font-mono text-[11px] mb-2 truncate">
              <span className="text-emerald-400">$ </span>
              {state.when}
            </div>
            <pre className="rounded-lg bg-white/60 border border-slate-200 p-3 text-[11px] text-slate-700 font-mono overflow-x-auto">
              {JSON.stringify(state.response, null, 2)}
            </pre>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 leading-relaxed">
        <p className="font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" />
          Why four states, not one
        </p>
        <p>
          A search surface that conflates &quot;no query&quot; with &quot;no results&quot; with &quot;upstream error&quot; lies by
          omission. The consumer page renders distinct UI per state so a user can tell{" "}
          <em>why</em> nothing appeared. This is the same dialectical-honesty contract that
          drives the honest-null behavior on{" "}
          <code className="bg-white px-1 rounded font-mono">strongestCounter</code>.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function ArgumentSearchDiscoveryDemoPage() {
  return (
    <TooltipProvider>
      <Toaster position="bottom-right" richColors />
      <div
        className="min-h-screen"
        style={{
          background:
            "linear-gradient(145deg, #f5faff 0%, #eef5ff 25%, #faf6ff 60%, #fff6f8 100%)",
        }}
      >
        {/* Sticky header */}
        <div
          className="border-b border-slate-900/[0.07] bg-white/85 backdrop-blur-xl sticky top-0 z-40 px-6 py-4"
          style={{
            boxShadow:
              "0 1px 3px rgba(99,102,241,0.06), 0 4px 16px -8px rgba(99,102,241,0.08)",
          }}
        >
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600">
                  <Search className="w-5 h-5 text-white" />
                </div>
                Public Argument Search &amp; Discovery
              </h1>
              <p className="text-sm text-slate-500 mt-1 ml-12">
                The Google-Scholar-for-arguments surface 
              </p>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
          {/* Strategic context banner */}
          <div className="rounded-xl bg-gradient-to-r from-indigo-50 via-violet-50 to-pink-50 border border-indigo-100/80 p-5">
            <div className="flex items-start gap-4">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shrink-0">
                <Circle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900 mb-1">
                  One source of truth. Three audiences. Honest empties.
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  The consumer search page, the model-context-protocol surface, and any external
                  integration all call the <em>same</em>{" "}
                  <code className="bg-white/70 px-1.5 py-0.5 rounded font-mono text-xs">
                    /api/v3/search/arguments
                  </code>{" "}
                  endpoint. Hybrid retrieval is auditable per result. Counter-citations ship by
                  default — with their honest-null when none are on file. Stances land for and
                  against in a single call. Empty states are reported as four distinct conditions,
                  never collapsed into a generic &quot;no results.&quot; Self-counters are excluded
                  by MOID across every counter surface.
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {[
                    { label: "Single source of truth", color: "bg-indigo-100 text-indigo-700" },
                    { label: "Hybrid · RRF auditable", color: "bg-violet-100 text-violet-700" },
                    { label: "Quality filters", color: "bg-emerald-100 text-emerald-700" },
                    { label: "Strongest counter by default", color: "bg-amber-100 text-amber-700" },
                    { label: "For/against in one call", color: "bg-pink-100 text-pink-700" },
                    { label: "Self-counter excluded", color: "bg-rose-100 text-rose-700" },
                    { label: "MCP parity", color: "bg-sky-100 text-sky-700" },
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

          {/* Deliverables grid */}
          <section>
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-slate-800">Deliverables</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Six surfaces, all backed by one canonical search endpoint.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {FEATURES.map((f) => (
                <FeatureCard key={f.id} feature={f} />
              ))}
            </div>
          </section>

          {/* Interactive demos */}
          <section>
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-slate-800">Interactive Demos</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Mock data; the real endpoints are live at the paths shown.
              </p>
            </div>
            <Tabs defaultValue="results" className="space-y-4">
              <TabsList className="bg-white border shadow-sm">
                <TabsTrigger value="results" className="gap-1.5">
                  <Search className="w-4 h-4" />
                  Search results
                </TabsTrigger>
                <TabsTrigger value="filters" className="gap-1.5">
                  <Filter className="w-4 h-4" />
                  Quality filters
                </TabsTrigger>
                <TabsTrigger value="stances" className="gap-1.5">
                  <Scale className="w-4 h-4" />
                  Stances (for / against)
                </TabsTrigger>
                <TabsTrigger value="empty" className="gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  Honest empties
                </TabsTrigger>
              </TabsList>

              <TabsContent value="results">
                <SearchResultsDemo />
              </TabsContent>
              <TabsContent value="filters">
                <QualityFiltersDemo />
              </TabsContent>
              <TabsContent value="stances">
                <StanceDemo />
              </TabsContent>
              <TabsContent value="empty">
                <EmptyStatesDemo />
              </TabsContent>
            </Tabs>
          </section>

          {/* Architecture summary */}
          <section>
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-slate-800">How it&apos;s built</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                One canonical endpoint. Every other surface is a delegate.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="sidebarv2">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-5 h-5 rounded-full bg-indigo-500/15 text-indigo-600 text-[11px] font-bold flex items-center justify-center">
                    1
                  </span>
                  <Search className="w-3.5 h-3.5 text-indigo-600" />
                  <p className="text-sm font-semibold text-slate-800">Single source endpoint</p>
                </div>
                <div className="space-y-1.5 mb-3">
                  <div className="rounded-lg bg-white/60 border border-slate-900/10 p-2 font-mono text-xs text-indigo-700">
                    app/api/v3/search/arguments/route.ts
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  Hybrid retrieval (RRF over dense + sparse), four quality filters,{" "}
                  <code className="bg-white/50 px-1 rounded">conclusion_moid</code>,{" "}
                  <code className="bg-white/50 px-1 rounded">against</code>,{" "}
                  <code className="bg-white/50 px-1 rounded">include_strongest_counter</code>{" "}
                  with bounded single-fanout (no N+1).
                </p>
              </div>

              <div className="sidebarv2">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-5 h-5 rounded-full bg-pink-500/15 text-pink-600 text-[11px] font-bold flex items-center justify-center">
                    2
                  </span>
                  <Scale className="w-3.5 h-3.5 text-pink-600" />
                  <p className="text-sm font-semibold text-slate-800">Stance delegate</p>
                </div>
                <div className="space-y-1.5 mb-3">
                  <div className="rounded-lg bg-white/60 border border-slate-900/10 p-2 font-mono text-xs text-pink-700">
                    app/api/v3/claims/[moid]/stances/route.ts
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  Resolves the claim, then makes two calls into the same single-source endpoint
                  via <code className="bg-white/50 px-1 rounded">searchGET()</code>. 404 only on
                  missing MOID. Empty side returns{" "}
                  <code className="bg-white/50 px-1 rounded">[]</code>.
                </p>
              </div>

              <div className="sidebarv2">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-5 h-5 rounded-full bg-violet-500/15 text-violet-600 text-[11px] font-bold flex items-center justify-center">
                    3
                  </span>
                  <Bot className="w-3.5 h-3.5 text-violet-600" />
                  <p className="text-sm font-semibold text-slate-800">Surfaces</p>
                </div>
                <div className="space-y-1.5 mb-3">
                  <div className="rounded-lg bg-white/60 border border-slate-900/10 p-2 font-mono text-xs text-sky-700">
                    app/search/arguments/page.tsx
                  </div>
                  <div className="rounded-lg bg-white/60 border border-slate-900/10 p-2 font-mono text-xs text-emerald-700">
                    app/c/[moid]/page.tsx
                  </div>
                  <div className="rounded-lg bg-white/60 border border-slate-900/10 p-2 font-mono text-xs text-violet-700">
                    packages/isonomia-mcp/src/server.ts
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  Consumer page, claim page (dual-column), and MCP server. All three are thin
                  callers; the contract lives in the endpoint.
                </p>
              </div>
            </div>
          </section>

          {/* Routes & MCP tools */}
          <section>
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-slate-800">Routes &amp; MCP tools</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                The full surface, identical for humans, search engines, and language-model agents.
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
                  <span className="text-xs text-slate-400 hidden md:block truncate max-w-[45%] text-right">
                    {r.description}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Footer */}
          <footer className="py-6 border-t border-slate-900/[0.06] flex items-center justify-between text-xs text-slate-400">
            <span className="font-medium text-slate-500">
              Public Argument Search &amp; Discovery — Phases 1–6
            </span>
            <div className="flex items-center gap-3">
              <a href="/test/embeddable-widget" className="text-indigo-500 hover:underline">
                ← Phase 1 (Embed infra)
              </a>
              <span className="text-slate-300">·</span>
              <a href="/search/arguments" className="text-indigo-500 hover:underline inline-flex items-center gap-1">
                Live consumer page <ExternalLink className="w-3 h-3" />
              </a>
              <span className="text-slate-300">·</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200/80 text-amber-600 text-[11px] font-medium">
                Phase 7 (corpus dump) deferred
              </span>
              <span className="text-slate-300">·</span>
              <span>May 2026</span>
            </div>
          </footer>
        </div>
      </div>
    </TooltipProvider>
  );
}
