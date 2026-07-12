"use client";

/**
 * Living Thesis Features Demo Page
 *
 * Polished demonstration of Phases 1–6 of the Living Thesis system.
 *
 * Accessible at: /test/living-thesis
 */

import { useMemo, useState } from "react";
import { Toaster, toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Brain,
  Camera,
  Check,
  CircleDot,
  Clock,
  CornerDownRight,
  Database,
  Eye,
  ExternalLink,
  Fingerprint,
  Gauge,
  GitBranch,
  GitCompare,
  Hash,
  HelpCircle,
  Layers,
  Lightbulb,
  LineChart,
  Link2,
  ListChecks,
  Network,
  PanelRightOpen,
  PlugZap,
  Radio,
  RefreshCw,
  Shield,
  ShieldCheck,
  Sparkles,
  Swords,
  Target,
  Workflow,
  type LucideIcon,
  Circle,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA
// ─────────────────────────────────────────────────────────────────────────────

type LiveLabel = "IN" | "OUT" | "UNDEC";

interface MockObject {
  id: string;
  kind: "claim" | "argument" | "proposition" | "citation";
  text: string;
  label?: LiveLabel;
  attackCount: number;
  undefendedAttackCount: number;
  defendedAttackCount: number;
  supportCount: number;
  evidenceCount: number;
  cqSatisfied?: number;
  cqTotal?: number;
  lastChangedAt: string;
}

const MOCK_THESIS = {
  id: "thesis-demo-1",
  slug: "algorithmic-feeds-erode-civic-discourse",
  title:
    "Algorithmic Feeds Systematically Erode the Conditions for Civic Discourse",
  author: { name: "Dr. Priya Anand", username: "panand" },
};

const MOCK_OBJECTS: Record<string, MockObject> = {
  "claim-thesis": {
    id: "claim-thesis",
    kind: "claim",
    text: "Engagement-optimized algorithmic feeds systematically erode the epistemic conditions for civic discourse.",
    label: "IN",
    attackCount: 4,
    undefendedAttackCount: 1,
    defendedAttackCount: 3,
    supportCount: 6,
    evidenceCount: 9,
    lastChangedAt: "2026-04-22T11:30:00Z",
  },
  "claim-prong-1": {
    id: "claim-prong-1",
    kind: "claim",
    text: "Engagement metrics structurally favor reactive over reflective content.",
    label: "IN",
    attackCount: 2,
    undefendedAttackCount: 0,
    defendedAttackCount: 2,
    supportCount: 4,
    evidenceCount: 5,
    lastChangedAt: "2026-04-21T17:10:00Z",
  },
  "claim-prong-2": {
    id: "claim-prong-2",
    kind: "claim",
    text: "Curatorial concentration narrows the range of arguments most users encounter.",
    label: "IN",
    attackCount: 3,
    undefendedAttackCount: 1,
    defendedAttackCount: 2,
    supportCount: 3,
    evidenceCount: 4,
    lastChangedAt: "2026-04-22T09:42:00Z",
  },
  "claim-prong-3": {
    id: "claim-prong-3",
    kind: "claim",
    text: "Repeated exposure to outrage-amplified framings degrades cross-cutting trust.",
    label: "UNDEC",
    attackCount: 1,
    undefendedAttackCount: 1,
    defendedAttackCount: 0,
    supportCount: 2,
    evidenceCount: 2,
    lastChangedAt: "2026-04-22T11:05:00Z",
  },
  "arg-1": {
    id: "arg-1",
    kind: "argument",
    text: "From the 2025 Reuters Institute panel: a 23% decrease in policy-relevant content reaching median users between 2020 and 2025 (Expert Opinion scheme).",
    label: "IN",
    attackCount: 1,
    undefendedAttackCount: 0,
    defendedAttackCount: 1,
    supportCount: 0,
    evidenceCount: 3,
    cqSatisfied: 4,
    cqTotal: 5,
    lastChangedAt: "2026-04-21T15:00:00Z",
  },
  "arg-2": {
    id: "arg-2",
    kind: "argument",
    text: "Pew 2024 cross-platform measurement: outrage-coded political content saw 340% amplification (Statistical Generalization scheme).",
    label: "IN",
    attackCount: 0,
    undefendedAttackCount: 0,
    defendedAttackCount: 0,
    supportCount: 1,
    evidenceCount: 2,
    cqSatisfied: 3,
    cqTotal: 4,
    lastChangedAt: "2026-04-20T14:00:00Z",
  },
  "arg-3": {
    id: "arg-3",
    kind: "argument",
    text: "Bail et al. cross-cutting exposure study shows trust erosion under high-arousal feeds (Argument from Cause to Effect).",
    label: "UNDEC",
    attackCount: 1,
    undefendedAttackCount: 1,
    defendedAttackCount: 0,
    supportCount: 0,
    evidenceCount: 1,
    cqSatisfied: 2,
    cqTotal: 5,
    lastChangedAt: "2026-04-22T11:05:00Z",
  },
  "prop-1": {
    id: "prop-1",
    kind: "proposition",
    text: "Recommendation systems are now the dominant editorial layer for >50% of US news exposure.",
    attackCount: 0,
    undefendedAttackCount: 0,
    defendedAttackCount: 0,
    supportCount: 2,
    evidenceCount: 1,
    lastChangedAt: "2026-04-19T08:00:00Z",
  },
  "cite-1": {
    id: "cite-1",
    kind: "citation",
    text: "Reuters Institute Digital News Report 2025, §4.2",
    attackCount: 0,
    undefendedAttackCount: 0,
    defendedAttackCount: 0,
    supportCount: 0,
    evidenceCount: 1,
    lastChangedAt: "2026-04-15T08:00:00Z",
  },
};

const MOCK_PRONGS = [
  { id: "prong-1", title: "1. Engagement metrics favor reactive content" },
  { id: "prong-2", title: "2. Curatorial concentration narrows discourse" },
  { id: "prong-3", title: "3. Outrage exposure degrades cross-cutting trust" },
];

interface MockAttack {
  id: string;
  targetId: string;
  targetText: string;
  attackerName: string;
  attackerHandle: string;
  attackType: "REBUTS" | "UNDERCUTS" | "UNDERMINES";
  status: "undefended" | "defended" | "conceded";
  filedAt: string;
  locution: string;
}

const MOCK_ATTACKS: MockAttack[] = [
  {
    id: "atk-1",
    targetId: "claim-prong-3",
    targetText:
      "Repeated exposure to outrage-amplified framings degrades cross-cutting trust.",
    attackerName: "Prof. James Williams",
    attackerHandle: "@jwilliams",
    attackType: "UNDERCUTS",
    status: "undefended",
    filedAt: "2026-04-22T11:05:00Z",
    locution:
      "The Bail et al. effect size doesn't replicate in 2024 cross-national data — the causal claim is not warranted at the strength used here.",
  },
  {
    id: "atk-2",
    targetId: "claim-prong-2",
    targetText:
      "Curatorial concentration narrows the range of arguments most users encounter.",
    attackerName: "Tomás Reyes",
    attackerHandle: "@treyes",
    attackType: "UNDERMINES",
    status: "undefended",
    filedAt: "2026-04-22T09:42:00Z",
    locution:
      "Premise that 'most users have a single primary feed' overstates: 2024 data shows 60% of news exposure now comes from 3+ sources.",
  },
  {
    id: "atk-3",
    targetId: "claim-prong-1",
    targetText:
      "Engagement metrics structurally favor reactive over reflective content.",
    attackerName: "Dr. Aisha Mbeki",
    attackerHandle: "@ambeki",
    attackType: "REBUTS",
    status: "defended",
    filedAt: "2026-04-19T13:00:00Z",
    locution:
      "Some platforms now optimize for 'meaningful interactions' which surface reflective content — claim is not universal.",
  },
  {
    id: "atk-4",
    targetId: "arg-1",
    targetText:
      "Reuters Institute panel: a 23% decrease in policy-relevant content...",
    attackerName: "Lin Wei",
    attackerHandle: "@linwei",
    attackType: "UNDERCUTS",
    status: "defended",
    filedAt: "2026-04-18T10:00:00Z",
    locution:
      "Reuters panel sample skews English-speaking; generalization to 'median users' overreaches.",
  },
  {
    id: "atk-5",
    targetId: "claim-prong-1",
    targetText:
      "Engagement metrics structurally favor reactive over reflective content.",
    attackerName: "Sarah Okonkwo",
    attackerHandle: "@sokonkwo",
    attackType: "REBUTS",
    status: "conceded",
    filedAt: "2026-04-15T08:00:00Z",
    locution:
      "Original phrasing 'always favor' was too strong — author conceded and softened to 'structurally favor'.",
  },
];

interface MockSnapshot {
  id: string;
  label: string;
  createdAt: string;
  confidenceAtCapture: number;
  attackCount: number;
  undefendedAttackCount: number;
}

const MOCK_SNAPSHOTS: MockSnapshot[] = [
  {
    id: "snap-3",
    label: "Pre-publication freeze",
    createdAt: "2026-04-22T11:30:00Z",
    confidenceAtCapture: 0.78,
    attackCount: 4,
    undefendedAttackCount: 1,
  },
  {
    id: "snap-2",
    label: "After Bail rebuttal incorporated",
    createdAt: "2026-04-19T16:00:00Z",
    confidenceAtCapture: 0.74,
    attackCount: 3,
    undefendedAttackCount: 0,
  },
  {
    id: "snap-1",
    label: "Initial draft for review",
    createdAt: "2026-04-15T10:00:00Z",
    confidenceAtCapture: 0.62,
    attackCount: 1,
    undefendedAttackCount: 1,
  },
];

const MOCK_BACKLINKS = [
  {
    id: "thesis-other-1",
    title: "Repairing the Public Square: Three Designs for Algorithmic Reform",
    via: "thesisClaim",
    authorName: "Dr. Aisha Mbeki",
  },
  {
    id: "thesis-other-2",
    title: "On Algorithmic Editorial Authority",
    via: "prongMain",
    authorName: "Prof. James Williams",
  },
  {
    id: "thesis-other-3",
    title: "Why Civic Trust Matters: A Comparative Study (FR/US 2025)",
    via: "content",
    authorName: "Tomás Reyes",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// D4 — CHAIN INTEGRATION MOCK DATA
// ─────────────────────────────────────────────────────────────────────────────

type ChainNodeRole =
  | "PREMISE"
  | "EVIDENCE"
  | "CONCLUSION"
  | "OBJECTION"
  | "REBUTTAL"
  | "QUALIFIER"
  | "COMMENT";

type ChainEdgeType =
  | "SUPPORTS"
  | "ENABLES"
  | "PRESUPPOSES"
  | "REFUTES"
  | "QUALIFIES"
  | "REBUTS"
  | "UNDERCUTS";

interface MockChainNode {
  id: string;
  role: ChainNodeRole;
  text: string;
  schemeName?: string;
  enabler?: string;
  justification?: string;
  attackCount: number;
  evidenceCount: number;
}

interface MockChainEdge {
  id: string;
  fromId: string;
  toId: string;
  edgeType: ChainEdgeType;
  description?: string;
}

interface MockChain {
  id: string;
  name: string;
  caption: string;
  role: "MAIN" | "SUPPORTING" | "OBJECTION_TARGET" | "COMPARISON";
  chainType: "SERIAL" | "CONVERGENT" | "DIVERGENT" | "TREE" | "GRAPH";
  description: string;
  purpose: string;
  nodeCount: number;
  edgeCount: number;
  attackCount: number;
  undefendedAttackCount: number;
  evidenceCount: number;
  lastChangedAt: string;
  nodes: MockChainNode[];
  edges: MockChainEdge[];
}

const MOCK_CHAIN: MockChain = {
  id: "chain-cpr-b275",
  name: "CPR B275–B279 — Refutation of Idealism",
  caption: "Reconstruction of Kant's Refutation of Idealism (B275–B279)",
  role: "MAIN",
  chainType: "GRAPH",
  description:
    "Kant's argument that the consciousness of my own existence in time is only possible through the existence of actual things outside me.",
  purpose:
    "Show how the temporal-determination premise PRESUPPOSES the persistence of outer objects.",
  nodeCount: 5,
  edgeCount: 6,
  attackCount: 2,
  undefendedAttackCount: 1,
  evidenceCount: 3,
  lastChangedAt: "2026-04-22T11:18:00Z",
  nodes: [
    {
      id: "cn-1",
      role: "PREMISE",
      text: "I am conscious of my own existence as determined in time.",
      schemeName: "Argument from Self-Knowledge",
      enabler:
        "IF a subject S is conscious of its existence as temporally determined, THEN S has temporal experience.",
      justification:
        "Taken from B275:1–3 — Kant's premise that inner sense gives temporally-ordered self-awareness.",
      attackCount: 0,
      evidenceCount: 1,
    },
    {
      id: "cn-2",
      role: "PREMISE",
      text: "All time-determination presupposes something permanent in perception.",
      schemeName: "Argument from Conditional Necessity",
      enabler:
        "IF temporal determination requires a fixed reference, THEN something permanent must exist in perception.",
      justification:
        "B275:4–7 — major (conditional) premise; permanence is the condition of temporal ordering.",
      attackCount: 1,
      evidenceCount: 1,
    },
    {
      id: "cn-3",
      role: "PREMISE",
      text: "This permanent cannot be in me, as my existence in time is itself what is to be determined.",
      schemeName: "Argument from Elimination",
      enabler:
        "IF the permanent is needed and cannot be the determinandum itself, THEN it must lie outside me.",
      justification:
        "B275:8–13 — eliminates the inner-permanent reading; this is the disputed step (Allison vs. Guyer).",
      attackCount: 1,
      evidenceCount: 0,
    },
    {
      id: "cn-4",
      role: "CONCLUSION",
      text: "Therefore, the permanent that makes time-determination possible is in something outside me.",
      schemeName: "Practical Inference",
      enabler:
        "IF the only viable permanent must be outside me, THEN outer things actually exist.",
      attackCount: 0,
      evidenceCount: 1,
    },
    {
      id: "cn-5",
      role: "OBJECTION",
      text: "Berkeleyan rejoinder: the permanent could be a divine idea, not an outer object.",
      schemeName: "Argument from Alternative Cause",
      enabler:
        "IF an alternative permanent (divine ideas) suffices, THEN the elimination step is not exhaustive.",
      attackCount: 0,
      evidenceCount: 0,
    },
  ],
  edges: [
    { id: "ce-1", fromId: "cn-1", toId: "cn-2", edgeType: "PRESUPPOSES", description: "Temporal awareness presupposes a permanent reference." },
    { id: "ce-2", fromId: "cn-2", toId: "cn-3", edgeType: "ENABLES", description: "Major premise enables the elimination step." },
    { id: "ce-3", fromId: "cn-3", toId: "cn-4", edgeType: "SUPPORTS" },
    { id: "ce-4", fromId: "cn-1", toId: "cn-4", edgeType: "SUPPORTS" },
    { id: "ce-5", fromId: "cn-5", toId: "cn-3", edgeType: "REBUTS", description: "Berkeleyan objection targets the elimination." },
    { id: "ce-6", fromId: "cn-5", toId: "ce-2", edgeType: "UNDERCUTS", description: "Recursive attack: undercuts the ENABLES inference." },
  ],
};

interface MockEnabler {
  argumentId: string;
  argumentText: string;
  schemeName: string;
  enablerText: string;
  role: "primary" | "supporting" | "presupposed";
  justification?: string;
  premiseCount: number;
}

const MOCK_PRONG_ENABLERS: MockEnabler[] = [
  {
    argumentId: "arg-1",
    argumentText:
      "Reuters Institute panel: 23% decrease in policy-relevant content reaching median users (Expert Opinion).",
    schemeName: "Argument from Expert Opinion",
    enablerText:
      "IF source E is an expert in domain S, AND E asserts A, THEN A is plausible.",
    role: "primary",
    justification:
      "Reuters Institute is the canonical authority on cross-platform news reach; the expert-opinion scheme is the right warrant here.",
    premiseCount: 3,
  },
  {
    argumentId: "arg-2",
    argumentText:
      "Pew 2024 cross-platform measurement: 340% amplification of outrage-coded political content (Statistical Generalization).",
    schemeName: "Argument from Statistical Generalization",
    enablerText:
      "IF the sample S is representative of population P, AND a property holds in S, THEN it holds in P.",
    role: "primary",
    premiseCount: 2,
  },
  {
    argumentId: "arg-2b",
    argumentText:
      "Engagement-ranking algorithms reward outrage-coded content because outrage produces sustained interaction.",
    schemeName: "Argument from Cause to Effect",
    enablerText:
      "IF cause C reliably produces effect E in context K, THEN producing C in K will produce E.",
    role: "supporting",
    justification:
      "Causal scheme picked over correlational alternatives because the optimization loop is mechanistic.",
    premiseCount: 2,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// PHASE FEATURE DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

interface PhaseFeature {
  id: string;
  step: string;
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
  iconColor: string;
  items: string[];
}

const PHASE_FEATURES: PhaseFeature[] = [
  {
    id: "live-endpoint",
    step: "1.1",
    title: "Batched /live Endpoint",
    description: "Single round-trip payload feeds every embedded TipTap node",
    icon: Radio,
    color: "from-indigo-500/10 to-violet-500/15",
    iconColor: "text-indigo-600",
    items: [
      "GET /api/thesis/[id]/live returns labels, attack counts, evidence, CQ status",
      "Walks thesis content JSON to collect embedded ids",
      "Joins ClaimLabel + ArgumentEdge + CQStatus + EvidenceLink",
      "Cache-Control: no-store; cursor reserved for delta mode",
      "Designed to swap to SSE/WebSocket later (D3 deferred)",
    ],
  },
  {
    id: "live-context",
    step: "1.2",
    title: "useThesisLive Hook & Context",
    description: "One SWR subscription per page; per-object lookup",
    icon: PlugZap,
    color: "from-indigo-500/10 to-violet-500/15",
    iconColor: "text-indigo-600",
    items: [
      "refreshInterval: 30s active / 120s when document.hidden",
      "revalidateOnFocus: true",
      "Context exposes openInspector + subscribeInspector",
      "useOpenInspector no-ops outside provider (safe)",
    ],
  },
  {
    id: "live-nodes",
    step: "1.3",
    title: "Live TipTap Node Bindings",
    description: "claim/argument/proposition/citation nodes read live stats",
    icon: Network,
    color: "from-indigo-500/10 to-violet-500/15",
    iconColor: "text-indigo-600",
    items: [
      "Live label dot (IN / OUT / UNDEC)",
      "Attack count badge (red if undefended)",
      "Evidence count + 'updated Xs ago'",
      "Subtle pulse on change",
      "Falls back to static attrs in editor / preview contexts",
    ],
  },
  {
    id: "drawer",
    step: "2.1",
    title: "ThesisInspectorDrawer",
    description: "Single right-side sheet for every embedded element",
    icon: PanelRightOpen,
    color: "from-violet-500/10 to-purple-500/15",
    iconColor: "text-violet-600",
    items: [
      "Tabs: Overview / Attacks / Provenance / Evidence / CQs / History",
      "Mounted once at the view-page level",
      "openInspector({kind, id, tab?}) dispatch from anywhere",
      "Per-kind tab visibility (TABS_BY_KIND)",
      "SWR-backed inspect endpoint per object",
    ],
  },
  {
    id: "inspect-endpoint",
    step: "2.3",
    title: "Inspect Endpoint",
    description: "GET /api/thesis/[id]/inspect/[kind]/[objectId]",
    icon: Database,
    color: "from-violet-500/10 to-purple-500/15",
    iconColor: "text-violet-600",
    items: [
      "Reuses per-claim / per-argument detail fetchers",
      "Returns lineage (sourceProposition, conclusion, premises)",
      "ClaimAttack records with attackingArgument + status",
      "Evidence + CQs in one payload",
    ],
  },
  {
    id: "register",
    step: "3.1",
    title: "ThesisAttackRegister",
    description: "Sticky panel grouped by Undefended / Defended / Conceded",
    icon: Swords,
    color: "from-rose-500/10 to-orange-500/15",
    iconColor: "text-rose-600",
    items: [
      "Each entry → scrolls + opens inspector on Attacks tab",
      "Filter pills, live count updates on poll",
      "Author / locution / filed-at metadata",
      "Per-element ⚔ / 🛡 badges update live",
    ],
  },
  {
    id: "attacks-endpoint",
    step: "3.2",
    title: "Attacks Endpoint",
    description: "GET /api/thesis/[id]/attacks?status=…",
    icon: Target,
    color: "from-rose-500/10 to-orange-500/15",
    iconColor: "text-rose-600",
    items: [
      "Server-side filter/sort over Phase 1 data",
      "ClaimAttack + ArgumentEdge UNDERCUTS/REBUTS join",
      "?status=all variant for snapshot freezes",
    ],
  },
  {
    id: "formula",
    step: "4.1",
    title: "Pure Confidence Formula",
    description: "Per-prong + per-thesis scoring with explicit weights",
    icon: Brain,
    color: "from-fuchsia-500/10 to-violet-500/15",
    iconColor: "text-fuchsia-600",
    items: [
      "Prong: argLabelIn 0.40 · cqSatisfied 0.25 · attacksDefended 0.20 · evidence 0.15",
      "Thesis: prongAggregate 0.70 · thesisClaimLabel 0.20 · attackPosture 0.10",
      "Levels: high ≥ 0.7, medium ≥ 0.4, else low",
      "Pure functions in lib/thesis/confidence.ts; trivial to unit-test",
    ],
  },
  {
    id: "confidence-badge",
    step: "4.3",
    title: "ConfidenceBadge with Audit",
    description: "Hover-card lists every input × weight = contribution",
    icon: Gauge,
    color: "from-fuchsia-500/10 to-violet-500/15",
    iconColor: "text-fuchsia-600",
    items: [
      "Mounted overall on view page header",
      "Per-prong badge in ThesisRenderer prong headers",
      "refs[] deep-link via useOpenInspector",
      "'computed Xs ago' + manual recompute",
    ],
  },
  {
    id: "snapshot-model",
    step: "5.1",
    title: "ThesisSnapshot Model",
    description: "User-triggered point-in-time freezes for citers",
    icon: Camera,
    color: "from-amber-500/10 to-orange-500/15",
    iconColor: "text-amber-600",
    items: [
      "contentJson + statsSnapshot + confidenceSnapshot + attacksSnapshot",
      "parentSnapshotId self-relation for lineage",
      "Author-only create (403 otherwise)",
      "Auto-snapshot workers deferred (D1)",
    ],
  },
  {
    id: "snapshot-views",
    step: "5.4",
    title: "Frozen View + Diff Viewer",
    description: "/view/snapshot/[id] renders without ThesisLiveProvider",
    icon: GitCompare,
    color: "from-amber-500/10 to-orange-500/15",
    iconColor: "text-amber-600",
    items: [
      "Permanent amber 'frozen, not live' banner",
      "Bottom stats summary (objects, attacks, confidence)",
      "ThesisSnapshotManager panel on view page",
      "Diff: per-object delta status with confidence Δ",
    ],
  },
  {
    id: "focus-routing",
    step: "6.1",
    title: "?focus= Entry-Point Routing",
    description: "URL deep-link resolver — accepts id or Claim moid",
    icon: Link2,
    color: "from-emerald-500/10 to-teal-500/15",
    iconColor: "text-emerald-600",
    items: [
      "GET /api/thesis/[id]/focus?ref=…&hint=…",
      "ThesisFocusHandler scrolls + dispatches openInspector",
      "?tab=attacks lands on Attacks tab",
      "Deduped per signature (no replays)",
    ],
  },
  {
    id: "provenance-walks",
    step: "6.2",
    title: "Clickable Provenance Walks",
    description: "Every lineage row in Provenance tab opens its target",
    icon: Workflow,
    color: "from-emerald-500/10 to-teal-500/15",
    iconColor: "text-emerald-600",
    items: [
      "ObjectRow extended with onOpen + open chip",
      "Claim → source proposition → arguments enrolled in",
      "Argument → premises → conclusion → attacks",
      "No new endpoints — reuses Phase 2 inspect data",
    ],
  },
  {
    id: "backlinks",
    step: "6.3",
    title: "'Used in' Backlinks",
    description: "GET /api/objects/[kind]/[id]/backlinks",
    icon: CornerDownRight,
    color: "from-emerald-500/10 to-teal-500/15",
    iconColor: "text-emerald-600",
    items: [
      "Theses: thesisClaim / prongMain / prongArgument / content scan",
      "Arguments: claim → conclusion + premise role",
      "Claims: proposition → promotedClaim",
      "Lazily loaded (SWR 30s dedupe) in ProvenanceTab footer",
    ],
  },
];

const PHASE_BANDS = [
  { id: "phase1", label: "Phase 1", title: "Live Binding", color: "from-indigo-500/10 to-violet-500/15", iconColor: "text-indigo-600", icon: Radio, done: true, active: false },
  { id: "phase2", label: "Phase 2", title: "Inspector", color: "from-violet-500/10 to-purple-500/15", iconColor: "text-violet-600", icon: PanelRightOpen, done: true, active: false },
  { id: "phase3", label: "Phase 3", title: "Attack Register", color: "from-rose-500/10 to-orange-500/15", iconColor: "text-rose-600", icon: Swords, done: true, active: false },
  { id: "phase4", label: "Phase 4", title: "Confidence", color: "from-fuchsia-500/10 to-violet-500/15", iconColor: "text-fuchsia-600", icon: Gauge, done: true, active: false },
  { id: "phase5", label: "Phase 5", title: "Snapshots", color: "from-amber-500/10 to-orange-500/15", iconColor: "text-amber-600", icon: Camera, done: true, active: false },
  { id: "phase6", label: "Phase 6", title: "Traversals", color: "from-emerald-500/10 to-teal-500/15", iconColor: "text-emerald-600", icon: Workflow, done: true, active: false },
  { id: "phase7", label: "Phase 7", title: "Hardening", color: "from-slate-500/10 to-zinc-500/15", iconColor: "text-slate-500", icon: ShieldCheck, done: true, active: false },
];

const FILES = [
  { type: "endpoint", path: "app/api/thesis/[id]/live/route.ts", desc: "Phase 1.1 — batched live stats" },
  { type: "endpoint", path: "app/api/thesis/[id]/inspect/[kind]/[objectId]/route.ts", desc: "Phase 2.3 — joined detail blob" },
  { type: "endpoint", path: "app/api/thesis/[id]/attacks/route.ts", desc: "Phase 3.2 — register filter/sort" },
  { type: "endpoint", path: "app/api/thesis/[id]/confidence/route.ts", desc: "Phase 4.2 — confidence breakdown" },
  { type: "endpoint", path: "app/api/thesis/[id]/snapshots/route.ts", desc: "Phase 5.2 — list / create snapshots" },
  { type: "endpoint", path: "app/api/thesis/[id]/snapshots/[snapshotId]/compare/route.ts", desc: "Phase 5.4 — diff against id|live" },
  { type: "endpoint", path: "app/api/thesis/[id]/focus/route.ts", desc: "Phase 6.1 — id|moid resolver" },
  { type: "endpoint", path: "app/api/objects/[kind]/[id]/backlinks/route.ts", desc: "Phase 6.3 — cross-thesis backlinks" },
  { type: "client", path: "lib/thesis/ThesisLiveContext.tsx", desc: "Phase 1.2 — provider + hooks" },
  { type: "client", path: "lib/thesis/confidence.ts", desc: "Phase 4.1 — pure formula" },
  { type: "client", path: "components/thesis/ThesisInspectorDrawer.tsx", desc: "Phase 2.1 — right-side sheet" },
  { type: "client", path: "components/thesis/ThesisAttackRegister.tsx", desc: "Phase 3.1 — sticky panel" },
  { type: "client", path: "components/thesis/ConfidenceBadge.tsx", desc: "Phase 4.3 — audit popover" },
  { type: "client", path: "components/thesis/ThesisSnapshotManager.tsx", desc: "Phase 5.3 — capture & list" },
  { type: "client", path: "components/thesis/ThesisSnapshotDiff.tsx", desc: "Phase 5.4 — diff viewer" },
  { type: "client", path: "components/thesis/ThesisFocusHandler.tsx", desc: "Phase 6.1 — ?focus dispatch" },
  { type: "client", path: "lib/thesis/observability.ts", desc: "Phase 7.1 — reader-poll structured logger" },
  { type: "client", path: "lib/thesis/permissions.ts", desc: "Phase 7.2 — read/write gates + backlinks redaction" },
  { type: "endpoint", path: "app/api/thesis/[id]/prongs/[prongId]/route.ts", desc: "D4.W3 — GET single prong with argumentSchemes" },
  { type: "client", path: "lib/tiptap/extensions/argument-chain-node.tsx", desc: "D4.W1 — TipTap atom for embedded chains" },
  { type: "client", path: "components/thesis/ArgumentChainEmbedView.tsx", desc: "D4.W1 — readonly ReactFlow embed" },
  { type: "client", path: "components/thesis/ArgumentChainPicker.tsx", desc: "D4.W1 — slash-menu chain picker" },
  { type: "client", path: "lib/thesis/chain-references.ts", desc: "D4.W2 — ThesisChainReference materialization (BOTH-mode)" },
  { type: "client", path: "components/chains/EnablerPanel.tsx", desc: "D4.W3 — assumption surface (reused in ProngEditor)" },
];

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE CARD
// ─────────────────────────────────────────────────────────────────────────────

function FeatureCard({ feature }: { feature: PhaseFeature }) {
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
              <span className="text-[10px] font-bold text-slate-400 font-mono">Step {feature.step}</span>
              <p className="font-semibold text-slate-900 text-[14px] leading-tight">{feature.title}</p>
              <p className="text-xs text-slate-500 mt-0.5 leading-snug">{feature.description}</p>
            </div>
          </div>
          <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-700 border border-emerald-500/25">
            <Check className="w-3 h-3" />
            Shipped
          </span>
        </div>
      </div>
      <div className="px-5 pb-5 flex-1">
        <ul className="space-y-1.5">
          {feature.items.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-[12.5px] text-slate-600 leading-snug">
              <div className="w-1 h-1 rounded-full bg-indigo-400/70 flex-shrink-0 mt-[5px]" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LIVE CHIP
// ─────────────────────────────────────────────────────────────────────────────

function LiveChip({ obj }: { obj: MockObject }) {
  const labelStyle: Record<LiveLabel, string> = {
    IN: "bg-emerald-100 text-emerald-700 border-emerald-200",
    OUT: "bg-rose-100 text-rose-700 border-rose-200",
    UNDEC: "bg-amber-100 text-amber-700 border-amber-200",
  };
  return (
    <span className="inline-flex items-center gap-1 align-middle">
      {obj.label && (
        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-[9px] uppercase tracking-wide font-semibold ${labelStyle[obj.label]}`}>
          <CircleDot className="w-2.5 h-2.5" />
          {obj.label}
        </span>
      )}
      {obj.undefendedAttackCount > 0 ? (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-rose-200 bg-rose-50 text-rose-700 text-[9px] font-semibold">
          <Swords className="w-2.5 h-2.5" />
          {obj.undefendedAttackCount}
        </span>
      ) : obj.defendedAttackCount > 0 ? (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-emerald-200 bg-emerald-50 text-emerald-700 text-[9px] font-semibold">
          <Shield className="w-2.5 h-2.5" />
          {obj.defendedAttackCount}
        </span>
      ) : null}
      {obj.evidenceCount > 0 && (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-600 text-[9px] font-semibold">
          <BookOpen className="w-2.5 h-2.5" />
          {obj.evidenceCount}
        </span>
      )}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LIVE BINDING DEMO
// ─────────────────────────────────────────────────────────────────────────────

function LiveBindingDemo({ onOpenInspector }: { onOpenInspector: (id: string) => void }) {
  const [tick, setTick] = useState(0);
  const [pulseId, setPulseId] = useState<string | null>(null);

  const simulatePoll = () => {
    setTick((t) => t + 1);
    const ids = Object.keys(MOCK_OBJECTS);
    const randId = ids[Math.floor(Math.random() * ids.length)];
    setPulseId(randId);
    toast.success("Polled /api/thesis/[id]/live — payload merged into context");
    setTimeout(() => setPulseId(null), 1500);
  };

  const NodeButton = ({
    id,
    label,
    tone = "claim",
  }: {
    id: string;
    label: string;
    tone?: "claim" | "argument";
  }) => {
    const obj = MOCK_OBJECTS[id];
    const styles =
      tone === "claim"
        ? "bg-indigo-50 border-indigo-200 text-indigo-800 hover:bg-indigo-100"
        : "bg-violet-50 border-violet-200 text-violet-800 hover:bg-violet-100";
    return (
      <button
        onClick={() => onOpenInspector(id)}
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[12.5px] transition ${styles} ${
          pulseId === id ? "ring-2 ring-indigo-400 animate-pulse" : ""
        }`}
      >
        <span>{label}</span>
        <LiveChip obj={obj} />
      </button>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5 mb-1">
        <div className="p-1.5 rounded-lg bg-gradient-to-br from-indigo-500/12 to-violet-500/12 text-indigo-600">
          <Radio className="w-4 h-4" />
        </div>
        <p className="font-semibold text-slate-900 text-lg">Live Binding</p>
        <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gradient-to-r from-indigo-500/10 to-violet-500/10 text-indigo-700 border border-indigo-500/20">
          Interactive
        </span>
      </div>
      <p className="text-sm text-slate-500">
        A single batched <code className="text-xs px-1 py-0.5 rounded bg-slate-100">/live</code> endpoint feeds every embedded TipTap node via SWR (30s active / 120s hidden).
      </p>

      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-2.5">
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <Activity className="w-4 h-4 text-indigo-500" />
          <span>
            SWR poll <strong className="text-slate-800">#{tick}</strong> · refreshInterval 30s · revalidateOnFocus
          </span>
        </div>
        <Button size="sm" variant="outline" onClick={simulatePoll} className="h-7 text-xs">
          <RefreshCw className="w-3 h-3 mr-1" />
          Simulate poll
        </Button>
      </div>

      <div className="cardv2 p-6">
        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-2">
          Living thesis · {MOCK_THESIS.author.name}
        </p>
        <h3 className="text-base font-semibold text-slate-900 mb-3 leading-snug">{MOCK_THESIS.title}</h3>
        <p className="text-sm text-slate-700 leading-relaxed">
          We argue that <NodeButton id="claim-thesis" label={MOCK_OBJECTS["claim-thesis"].text} /> on three grounds. First,{" "}
          <NodeButton id="claim-prong-1" label={MOCK_OBJECTS["claim-prong-1"].text} />, supported by{" "}
          <NodeButton id="arg-1" label="Reuters Institute panel" tone="argument" />.
        </p>
        <p className="text-sm text-slate-700 leading-relaxed mt-3">
          Second, <NodeButton id="claim-prong-2" label={MOCK_OBJECTS["claim-prong-2"].text} />. Third,{" "}
          <NodeButton id="claim-prong-3" label={MOCK_OBJECTS["claim-prong-3"].text} />.
        </p>
      </div>

      <div className="rounded-xl border border-slate-900/[0.08] bg-slate-950 text-slate-100 p-4 font-mono text-[11px] overflow-x-auto">
        <p className="text-slate-400 mb-1.5">{"// GET /api/thesis/"}{MOCK_THESIS.id}{"/live"}</p>
        <pre className="text-slate-200 leading-relaxed">{`{
  "cursor":     "${1745000000 + tick * 30000}",
  "computedAt": "2026-04-22T11:30:${String((tick * 7) % 60).padStart(2, "0")}Z",
  "objects": {
    "claim-thesis":  { "label": "IN",    "attackCount": 4, "undefendedAttackCount": 1, ... },
    "claim-prong-1": { "label": "IN",    "attackCount": 2, "undefendedAttackCount": 0, ... },
    "claim-prong-2": { "label": "IN",    "attackCount": 3, "undefendedAttackCount": 1, ... },
    "claim-prong-3": { "label": "UNDEC", "attackCount": 1, "undefendedAttackCount": 1, ... },
    "arg-1":         { "label": "IN",    "cqSatisfied": 4, "cqTotal": 5, ... },
    ...
  }
}`}</pre>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INSPECTOR DEMO
// ─────────────────────────────────────────────────────────────────────────────

const INSPECTOR_TABS = ["Overview", "Attacks", "Provenance", "Evidence", "CQs", "History"] as const;

function InspectorDemo({
  selectedId,
  setSelectedId,
}: {
  selectedId: string;
  setSelectedId: (id: string) => void;
}) {
  const [tab, setTab] = useState<(typeof INSPECTOR_TABS)[number]>("Overview");
  const obj = MOCK_OBJECTS[selectedId];
  const tabs = useMemo(() => {
    if (obj.kind === "argument") return INSPECTOR_TABS;
    if (obj.kind === "claim") return INSPECTOR_TABS.filter((t) => t !== "CQs");
    return ["Overview", "Provenance", "History"] as const;
  }, [obj.kind]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5 mb-1">
        <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500/12 to-purple-500/12 text-violet-600">
          <PanelRightOpen className="w-4 h-4" />
        </div>
        <p className="font-semibold text-slate-900 text-lg">Inspection Drawer</p>
        <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gradient-to-r from-violet-500/10 to-purple-500/10 text-violet-700 border border-violet-500/20">
          Interactive
        </span>
      </div>
      <p className="text-sm text-slate-500">
        One sheet, every object. Click a node above (or pick one below) to open it — then walk lineage with single clicks.
      </p>

      <div className="flex flex-wrap gap-1.5">
        {Object.values(MOCK_OBJECTS).map((o) => (
          <button
            key={o.id}
            onClick={() => {
              setSelectedId(o.id);
              setTab("Overview");
            }}
            className={`text-[11px] px-2 py-1 rounded-lg border font-mono transition ${
              selectedId === o.id
                ? "border-violet-400 bg-violet-50 text-violet-700"
                : "border-slate-200 hover:border-violet-300 text-slate-600"
            }`}
          >
            {o.kind}: {o.id}
          </button>
        ))}
      </div>

      <div className="cardv2 overflow-hidden">
        <div className="border-b border-slate-200/70 px-5 py-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-slate-100 text-slate-600 border border-slate-200">
                {obj.kind}
              </span>
              <code className="text-[10px] text-slate-400">{obj.id}</code>
              <LiveChip obj={obj} />
            </div>
            <p className="text-sm font-medium text-slate-800 mt-2 leading-snug">{obj.text}</p>
          </div>
          <button onClick={() => toast.info("Drawer closed")} className="p-1 rounded hover:bg-slate-100 text-slate-400 shrink-0">
            ✕
          </button>
        </div>

        <div className="border-b border-slate-200/70 px-2 flex items-center gap-1 overflow-x-auto bg-slate-50/40">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-2 text-xs font-medium border-b-2 transition ${
                tab === t ? "border-violet-500 text-violet-700" : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="p-5 max-h-[420px] overflow-y-auto bg-white">
          {tab === "Overview" && <InspectorOverview obj={obj} />}
          {tab === "Attacks" && <InspectorAttacks attacks={MOCK_ATTACKS.filter((a) => a.targetId === obj.id)} />}
          {tab === "Provenance" && <InspectorProvenance obj={obj} setSelectedId={setSelectedId} />}
          {tab === "Evidence" && <InspectorEvidence obj={obj} />}
          {tab === "CQs" && obj.kind === "argument" && <InspectorCqs obj={obj} />}
          {tab === "History" && <InspectorHistory obj={obj} />}
        </div>
      </div>
    </div>
  );
}

function InspectorOverview({ obj }: { obj: MockObject }) {
  return (
    <div className="space-y-3">
      <div
        className={`rounded-lg border px-3 py-2 text-xs ${
          obj.label === "IN"
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : obj.label === "OUT"
              ? "border-rose-200 bg-rose-50 text-rose-800"
              : "border-amber-200 bg-amber-50 text-amber-800"
        }`}
      >
        <span className="font-bold uppercase tracking-wider">Live label:</span>{" "}
        <span className="font-mono">{obj.label ?? "—"}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <MiniStat icon={Swords} label="Attacks" value={`${obj.attackCount} total · ${obj.undefendedAttackCount} undefended`} />
        <MiniStat icon={Shield} label="Defended" value={`${obj.defendedAttackCount}`} />
        <MiniStat icon={Lightbulb} label="Supports" value={`${obj.supportCount}`} />
        <MiniStat icon={BookOpen} label="Evidence" value={`${obj.evidenceCount}`} />
        {obj.cqTotal !== undefined && <MiniStat icon={ListChecks} label="Critical Qs" value={`${obj.cqSatisfied}/${obj.cqTotal} satisfied`} />}
        <MiniStat icon={Clock} label="Last changed" value={new Date(obj.lastChangedAt).toLocaleString()} />
      </div>
    </div>
  );
}

function InspectorAttacks({ attacks }: { attacks: MockAttack[] }) {
  if (attacks.length === 0) return <p className="text-xs text-slate-500 italic">No attacks against this object.</p>;
  return (
    <div className="space-y-2">
      {attacks.map((a) => (
        <div
          key={a.id}
          className={`rounded-lg border p-3 ${
            a.status === "undefended"
              ? "border-rose-200 bg-rose-50/60"
              : a.status === "defended"
                ? "border-emerald-200 bg-emerald-50/60"
                : "border-slate-200 bg-slate-50/60"
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                a.status === "undefended"
                  ? "bg-rose-600 text-white"
                  : a.status === "defended"
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-500 text-white"
              }`}
            >
              {a.attackType} · {a.status}
            </span>
            <span className="text-[10px] text-slate-500">{new Date(a.filedAt).toLocaleDateString()}</span>
          </div>
          <p className="text-xs text-slate-700 italic leading-snug">&ldquo;{a.locution}&rdquo;</p>
          <p className="text-[10px] text-slate-500 mt-1">— {a.attackerName} {a.attackerHandle}</p>
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        onClick={() => toast.info("Opens attack composer prefilled with target")}
        className="w-full text-xs h-8"
      >
        <Target className="w-3 h-3 mr-1" />
        File an attack
      </Button>
    </div>
  );
}

function InspectorProvenance({
  obj,
  setSelectedId,
}: {
  obj: MockObject;
  setSelectedId: (id: string) => void;
}) {
  const link = (id: string, label: string, sub?: string) => (
    <button
      onClick={() => setSelectedId(id)}
      className="w-full text-left rounded-lg border border-slate-200 bg-white p-2.5 hover:border-violet-400 hover:bg-violet-50/50 transition"
    >
      <p className="text-xs text-slate-800 leading-snug">{label}</p>
      <div className="mt-1 flex items-center justify-between">
        {sub && <span className="text-[10px] uppercase tracking-wide text-slate-500">{sub}</span>}
        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-400 ml-auto">
          <ExternalLink className="w-3 h-3" />
          open
        </span>
      </div>
    </button>
  );
  return (
    <div className="space-y-3">
      {obj.kind === "claim" && (
        <>
          <SectionLabel>Source proposition</SectionLabel>
          {link("prop-1", MOCK_OBJECTS["prop-1"].text, "PUBLISHED")}
          <SectionLabel>Argued for in (2)</SectionLabel>
          {link("arg-1", MOCK_OBJECTS["arg-1"].text, "Expert Opinion")}
          {link("arg-2", MOCK_OBJECTS["arg-2"].text, "Statistical Generalization")}
        </>
      )}
      {obj.kind === "argument" && (
        <>
          <SectionLabel>Conclusion</SectionLabel>
          {link("claim-prong-1", MOCK_OBJECTS["claim-prong-1"].text)}
          <SectionLabel>Premises (2)</SectionLabel>
          {link("prop-1", MOCK_OBJECTS["prop-1"].text)}
          {link("cite-1", MOCK_OBJECTS["cite-1"].text)}
        </>
      )}
      {obj.kind === "proposition" && (
        <>
          <SectionLabel>Promoted to claim</SectionLabel>
          {link("claim-prong-1", MOCK_OBJECTS["claim-prong-1"].text, "IN")}
        </>
      )}
      <div className="pt-3 mt-2 border-t border-slate-200/70">
        <SectionLabel>Used in</SectionLabel>
        <div className="space-y-1.5 mt-2">
          {MOCK_BACKLINKS.map((b) => (
            <button
              key={b.id}
              onClick={() => toast.info(`→ ${b.title}`)}
              className="w-full text-left rounded-lg border border-slate-200 bg-white p-2.5 hover:border-emerald-400 hover:bg-emerald-50/40 transition"
            >
              <p className="text-xs text-slate-800 leading-snug">{b.title}</p>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-[10px] text-slate-500">via {b.via} · {b.authorName}</span>
                <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                  <ExternalLink className="w-3 h-3" />
                  open
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function InspectorEvidence({ obj }: { obj: MockObject }) {
  if (obj.evidenceCount === 0) return <p className="text-xs text-slate-500 italic">No evidence linked.</p>;
  return (
    <div className="space-y-2">
      {Array.from({ length: Math.min(obj.evidenceCount, 4) }).map((_, i) => (
        <div key={i} className="rounded-lg border border-slate-200 bg-white p-2.5">
          <p className="text-xs text-slate-800 font-medium">Reuters Institute Digital News Report 2025, §4.{i + 2}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Excerpt locator · added 2026-04-{15 + i}</p>
        </div>
      ))}
    </div>
  );
}

function InspectorCqs({ obj }: { obj: MockObject }) {
  const cqs = [
    { key: "expertise", q: "Is the source actually an expert in the field?", ok: true },
    { key: "field", q: "Is the assertion within the expert's domain?", ok: true },
    { key: "consensus", q: "Does it conflict with other expert opinion?", ok: true },
    { key: "evidence", q: "Is the assertion based on evidence?", ok: true },
    { key: "trustworthiness", q: "Is the expert personally trustworthy?", ok: false },
  ];
  return (
    <div className="space-y-1.5">
      {cqs.slice(0, obj.cqTotal ?? 0).map((c) => (
        <div key={c.key} className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-2.5">
          {c.ok ? (
            <Check className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
          ) : (
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
          )}
          <div>
            <p className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">{c.key}</p>
            <p className="text-xs text-slate-700 leading-snug">{c.q}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function InspectorHistory({ obj }: { obj: MockObject }) {
  return (
    <div className="space-y-1.5">
      {[
        { ts: obj.lastChangedAt, what: "Live stats recomputed" },
        { ts: "2026-04-19T13:00:00Z", what: "Attack filed by @ambeki" },
        { ts: "2026-04-15T08:00:00Z", what: "Object promoted from proposition" },
      ].map((h, i) => (
        <div key={i} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-2.5 text-xs">
          <span className="text-slate-700">{h.what}</span>
          <span className="text-[10px] text-slate-500 font-mono">{new Date(h.ts).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{children}</div>;
}

function MiniStat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-slate-500 font-semibold">
        <Icon className="w-3 h-3" />
        {label}
      </div>
      <p className="text-xs text-slate-800 mt-0.5">{value}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ATTACK REGISTER DEMO
// ─────────────────────────────────────────────────────────────────────────────

function AttackRegisterDemo({ onOpenInspector }: { onOpenInspector: (id: string) => void }) {
  const [filter, setFilter] = useState<"all" | "undefended" | "defended" | "conceded">("all");
  const visible = MOCK_ATTACKS.filter((a) => filter === "all" || a.status === filter);
  const groups = {
    undefended: visible.filter((a) => a.status === "undefended"),
    defended: visible.filter((a) => a.status === "defended"),
    conceded: visible.filter((a) => a.status === "conceded"),
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5 mb-1">
        <div className="p-1.5 rounded-lg bg-gradient-to-br from-rose-500/12 to-orange-500/12 text-rose-600">
          <Swords className="w-4 h-4" />
        </div>
        <p className="font-semibold text-slate-900 text-lg">Attack Register</p>
        <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gradient-to-r from-rose-500/10 to-orange-500/10 text-rose-700 border border-rose-500/20">
          Policy priority #1
        </span>
      </div>
      <p className="text-sm text-slate-500">
        Sticky panel grouped by status. &ldquo;0 undefended attacks&rdquo; is a current state, not an assertion.
      </p>

      <div className="flex items-center gap-1.5 flex-wrap">
        {(["all", "undefended", "defended", "conceded"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-[11px] px-2.5 py-1 rounded-full border font-medium transition ${
              filter === f
                ? "border-rose-400 bg-rose-50 text-rose-700"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {(["undefended", "defended", "conceded"] as const).map((status) => {
          const items = groups[status];
          if (items.length === 0) return null;
          const styles = {
            undefended: "border-rose-200 bg-rose-50/40",
            defended: "border-emerald-200 bg-emerald-50/40",
            conceded: "border-slate-200 bg-slate-50/40",
          } as const;
          const iconColors = {
            undefended: "text-rose-600",
            defended: "text-emerald-600",
            conceded: "text-slate-500",
          } as const;
          const Icon = status === "undefended" ? Swords : status === "defended" ? ShieldCheck : Check;
          return (
            <div key={status} className={`rounded-xl border p-4 ${styles[status]}`}>
              <div className="flex items-center gap-2 mb-3">
                <Icon className={`w-4 h-4 ${iconColors[status]}`} />
                <span className="text-xs uppercase font-bold tracking-wider text-slate-700">{status}</span>
                <span className="text-[10px] font-mono text-slate-500">({items.length})</span>
              </div>
              <div className="space-y-2">
                {items.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => onOpenInspector(a.targetId)}
                    className="w-full text-left rounded-lg border border-white bg-white p-3 hover:shadow-md hover:border-slate-200 transition"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide bg-slate-100 text-slate-700 border border-slate-200">
                        {a.attackType}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">{new Date(a.filedAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-xs text-slate-800 line-clamp-1 font-semibold">→ {a.targetText}</p>
                    <p className="text-[11px] text-slate-600 italic mt-1 line-clamp-2 leading-snug">&ldquo;{a.locution}&rdquo;</p>
                    <p className="text-[10px] text-slate-500 mt-1.5">{a.attackerName} {a.attackerHandle}</p>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIDENCE AUDIT DEMO
// ─────────────────────────────────────────────────────────────────────────────

const PRONG_INPUTS = [
  { key: "argLabelIn", name: "Arguments labelled IN", value: 0.83, weight: 0.4 },
  { key: "cqSatisfied", name: "CQs satisfied", value: 0.7, weight: 0.25 },
  { key: "attacksDefended", name: "Attacks defended", value: 0.67, weight: 0.2 },
  { key: "evidenceDensity", name: "Evidence density", value: 0.5, weight: 0.15 },
];

function ConfidenceAuditDemo() {
  const [showAudit, setShowAudit] = useState(true);
  const overall = 0.78;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5 mb-1">
        <div className="p-1.5 rounded-lg bg-gradient-to-br from-fuchsia-500/12 to-violet-500/12 text-fuchsia-600">
          <Gauge className="w-4 h-4" />
        </div>
        <p className="font-semibold text-slate-900 text-lg">Confidence Audit</p>
        <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gradient-to-r from-fuchsia-500/10 to-violet-500/10 text-fuchsia-700 border border-fuchsia-500/20">
          Policy priority #2
        </span>
      </div>
      <p className="text-sm text-slate-500">
        0.78 isn&apos;t asserted — it&apos;s inspectable down to its computation. Pure formula in <code className="text-xs px-1 py-0.5 rounded bg-slate-100">lib/thesis/confidence.ts</code>.
      </p>

      <div className="cardv2 p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#e2e8f0"
                  strokeWidth="3"
                />
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="url(#cgrad)"
                  strokeWidth="3"
                  strokeDasharray={`${overall * 100}, 100`}
                  strokeLinecap="round"
                />
                <defs>
                  <linearGradient id="cgrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#d946ef" />
                    <stop offset="100%" stopColor="#8b5cf6" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-base font-bold text-fuchsia-700">
                {(overall * 100).toFixed(0)}
              </div>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Overall confidence</p>
              <p className="text-base font-semibold text-slate-900">
                <span className="text-emerald-600">High</span> · <span className="font-mono">0.78</span>
              </p>
              <p className="text-[11px] text-slate-500">computed 12s ago</p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => setShowAudit(!showAudit)} className="text-xs h-8">
            {showAudit ? "Hide audit" : "Audit formula"}
          </Button>
        </div>

        {showAudit && (
          <div className="mt-4 pt-4 border-t border-slate-200/70 space-y-4">
            <div>
              <SectionLabel>Thesis aggregate (weights sum to 1)</SectionLabel>
              <div className="mt-2 space-y-1">
                <ContribRow name="Prong aggregate" value={0.74} weight={0.7} />
                <ContribRow name="Thesis claim label (IN)" value={1.0} weight={0.2} />
                <ContribRow name="Thesis attack posture" value={0.6} weight={0.1} />
              </div>
            </div>
            <div className="pt-4 border-t border-slate-200/70">
              <SectionLabel>Prong 1 — argument-level inputs</SectionLabel>
              <div className="mt-2 space-y-1">
                {PRONG_INPUTS.map((inp) => (
                  <ContribRow key={inp.key} name={inp.name} value={inp.value} weight={inp.weight} />
                ))}
              </div>
            </div>
            <p className="text-[11px] text-slate-500 italic">
              Each input row links via <code className="text-[10px] px-1 py-0.5 rounded bg-slate-100">refs[]</code> to the underlying objects via{" "}
              <code className="text-[10px] px-1 py-0.5 rounded bg-slate-100">useOpenInspector</code>. Levels: high ≥ 0.7, medium ≥ 0.4.
            </p>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <SectionLabel>Per-prong strength</SectionLabel>
        <div className="space-y-1.5 mt-1">
          {MOCK_PRONGS.map((p, i) => {
            const score = [0.82, 0.71, 0.55][i];
            return (
              <div key={p.id} className="cardv2 px-4 py-3 flex items-center justify-between">
                <p className="text-xs font-medium text-slate-700 truncate">{p.title}</p>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-32 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className={`h-full ${score >= 0.7 ? "bg-emerald-500" : score >= 0.4 ? "bg-amber-500" : "bg-rose-500"}`}
                      style={{ width: `${score * 100}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-mono w-10 text-right text-slate-700">{score.toFixed(2)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ContribRow({ name, value, weight }: { name: string; value: number; weight: number }) {
  const contribution = value * weight;
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-[11px]">
      <span className="text-slate-700 truncate flex-1">{name}</span>
      <span className="font-mono text-slate-600 shrink-0 text-right">
        {value.toFixed(2)} × {weight.toFixed(2)} ={" "}
        <span className="text-fuchsia-700 font-semibold">{contribution.toFixed(3)}</span>
      </span>
      <div className="w-20 h-1 rounded-full bg-slate-200 overflow-hidden shrink-0">
        <div
          className="h-full bg-gradient-to-r from-fuchsia-500 to-violet-500"
          style={{ width: `${Math.min(contribution * 200, 100)}%` }}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SNAPSHOTS DEMO
// ─────────────────────────────────────────────────────────────────────────────

function SnapshotsDemo() {
  const [a, setA] = useState("snap-3");
  const [b, setB] = useState("snap-2");
  const snapA = MOCK_SNAPSHOTS.find((s) => s.id === a)!;
  const snapB = MOCK_SNAPSHOTS.find((s) => s.id === b)!;
  const dConfidence = snapA.confidenceAtCapture - snapB.confidenceAtCapture;
  const dAttacks = snapA.attackCount - snapB.attackCount;
  const dUndef = snapA.undefendedAttackCount - snapB.undefendedAttackCount;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5 mb-1">
        <div className="p-1.5 rounded-lg bg-gradient-to-br from-amber-500/12 to-orange-500/12 text-amber-600">
          <Camera className="w-4 h-4" />
        </div>
        <p className="font-semibold text-slate-900 text-lg">Snapshots</p>
        <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gradient-to-r from-amber-500/10 to-orange-500/10 text-amber-700 border border-amber-500/20">
          User-triggered
        </span>
      </div>
      <p className="text-sm text-slate-500">
        Point-in-time freezes for citers. The frozen view renders without <code className="text-xs px-1 py-0.5 rounded bg-slate-100">ThesisLiveProvider</code> — permanent amber &ldquo;frozen, not live&rdquo; banner.
      </p>

      <div className="space-y-2">
        {MOCK_SNAPSHOTS.map((s) => (
          <div key={s.id} className="cardv2 p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/15 text-amber-600 shrink-0">
                <Camera className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{s.label}</p>
                <p className="text-[11px] text-slate-500">
                  {new Date(s.createdAt).toLocaleString()} · confidence{" "}
                  <span className="font-mono text-slate-700">{s.confidenceAtCapture.toFixed(2)}</span> · {s.attackCount} attacks ({s.undefendedAttackCount} undefended)
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button size="sm" variant="outline" onClick={() => toast.info(`/view/snapshot/${s.id} — frozen`)} className="h-7 text-xs">
                <Eye className="w-3 h-3 mr-1" /> View
              </Button>
              <Button size="sm" variant="outline" onClick={() => toast.info(`/view/snapshot/${s.id}/diff?against=live`)} className="h-7 text-xs">
                <GitCompare className="w-3 h-3 mr-1" /> vs live
              </Button>
            </div>
          </div>
        ))}
        <Button
          onClick={() => toast.success("POST /api/thesis/[id]/snapshots — froze /live + /confidence + /attacks?status=all")}
          className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white h-10"
        >
          <Camera className="w-4 h-4 mr-1.5" />
          Capture new snapshot
        </Button>
      </div>

      <div className="cardv2 p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs text-slate-700 flex-wrap">
          <GitCompare className="w-4 h-4 text-amber-500" />
          <span className="font-semibold">Compare:</span>
          <select value={a} onChange={(e) => setA(e.target.value)} className="text-xs border rounded-lg px-2 py-1 bg-white border-slate-200">
            {MOCK_SNAPSHOTS.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
          <ArrowRight className="w-3 h-3 text-slate-400" />
          <select value={b} onChange={(e) => setB(e.target.value)} className="text-xs border rounded-lg px-2 py-1 bg-white border-slate-200">
            {MOCK_SNAPSHOTS.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <DeltaCard label="Confidence" from={snapB.confidenceAtCapture.toFixed(2)} to={snapA.confidenceAtCapture.toFixed(2)} delta={dConfidence} format={(n) => (n > 0 ? `+${n.toFixed(2)}` : n.toFixed(2))} />
          <DeltaCard label="Attacks total" from={String(snapB.attackCount)} to={String(snapA.attackCount)} delta={dAttacks} format={(n) => (n > 0 ? `+${n}` : String(n))} />
          <DeltaCard label="Undefended" from={String(snapB.undefendedAttackCount)} to={String(snapA.undefendedAttackCount)} delta={dUndef} format={(n) => (n > 0 ? `+${n}` : String(n))} invert />
        </div>
      </div>
    </div>
  );
}

function DeltaCard({
  label,
  from,
  to,
  delta,
  format,
  invert,
}: {
  label: string;
  from: string;
  to: string;
  delta: number;
  format: (n: number) => string;
  invert?: boolean;
}) {
  const isPositive = invert ? delta < 0 : delta > 0;
  const isZero = delta === 0;
  const tone = isZero ? "text-slate-500" : isPositive ? "text-emerald-600" : "text-rose-600";
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2.5">
      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{label}</p>
      <div className="flex items-center gap-1.5 mt-1.5 text-xs">
        <span className="text-slate-400 font-mono">{from}</span>
        <ArrowRight className="w-3 h-3 text-slate-400" />
        <span className="font-mono font-bold text-slate-800">{to}</span>
        <span className={`ml-auto text-[11px] font-mono font-semibold ${tone}`}>{format(delta)}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TRAVERSALS DEMO
// ─────────────────────────────────────────────────────────────────────────────

function TraversalsDemo() {
  const [moid, setMoid] = useState("claim-prong-3");
  const [tab, setTab] = useState<"attacks" | "provenance" | "evidence">("attacks");
  const url = `/deliberations/del-1/thesis/${MOCK_THESIS.id}/view?focus=${moid}&tab=${tab}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5 mb-1">
        <div className="p-1.5 rounded-lg bg-gradient-to-br from-emerald-500/12 to-teal-500/12 text-emerald-600">
          <Workflow className="w-4 h-4" />
        </div>
        <p className="font-semibold text-slate-900 text-lg">Traversals & Provenance</p>
        <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gradient-to-r from-emerald-500/10 to-teal-500/10 text-emerald-700 border border-emerald-500/20">
          Hypertext
        </span>
      </div>
      <p className="text-sm text-slate-500">
        A navigable surface, not a linear read. Deep-link into any object, tab-targeted.
      </p>

      <div className="cardv2 p-4 space-y-3">
        <SectionLabel>URL deep-link builder (?focus + ?tab)</SectionLabel>
        <div className="flex items-center gap-2 text-xs flex-wrap">
          <span className="text-slate-500 font-mono">focus =</span>
          <select value={moid} onChange={(e) => setMoid(e.target.value)} className="text-xs border rounded-lg px-2 py-1 bg-white border-slate-200 flex-1 min-w-[180px]">
            {Object.values(MOCK_OBJECTS).map((o) => (
              <option key={o.id} value={o.id}>{o.kind}: {o.id}</option>
            ))}
          </select>
          <span className="text-slate-500 font-mono">tab =</span>
          <select value={tab} onChange={(e) => setTab(e.target.value as any)} className="text-xs border rounded-lg px-2 py-1 bg-white border-slate-200">
            <option value="attacks">attacks</option>
            <option value="provenance">provenance</option>
            <option value="evidence">evidence</option>
          </select>
        </div>
        <div className="rounded-lg bg-slate-950 text-slate-100 p-3 font-mono text-[11px] overflow-x-auto break-all">
          {url}
        </div>
        <p className="text-[11px] text-slate-500 italic leading-relaxed">
          ThesisFocusHandler resolves <code className="text-[10px] px-1 py-0.5 rounded bg-slate-100">?focus=</code> via{" "}
          <code className="text-[10px] px-1 py-0.5 rounded bg-slate-100">/api/thesis/[id]/focus?ref=…</code> (id or Claim moid), scrolls the matching{" "}
          <code className="text-[10px] px-1 py-0.5 rounded bg-slate-100">[data-{`{kind}`}-id]</code> node into view, then dispatches{" "}
          <code className="text-[10px] px-1 py-0.5 rounded bg-slate-100">openInspector({`{kind, id, tab}`})</code>.
        </p>
      </div>

      <div>
        <SectionLabel>Provenance walk — claim ↔ proposition ↔ argument ↔ attack</SectionLabel>
        <div className="cardv2 p-4 mt-2 flex items-center justify-around text-center text-xs gap-2 flex-wrap">
          <WalkNode color="slate" label="Proposition" id="prop-1" />
          <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />
          <WalkNode color="indigo" label="Claim" id="claim-prong-1" />
          <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />
          <WalkNode color="violet" label="Argument" id="arg-1" />
          <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />
          <WalkNode color="rose" label="Attack" id="atk-4" />
        </div>
      </div>

      <div>
        <SectionLabel>&ldquo;Used in&rdquo; backlinks (cross-thesis impact)</SectionLabel>
        <div className="space-y-1.5 mt-2">
          {MOCK_BACKLINKS.map((b) => (
            <div key={b.id} className="cardv2 px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-800 truncate">{b.title}</p>
                <p className="text-[11px] text-slate-500">via <span className="font-mono">{b.via}</span> · {b.authorName}</p>
              </div>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200 shrink-0">
                <CornerDownRight className="w-3 h-3" />
                {b.via}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function WalkNode({
  color,
  label,
  id,
}: {
  color: "slate" | "indigo" | "violet" | "rose";
  label: string;
  id: string;
}) {
  const styles = {
    slate: "bg-slate-100 border-slate-200 text-slate-700",
    indigo: "bg-indigo-50 border-indigo-200 text-indigo-800",
    violet: "bg-violet-50 border-violet-200 text-violet-800",
    rose: "bg-rose-50 border-rose-200 text-rose-800",
  } as const;
  return (
    <div className={`px-3 py-2 rounded-lg border ${styles[color]}`}>
      <p className="text-[10px] uppercase tracking-wider opacity-70">{label}</p>
      <p className="font-mono text-xs font-semibold">{id}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// D4 — CHAIN INTEGRATION DEMO  (Weeks 1–3)
// ─────────────────────────────────────────────────────────────────────────────

const ROLE_TINT: Record<ChainNodeRole, string> = {
  PREMISE: "bg-sky-50 border-sky-200 text-sky-800",
  EVIDENCE: "bg-cyan-50 border-cyan-200 text-cyan-800",
  CONCLUSION: "bg-emerald-50 border-emerald-300 text-emerald-800",
  OBJECTION: "bg-rose-50 border-rose-200 text-rose-800",
  REBUTTAL: "bg-orange-50 border-orange-200 text-orange-800",
  QUALIFIER: "bg-amber-50 border-amber-200 text-amber-800",
  COMMENT: "bg-slate-50 border-slate-200 text-slate-700",
};

const EDGE_TINT: Record<ChainEdgeType, string> = {
  SUPPORTS: "text-emerald-600",
  ENABLES: "text-yellow-600",
  PRESUPPOSES: "text-violet-600",
  REFUTES: "text-rose-600",
  QUALIFIES: "text-amber-600",
  REBUTS: "text-rose-700",
  UNDERCUTS: "text-rose-700",
};

function ChainIntegrationDemo({
  onOpenInspector,
}: {
  onOpenInspector: (id: string) => void;
}) {
  type ChainTab = "embed" | "inspector" | "enablers" | "attacks";
  const [tab, setTab] = useState<ChainTab>("embed");
  const [chainTab, setChainTab] = useState<"overview" | "nodes" | "provenance">(
    "overview"
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [challengeTarget, setChallengeTarget] = useState<MockEnabler | null>(
    null
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5 mb-1">
        <div className="p-1.5 rounded-lg bg-gradient-to-br from-teal-500/12 to-cyan-500/12 text-teal-600">
          <GitBranch className="w-4 h-4" />
        </div>
        <p className="font-semibold text-slate-900 text-lg">
          Chain Integration{" "}
          <span className="text-xs font-mono text-slate-400 align-middle">

          </span>
        </p>
        <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gradient-to-r from-teal-500/10 to-cyan-500/10 text-teal-700 border border-teal-500/20">
          New
        </span>
      </div>
      <p className="text-sm text-slate-500">
        Argument chains are first-class thesis objects: embedded in content,
        opened by the inspector, attacked through the register, and surfaced as
        inference assumptions inside prongs.
      </p>

      <div className="flex items-center gap-1.5 flex-wrap">
        {(
          [
            { id: "embed", label: "Embed in content", icon: Layers },
            { id: "inspector", label: "Inspector", icon: PanelRightOpen },
            { id: "enablers", label: "Assumptions in prong", icon: Lightbulb },
            { id: "attacks", label: "Attack rollup", icon: Swords },
          ] as { id: ChainTab; label: string; icon: LucideIcon }[]
        ).map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`text-[11px] inline-flex items-center gap-1 px-2.5 py-1 rounded-full border font-medium transition ${
                tab === t.id
                  ? "border-teal-400 bg-teal-50 text-teal-700"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              <Icon className="w-3 h-3" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1 — Embed in TipTap content */}
      {tab === "embed" && (
        <div className="cardv2 p-5 space-y-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
            Living thesis · {MOCK_THESIS.author.name}
          </p>
          <p className="text-sm text-slate-700 leading-relaxed">
            The point of this section is to ground the analogy in a worked
            reconstruction. Consider Kant&apos;s Refutation of Idealism, which
            we represent below as an interactive chain rather than a flat
            paragraph.
          </p>

          <div className="rounded-xl border-2 border-teal-200 bg-gradient-to-br from-teal-50/40 to-cyan-50/30 p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-teal-100 text-teal-800 border border-teal-200">
                    <GitBranch className="w-3 h-3" />
                    chain
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
                    {MOCK_CHAIN.role}
                  </span>
                  <code className="text-[10px] text-slate-400">
                    {MOCK_CHAIN.id}
                  </code>
                  <LiveChip
                    obj={{
                      id: MOCK_CHAIN.id,
                      kind: "claim",
                      text: "",
                      label: "IN",
                      attackCount: MOCK_CHAIN.attackCount,
                      undefendedAttackCount: MOCK_CHAIN.undefendedAttackCount,
                      defendedAttackCount:
                        MOCK_CHAIN.attackCount - MOCK_CHAIN.undefendedAttackCount,
                      supportCount: 0,
                      evidenceCount: MOCK_CHAIN.evidenceCount,
                      lastChangedAt: MOCK_CHAIN.lastChangedAt,
                    }}
                  />
                </div>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {MOCK_CHAIN.name}
                </p>
                <p className="text-xs text-slate-600 italic mt-0.5">
                  {MOCK_CHAIN.caption}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setTab("inspector");
                  setChainTab("overview");
                }}
                className="h-7 text-xs shrink-0"
              >
                <Eye className="w-3 h-3 mr-1" />
                Inspect
              </Button>
            </div>

            {/* readonly mini-graph */}
            <div className="rounded-lg border border-slate-200 bg-white/70 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                  Readonly graph · {MOCK_CHAIN.nodeCount} nodes ·{" "}
                  {MOCK_CHAIN.edgeCount} edges
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  ArgumentChainEmbedView
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {MOCK_CHAIN.nodes.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => {
                      setTab("inspector");
                      setChainTab("nodes");
                      setSelectedNodeId(n.id);
                    }}
                    className={`text-left rounded-lg border px-2.5 py-2 text-xs hover:shadow-sm transition ${ROLE_TINT[n.role]}`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-[9px] uppercase tracking-wider font-bold opacity-80">
                        {n.role}
                      </span>
                      <code className="text-[9px] opacity-60">{n.id}</code>
                    </div>
                    <p className="leading-snug">{n.text}</p>
                  </button>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-3 flex-wrap text-[10px]">
                {MOCK_CHAIN.edges.slice(0, 6).map((e) => (
                  <span
                    key={e.id}
                    className={`inline-flex items-center gap-1 font-mono ${EDGE_TINT[e.edgeType]}`}
                  >
                    <code className="text-slate-500">{e.fromId}</code>
                    <ArrowRight className="w-3 h-3" />
                    <code className="text-slate-500">{e.toId}</code>
                    <span className="font-semibold">[{e.edgeType}]</span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          <p className="text-sm text-slate-700 leading-relaxed">
            We will return to this chain when we discuss the disputed
            elimination step.
          </p>

          <div className="rounded-lg bg-slate-950 text-slate-100 p-3 font-mono text-[11px] overflow-x-auto">
            <p className="text-slate-400 mb-1">
              {"// TipTap node attrs (in-content source of truth)"}
            </p>
            <pre className="text-slate-200 leading-relaxed">{`{
  "type": "argumentChainNode",
  "attrs": {
    "chainId":     "${MOCK_CHAIN.id}",
    "chainName":   "${MOCK_CHAIN.name}",
    "caption":     "${MOCK_CHAIN.caption}",
    "role":        "${MOCK_CHAIN.role}",
    "showEnabler": false
  }
}`}</pre>
            <p className="text-slate-400 mt-2 mb-1">
              {"// Materialized on save → ThesisChainReference row (BOTH-mode)"}
            </p>
            <pre className="text-slate-200 leading-relaxed">{`syncThesisChainReferences(thesisId, content)
  → createMany skipDuplicates + update changed + deleteMany removed`}</pre>
          </div>
        </div>
      )}

      {/* TAB 2 — Inspector kind="chain" */}
      {tab === "inspector" && (
        <div className="cardv2 overflow-hidden">
          <div className="border-b border-slate-200/70 px-5 py-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-teal-100 text-teal-700 border border-teal-200">
                  chain
                </span>
                <code className="text-[10px] text-slate-400">
                  {MOCK_CHAIN.id}
                </code>
                <LiveChip
                  obj={{
                    id: MOCK_CHAIN.id,
                    kind: "claim",
                    text: "",
                    label: "IN",
                    attackCount: MOCK_CHAIN.attackCount,
                    undefendedAttackCount: MOCK_CHAIN.undefendedAttackCount,
                    defendedAttackCount:
                      MOCK_CHAIN.attackCount - MOCK_CHAIN.undefendedAttackCount,
                    supportCount: 0,
                    evidenceCount: MOCK_CHAIN.evidenceCount,
                    lastChangedAt: MOCK_CHAIN.lastChangedAt,
                  }}
                />
              </div>
              <p className="text-sm font-semibold text-slate-800 mt-2 leading-snug">
                {MOCK_CHAIN.name}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {MOCK_CHAIN.caption}
              </p>
            </div>
            <button
              onClick={() => setTab("embed")}
              className="p-1 rounded hover:bg-slate-100 text-slate-400 shrink-0"
            >
              ✕
            </button>
          </div>

          <div className="border-b border-slate-200/70 px-2 flex items-center gap-1 overflow-x-auto bg-slate-50/40">
            {(["overview", "nodes", "provenance"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setChainTab(t)}
                className={`px-3 py-2 text-xs font-medium border-b-2 transition capitalize ${
                  chainTab === t
                    ? "border-teal-500 text-teal-700"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="p-5 max-h-[460px] overflow-y-auto bg-white">
            {chainTab === "overview" && (
              <div className="space-y-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                    Description
                  </p>
                  <p className="text-slate-700 mt-0.5 leading-snug">
                    {MOCK_CHAIN.description}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mt-2">
                    Purpose
                  </p>
                  <p className="text-slate-700 mt-0.5 leading-snug">
                    {MOCK_CHAIN.purpose}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <MiniStat
                    icon={Layers}
                    label="Chain type"
                    value={MOCK_CHAIN.chainType}
                  />
                  <MiniStat
                    icon={Network}
                    label="Nodes / edges"
                    value={`${MOCK_CHAIN.nodeCount} / ${MOCK_CHAIN.edgeCount}`}
                  />
                  <MiniStat
                    icon={Swords}
                    label="Attacks"
                    value={`${MOCK_CHAIN.attackCount} total · ${MOCK_CHAIN.undefendedAttackCount} undefended`}
                  />
                  <MiniStat
                    icon={BookOpen}
                    label="Evidence"
                    value={`${MOCK_CHAIN.evidenceCount}`}
                  />
                  <MiniStat
                    icon={Clock}
                    label="Last changed"
                    value={new Date(MOCK_CHAIN.lastChangedAt).toLocaleString()}
                  />
                </div>
                <p className="text-[11px] text-slate-500 italic">
                  Counters are aggregated from member arguments and edges by{" "}
                  <code className="text-[10px] px-1 py-0.5 rounded bg-slate-100">
                    /api/thesis/[id]/live
                  </code>
                  &nbsp;section 7.
                </p>
              </div>
            )}

            {chainTab === "nodes" && (
              <div className="space-y-2">
                {MOCK_CHAIN.nodes.map((n) => (
                  <div
                    key={n.id}
                    className={`rounded-lg border p-3 space-y-1.5 ${ROLE_TINT[n.role]} ${
                      selectedNodeId === n.id ? "ring-2 ring-teal-300" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] uppercase tracking-wider font-bold opacity-80">
                        {n.role}
                      </span>
                      <button
                        onClick={() => onOpenInspector("arg-1")}
                        className="text-[10px] inline-flex items-center gap-1 text-slate-600 hover:text-slate-900"
                      >
                        <ExternalLink className="w-3 h-3" />
                        open argument
                      </button>
                    </div>
                    <p className="text-xs leading-snug">{n.text}</p>
                    {n.schemeName && (
                      <p className="text-[10px] opacity-70">
                        scheme:{" "}
                        <span className="font-semibold">{n.schemeName}</span>
                      </p>
                    )}
                    {n.justification && (
                      <p className="text-[10px] italic text-slate-600">
                        💭 {n.justification}
                      </p>
                    )}
                  </div>
                ))}
                <div className="pt-2 mt-2 border-t border-slate-200/70">
                  <SectionLabel>Edges ({MOCK_CHAIN.edges.length})</SectionLabel>
                  <div className="mt-2 space-y-1">
                    {MOCK_CHAIN.edges.map((e) => (
                      <div
                        key={e.id}
                        className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px]"
                      >
                        <code className="text-slate-500">{e.fromId}</code>
                        <ArrowRight className="w-3 h-3 text-slate-400" />
                        <code className="text-slate-500">{e.toId}</code>
                        <span
                          className={`font-mono font-semibold ${EDGE_TINT[e.edgeType]}`}
                        >
                          {e.edgeType}
                        </span>
                        {e.description && (
                          <span className="text-slate-500 italic truncate">
                            — {e.description}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {chainTab === "provenance" && (
              <div className="space-y-3">
                <SectionLabel>Origin</SectionLabel>
                <div className="rounded-lg border border-slate-200 bg-white p-2.5 text-xs">
                  <p className="text-slate-700">
                    Created in deliberation{" "}
                    <span className="font-mono">del-1</span> by{" "}
                    <span className="font-semibold">{MOCK_THESIS.author.name}</span>
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    chainType: {MOCK_CHAIN.chainType} · created 2026-04-19
                  </p>
                </div>

                <SectionLabel>Embedded in theses (1)</SectionLabel>
                <button
                  onClick={() => toast.info(`→ ${MOCK_THESIS.title}`)}
                  className="w-full text-left rounded-lg border border-slate-200 bg-white p-2.5 hover:border-teal-400 hover:bg-teal-50/40 transition"
                >
                  <p className="text-xs font-semibold text-slate-800 leading-snug">
                    {MOCK_THESIS.title}
                  </p>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-[10px] text-slate-500">
                      via content · MAIN role
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                      <ExternalLink className="w-3 h-3" />
                      open
                    </span>
                  </div>
                </button>
                <p className="text-[11px] text-slate-500 italic">
                  Backlinks resolved through{" "}
                  <code className="text-[10px] px-1 py-0.5 rounded bg-slate-100">
                    inspect → provenance.theses
                  </code>{" "}
                  (the dedicated <code>kind=&quot;chain&quot;</code> backlinks
                  endpoint is deferred to D4 Week 4).
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3 — EnablerPanel inside ProngEditor */}
      {tab === "enablers" && (
        <div className="space-y-3">
          <div className="cardv2 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="w-4 h-4 text-yellow-500" />
              <p className="font-semibold text-slate-900 text-sm">
                Inference Assumptions (Enablers)
              </p>
              <span className="ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-yellow-100 text-yellow-700 border border-yellow-200">
                {MOCK_PRONG_ENABLERS.length} assumption
                {MOCK_PRONG_ENABLERS.length !== 1 ? "s" : ""}
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Surfaced from <code>argumentSchemes → scheme.premises</code> for
              every argument in this prong. Reuses <code>EnablerPanel</code> by
              reshaping <code>prong.arguments</code> into ReactFlow node format
              — the panel itself is unchanged.
            </p>
            <div className="space-y-2">
              {MOCK_PRONG_ENABLERS.map((e) => (
                <div
                  key={e.argumentId}
                  className="rounded-lg border border-yellow-200 bg-yellow-50/50 p-3 space-y-2"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] px-1.5 py-0.5 rounded border border-sky-200 bg-sky-50 text-sky-800 font-semibold">
                      {e.role}
                    </span>
                    <span className="text-[11px] font-semibold text-yellow-800">
                      {e.schemeName}
                    </span>
                    <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-slate-500">
                      <HelpCircle className="w-3 h-3" />
                      {e.premiseCount} premises
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-700 leading-snug">
                    <span className="font-semibold text-yellow-800">
                      Argument:
                    </span>{" "}
                    {e.argumentText}
                  </p>
                  <div className="text-xs text-gray-700">
                    <span className="font-semibold text-yellow-800">
                      This reasoning assumes:
                    </span>
                    <p className="italic mt-0.5">{e.enablerText}</p>
                  </div>
                  {e.justification && (
                    <div className="rounded-md bg-yellow-100/40 px-2 py-1.5 border border-yellow-200">
                      <p className="text-[10px] font-semibold text-yellow-800">
                        💭 Why this reconstruction:
                      </p>
                      <p className="text-[11px] italic text-yellow-700">
                        {e.justification}
                      </p>
                    </div>
                  )}
                  <div className="flex justify-end pt-1 border-t border-yellow-200">
                    <Button

                      onClick={() => setChallengeTarget(e)}
                      className="rounded-xl text-xs btnv2--ghost bg-white hover:bg-rose-50 border-rose-300 text-rose-700"
                    >
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Challenge this assumption
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {challengeTarget && (
            <div className="cardv2 p-4 border-2 border-rose-200">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Challenge inference assumption
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Opens <code>CriticalQuestionsV3</code> against{" "}
                    <code>argumentId = {challengeTarget.argumentId}</code>
                  </p>
                </div>
                <button
                  onClick={() => setChallengeTarget(null)}
                  className="p-1 rounded hover:bg-slate-100 text-slate-400 shrink-0"
                >
                  ✕
                </button>
              </div>
              <div className="rounded-md border border-yellow-200 bg-yellow-50 p-2.5 text-[11px]">
                <p className="font-semibold text-yellow-800">
                  Scheme: {challengeTarget.schemeName}
                </p>
                <p className="italic text-yellow-900 mt-0.5">
                  {challengeTarget.enablerText}
                </p>
              </div>
              <div className="mt-3 space-y-1.5">
                {[
                  "Is the source actually an expert in the field?",
                  "Is the assertion within the expert's domain?",
                  "Does it conflict with other expert opinion?",
                ].map((q, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 rounded-md border border-slate-200 bg-white p-2 text-[11px]"
                  >
                    <Circle className="w-3 h-3 text-slate-400 mt-0.5 shrink-0" />
                    <span className="text-slate-700">{q}</span>
                  </div>
                ))}
                <p className="text-[10px] italic text-slate-500 pt-1">
                  Real surface mounts <code>CriticalQuestionsV3</code> in a
                  Dialog — CQ status updates flow back into the live poll and
                  the ConfidenceBadge.
                </p>
              </div>
            </div>
          )}

          <div className="rounded-lg bg-slate-950 text-slate-100 p-3 font-mono text-[11px] overflow-x-auto">
            <p className="text-slate-400 mb-1">
              {"// ProngEditor Assumptions tab"}
            </p>
            <pre className="text-slate-200 leading-relaxed">{`<Tabs defaultValue="arguments">
  <TabsList>
    <TabsTrigger value="arguments">Arguments (N)</TabsTrigger>
    <TabsTrigger value="enablers">Assumptions (${MOCK_PRONG_ENABLERS.length})</TabsTrigger>
  </TabsList>
  <TabsContent value="enablers">
    <EnablerPanel nodes={enablerNodes}
      onChallengeEnabler={(argId, scheme, text) => …} />
  </TabsContent>
</Tabs>`}</pre>
          </div>
        </div>
      )}

      {/* TAB 4 — Attack rollup ("in chain: X" pill) */}
      {tab === "attacks" && (
        <div className="space-y-3">
          <p className="text-sm text-slate-500">
            Attacks against any member argument of an embedded chain show an{" "}
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-100 text-indigo-700 border border-indigo-200 align-middle">
              <GitBranch className="w-3 h-3 mr-0.5" />
              in chain
            </span>{" "}
            pill in the Attack Register and roll up to the chain&apos;s entry on
            the next live poll.
          </p>
          <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-4 space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <Swords className="w-4 h-4 text-rose-600" />
              <span className="text-xs uppercase font-bold tracking-wider text-slate-700">
                Undefended (1)
              </span>
            </div>
            <button
              onClick={() => onOpenInspector("arg-3")}
              className="w-full text-left rounded-lg border border-white bg-white p-3 hover:shadow-md hover:border-slate-200 transition"
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide bg-slate-100 text-slate-700 border border-slate-200">
                    UNDERCUTS
                  </span>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-100 text-indigo-700 border border-indigo-200">
                    <GitBranch className="w-3 h-3" />
                    in chain: {MOCK_CHAIN.name.split(" — ")[0]}
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 font-mono">
                  2026-04-22
                </span>
              </div>
              <p className="text-xs text-slate-800 line-clamp-1 font-semibold">
                → All time-determination presupposes something permanent in
                perception.
              </p>
              <p className="text-[11px] text-slate-600 italic mt-1 line-clamp-2 leading-snug">
                &ldquo;The elimination step (cn-3) is not exhaustive — a divine
                idea could supply the permanent without being an outer
                object.&rdquo;
              </p>
              <p className="text-[10px] text-slate-500 mt-1.5">
                Prof. James Williams · @jwilliams
              </p>
            </button>
          </div>
          <div className="rounded-lg bg-slate-950 text-slate-100 p-3 font-mono text-[11px] overflow-x-auto">
            <p className="text-slate-400 mb-1">
              {"// /api/thesis/[id]/attacks payload (excerpt)"}
            </p>
            <pre className="text-slate-200 leading-relaxed">{`{
  "attackId": "atk-cn2-1",
  "attackType": "UNDERCUTS",
  "status": "undefended",
  "target": {
    "kind": "argument",
    "id":   "arg-cn-2",
    "chains": [
      { "chainId": "${MOCK_CHAIN.id}",
        "chainName": "${MOCK_CHAIN.name.split(" — ")[0]}",
        "role": "MAIN" }
    ]
  }
}`}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function LivingThesisFeaturesPage() {
  const [selectedId, setSelectedId] = useState("claim-thesis");

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <Toaster position="bottom-right" richColors closeButton />

        <div className="max-w-6xl mx-auto px-6 py-10 space-y-10">
          {/* Header */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-indigo-500/10 to-violet-500/10 text-indigo-700 border border-indigo-500/20 text-xs font-semibold">
                <Activity className="w-3.5 h-3.5" />
                Living Thesis System
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 border border-emerald-200/80 text-emerald-700">
                Phases 1–7 shipped
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 border border-indigo-200/80 text-indigo-700">
                Living Thesis V1
              </span>
            </div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
              Living Thesis — Hypertextual Argument Surface
            </h1>
            <p className="text-base text-slate-600 max-w-3xl leading-relaxed">
              A continuously-updating window onto the underlying deliberation graph. Every claim, argument, attack, and aggregate metric is live, inspectable, and challengeable — the static publication becomes a structured argumentation surface that anyone can walk, audit, and contest.
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { label: "Single batched /live endpoint", color: "bg-indigo-100 text-indigo-700" },
                { label: "Right-side inspection drawer", color: "bg-violet-100 text-violet-700" },
                { label: "Attack register with status", color: "bg-rose-100 text-rose-700" },
                { label: "Auditable confidence formula", color: "bg-fuchsia-100 text-fuchsia-700" },
                { label: "User-triggered snapshots + diff", color: "bg-amber-100 text-amber-700" },
                { label: "Focus deep-links + backlinks", color: "bg-emerald-100 text-emerald-700" },
                { label: "Permission-gated reader endpoints", color: "bg-slate-100 text-slate-700" },
                { label: "Chain embeds in thesis content", color: "bg-teal-100 text-teal-700" },
                { label: "Inference assumptions surfaced in prongs", color: "bg-yellow-100 text-yellow-700" },
              ].map((chip) => (
                <span key={chip.label} className={`text-xs font-medium px-2.5 py-1 rounded-full ${chip.color}`}>
                  {chip.label}
                </span>
              ))}
            </div>
          </div>

          {/* Vision callout */}
          <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-5">
            <div className="flex items-start gap-3">
              <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-600 shrink-0">
                <Circle className="w-4 h-4" />
              </div>
              <div>
                <p className="font-semibold text-indigo-800 text-sm">Vision</p>
                <p className="text-sm text-indigo-700 mt-1 leading-relaxed">
                  A thesis is a hypertextual document where every claim, argument, and attack referenced in the brief is a live interactive element. Hover over C-101 and you see the claim's full metadata — who authored it, when it was promoted from proposition to claim, what evidence is attached, what its current status is in the grounded extension. Click on A-203 and you can inspect the argument, see its scheme, read its critical questions, view the attacks filed against it, file a new attack yourself. The markdown export is a flattened snapshot of this; the live page is the actual deliverable.
                </p>
              </div>
            </div>
          </div>

          {/* Phase progression */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm font-semibold text-slate-700 mb-4">Phase progression — six layers, each enabling the next</p>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
              {PHASE_BANDS.map((p) => {
                const Icon = p.icon;
                return (
                  <div
                    key={p.id}
                    className={`rounded-lg p-3 border transition-all ${
                      p.active
                        ? "border-amber-300 bg-amber-50 ring-2 ring-amber-200"
                        : p.done
                          ? "border-slate-200 bg-slate-50"
                          : "border-slate-100 bg-white opacity-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1 mb-1.5">
                      <span className={`w-5 h-5 rounded-lg flex items-center justify-center font-bold text-[10px] shrink-0 ${
                        p.active ? "bg-amber-500 text-white" : p.done ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-400"
                      }`}>
                        {p.done ? <Check className="w-3 h-3" /> : "•"}
                      </span>
                      <div className={`p-1 rounded-md bg-gradient-to-br ${p.color} ${p.iconColor}`}>
                        <Icon className="w-3 h-3" />
                      </div>
                    </div>
                    <p className={`text-[10px] font-bold uppercase tracking-wider ${p.active ? "text-amber-700" : p.done ? "text-slate-500" : "text-slate-400"}`}>
                      {p.label}
                    </p>
                    <p className={`text-[11px] font-semibold leading-tight mt-0.5 ${p.active ? "text-amber-900" : p.done ? "text-slate-700" : "text-slate-400"}`}>
                      {p.title}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Deliverables grid */}
          <section>
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-slate-800">Shipped Deliverables</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                14 features across six phases — endpoints, hooks, drawer, register, audit, snapshots, traversal infrastructure — plus D4 chain-integration weeks 1–3 in the Chains demo tab.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {PHASE_FEATURES.map((feature) => (
                <FeatureCard key={feature.id} feature={feature} />
              ))}
            </div>
          </section>

          {/* Interactive demos */}
          <section>
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-slate-800">Interactive Demos</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Walk the live binding, open the inspector on any object, browse the attack register, audit the confidence formula, capture & diff snapshots, and build deep-link URLs.
              </p>
            </div>
            <Tabs defaultValue="live" className="space-y-4">
              <TabsList>
                <TabsTrigger value="live" className="gap-1.5">
                  <Radio className="w-4 h-4" />
                  Live
                </TabsTrigger>
                <TabsTrigger value="inspector" className="gap-1.5">
                  <PanelRightOpen className="w-4 h-4" />
                  Inspector
                </TabsTrigger>
                <TabsTrigger value="attacks" className="gap-1.5">
                  <Swords className="w-4 h-4" />
                  Attacks
                </TabsTrigger>
                <TabsTrigger value="confidence" className="gap-1.5">
                  <Gauge className="w-4 h-4" />
                  Confidence
                </TabsTrigger>
                <TabsTrigger value="snapshots" className="gap-1.5">
                  <Camera className="w-4 h-4" />
                  Snapshots
                </TabsTrigger>
                <TabsTrigger value="traversals" className="gap-1.5">
                  <Workflow className="w-4 h-4" />
                  Traversals
                </TabsTrigger>
                <TabsTrigger value="chains" className="gap-1.5">
                  <GitBranch className="w-4 h-4" />
                  Chains
 
                </TabsTrigger>
              </TabsList>

              <TabsContent value="live">
                <LiveBindingDemo onOpenInspector={setSelectedId} />
              </TabsContent>
              <TabsContent value="inspector">
                <InspectorDemo selectedId={selectedId} setSelectedId={setSelectedId} />
              </TabsContent>
              <TabsContent value="attacks">
                <AttackRegisterDemo onOpenInspector={setSelectedId} />
              </TabsContent>
              <TabsContent value="confidence">
                <ConfidenceAuditDemo />
              </TabsContent>
              <TabsContent value="snapshots">
                <SnapshotsDemo />
              </TabsContent>
              <TabsContent value="traversals">
                <TraversalsDemo />
              </TabsContent>
              <TabsContent value="chains">
                <ChainIntegrationDemo onOpenInspector={setSelectedId} />
              </TabsContent>
            </Tabs>
          </section>

          {/* Architecture */}
          <section>
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-slate-800">How It&apos;s Built</h2>
              <p className="text-sm text-slate-500 mt-0.5">Four layers working together to keep the thesis page in sync with its underlying graph.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="sidebarv2">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-5 h-5 rounded-full bg-indigo-500/15 text-indigo-600 text-[11px] font-bold flex items-center justify-center">1</span>
                  <Radio className="w-3.5 h-3.5 text-indigo-600" />
                  <p className="text-sm font-semibold text-slate-800">Live Endpoint</p>
                </div>
                <div className="space-y-1.5 mb-3">
                  <div className="rounded-lg bg-white/60 border border-slate-900/10 p-2 font-mono text-xs text-indigo-700">/api/thesis/[id]/live</div>
                  <div className="rounded-lg bg-white/60 border border-slate-900/10 p-2 font-mono text-xs text-violet-700">/api/thesis/[id]/inspect</div>
                  <div className="rounded-lg bg-white/60 border border-slate-900/10 p-2 font-mono text-xs text-fuchsia-700">/api/thesis/[id]/confidence</div>
                </div>
                <p className="text-xs text-slate-500">
                  Single batched payload per page. Walks thesis content JSON, joins ClaimLabel + ArgumentEdge + CQStatus + EvidenceLink. <code className="bg-white/50 px-1 rounded">no-store</code>.
                </p>
              </div>

              <div className="sidebarv2">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-5 h-5 rounded-full bg-violet-500/15 text-violet-600 text-[11px] font-bold flex items-center justify-center">2</span>
                  <PlugZap className="w-3.5 h-3.5 text-violet-600" />
                  <p className="text-sm font-semibold text-slate-800">Live Context</p>
                </div>
                <div className="space-y-1.5 mb-3">
                  <div className="rounded-lg bg-white/60 border border-slate-900/10 p-2 font-mono text-xs text-violet-700">ThesisLiveContext</div>
                  <div className="rounded-lg bg-white/60 border border-slate-900/10 p-2 font-mono text-xs text-purple-700">useThesisLive</div>
                  <div className="rounded-lg bg-white/60 border border-slate-900/10 p-2 font-mono text-xs text-fuchsia-700">useOpenInspector</div>
                </div>
                <p className="text-xs text-slate-500">
                  One SWR subscription per page (30s active / 120s hidden). Pub/sub channel for inspector requests. Safe no-op outside provider.
                </p>
              </div>

              <div className="sidebarv2">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-5 h-5 rounded-full bg-rose-500/15 text-rose-600 text-[11px] font-bold flex items-center justify-center">3</span>
                  <Network className="w-3.5 h-3.5 text-rose-600" />
                  <p className="text-sm font-semibold text-slate-800">Live Nodes & Drawer</p>
                </div>
                <div className="space-y-1.5 mb-3">
                  <div className="rounded-lg bg-white/60 border border-slate-900/10 p-2 font-mono text-xs text-rose-700">claim-node.tsx</div>
                  <div className="rounded-lg bg-white/60 border border-slate-900/10 p-2 font-mono text-xs text-orange-700">argument-node.tsx</div>
                  <div className="rounded-lg bg-white/60 border border-slate-900/10 p-2 font-mono text-xs text-amber-700">ThesisInspectorDrawer</div>
                </div>
                <p className="text-xs text-slate-500">
                  TipTap node views read live stats from context with <code className="bg-white/50 px-1 rounded">attrs</code> fallback. Inspector mounted once at view-page level.
                </p>
              </div>

              <div className="sidebarv2">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-600 text-[11px] font-bold flex items-center justify-center">4</span>
                  <Camera className="w-3.5 h-3.5 text-emerald-600" />
                  <p className="text-sm font-semibold text-slate-800">Snapshots & Focus</p>
                </div>
                <div className="space-y-1.5 mb-3">
                  <div className="rounded-lg bg-white/60 border border-slate-900/10 p-2 font-mono text-xs text-emerald-700">ThesisSnapshot</div>
                  <div className="rounded-lg bg-white/60 border border-slate-900/10 p-2 font-mono text-xs text-teal-700">ThesisFocusHandler</div>
                  <div className="rounded-lg bg-white/60 border border-slate-900/10 p-2 font-mono text-xs text-cyan-700">backlinks endpoint</div>
                </div>
                <p className="text-xs text-slate-500">
                  Snapshots freeze /live + /confidence + /attacks payloads in one row. <code className="bg-white/50 px-1 rounded">?focus=</code> resolver and cross-thesis backlinks complete the hypertext surface.
                </p>
              </div>
            </div>
          </section>

          {/* Files shipped */}
          <section>
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-slate-800">Files Shipped</h2>
              <p className="text-sm text-slate-500 mt-0.5">9 endpoints + 13 client modules across phases 1–7 and D4 chain integration (weeks 1–3).</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden divide-y">
              {FILES.map((file, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase shrink-0 w-20 text-center ${
                    file.type === "endpoint" ? "bg-indigo-100 text-indigo-700" : "bg-violet-100 text-violet-700"
                  }`}>{file.type}</span>
                  <code className="font-mono text-xs text-slate-700 flex-1 truncate">{file.path}</code>
                  <span className="text-xs text-slate-400 hidden md:block truncate max-w-[40%] text-right">{file.desc}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Deferred */}
          <section>
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-slate-800">Deferred Items</h2>
              <p className="text-sm text-slate-500 mt-0.5">Tracked in <code className="text-xs px-1 py-0.5 rounded bg-slate-100">docs/LIVING_THESIS_DEFERRED.md</code>.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { id: "D1", icon: Camera, title: "Auto-snapshot background workers", desc: "Currently user-triggered only (publish, version bump, attack threshold workers deferred)." },
                { id: "D2", icon: Link2, title: "Canonical user-facing deep-link URLs + embeddable widget", desc: "Internal moid/urn ids only today; public canonical URLs designed but not shipped." },
                { id: "D3", icon: Radio, title: "SSE / WebSocket transport upgrade", desc: "Today: SWR polling. Phase 7.1 instrumentation now emits the signals (latencyMs, payloadBytes, staleMs) that gate the upgrade." },
                { id: "D4", icon: Layers, title: "Chain embedding + enabler panel — Weeks 1–3 shipped (Apr 2026)", desc: "Chains now embed in thesis content, open in the inspector with overview/nodes/provenance tabs, attack-rollup pills appear in the register, and EnablerPanel surfaces inference assumptions inside prongs. Week 4 (chain↔prong conversion + dedicated chain-backlinks endpoint + reconstruction versioning) still pending." },
                { id: "D5", icon: Hash, title: "Hash-anchor scrolling for embedded objects", desc: "?focus opens the inspector today; true #obj-claim-... browser-native anchors land with D2 canonical URLs." },
                { id: "D6", icon: Fingerprint, title: "MOID expansion to non-Claim objects", desc: "Claim.moid is the stable handle today. Argument / Proposition / Citation get moid in lockstep with D2." },
                { id: "D7", icon: LineChart, title: "Structured metric emission (replace console.info)", desc: "thesis.reader.poll log lines ship now; promotion to a real metrics sink (StatsD / Prometheus / dashboard) gates on D3 decision." },
              ].map((d) => {
                const Icon = d.icon;
                return (
                  <div key={d.id} className="cardv2 p-4 flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/15 text-amber-600 shrink-0">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-amber-700 font-mono px-1.5 py-0.5 rounded bg-amber-100 border border-amber-200">{d.id}</span>
                        <p className="font-semibold text-slate-900 text-sm leading-tight">{d.title}</p>
                      </div>
                      <p className="text-xs text-slate-600 mt-1 leading-snug">{d.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Phase 7 checklist */}
          <section>
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-slate-800">Phase 7 — Hardening & Doc</h2>
              <p className="text-sm text-slate-500 mt-0.5">All four sub-tasks shipped. Living Thesis V1 is complete.</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden divide-y">
              {[
                "7.1 Polling instrumentation — lib/thesis/observability.ts emits thesis.reader.poll on every reader request (latencyMs, payloadBytes, objectCount, staleMs, cursor)",
                "7.2 Permissions audit — lib/thesis/permissions.ts gates every reader endpoint on author / PUBLISHED / deliberation participant; backlinks redacts hidden drafts",
                "7.3 Vision-doc Appendix A — every claim in LIVING_THESIS_FEATURE_DESCRIPTION.md mapped to its shipped phase or deferred ID",
                "7.4 Deferred ledger refresh — LIVING_THESIS_DEFERRED.md now tracks D1–D7 (added D5 hash anchors, D6 MOID expansion, D7 metric emission)",
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3">
                  <div className="w-4 h-4 rounded-full bg-emerald-500 shrink-0 flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" strokeWidth={3} />
                  </div>
                  <span className="text-sm text-slate-700">{item}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Footer */}
          <footer className="py-6 border-t border-slate-900/[0.06] flex items-center justify-between text-xs text-slate-400 flex-wrap gap-3">
            <span className="font-medium text-slate-500">Living Thesis V1 · Phases 1–7 shipped · D1–D7 deferred</span>
            <div className="flex items-center gap-3 flex-wrap">
              <a href="/test/article-features" className="text-indigo-500 hover:underline">← Article features</a>
              <span className="text-slate-300">·</span>
              <a href="/test/embeddable-widget-phase3" className="text-indigo-500 hover:underline">Embeddable widget →</a>
              <span className="text-slate-300">·</span>
              <span className="font-mono">docs/LIVING_THESIS_ROADMAP.md</span>
              <span className="text-slate-300">·</span>
              <span>April 2026</span>
            </div>
          </footer>
        </div>
      </div>
    </TooltipProvider>
  );
}
