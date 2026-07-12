"use client";

/**
 * Deliberation Engine Features Demo Page
 *
 * Interactive demonstration of the core deliberation engine (DeepDivePanelV2):
 *
 * PHASE 1 — CORE DELIBERATION:
 * - 1.1 Debate Tab (DeliberationComposer, CardListVirtuoso, feeds, settings panel)
 * - 1.2 Arguments Tab (AIFArgumentsListPro, SchemeBreakdown, ASPIC Theory, PropositionsList)
 * - 1.3 Chains Tab (argument chains explorer)
 * - 1.4 Header Controls (StatusChip, Confidence Mode, DS Mode, Settings toggle)
 * - 1.5 Explorer Panels (Graph Explorer tabs: Arguments/Claims/Commitments/Analytics)
 * - 1.6 Actions Sheet (Dialogical Actions, AIF Diagram Viewer, CommandCard)
 * - 1.7 Dictionary Sheet (DefinitionSheet glossary)
 *
 * PHASE 2 — ADVANCED TABS (future):
 * - 2.1 Ludics Tab (Ludics compilation, arena game, behaviour inspector)
 * - 2.2 Admin Tab (Works list, IssuesDrawer, content-status)
 * - 2.3 Sources Tab (EvidenceList, DeliberationEvidencePanel)
 *
 * PHASE 3 — INTELLIGENCE & CROSS-DELIBERATION (future):
 * - 3.1 Thesis Tab (ThesisComposer, ThesisRenderer, ThesisListView)
 * - 3.2 Analytics Tab (DiscourseDashboard, topology, approvals heatstrip)
 * - 3.3 Cross-Deliberation Tab (CrossRoomSearchPanel, ArgumentImportModal)
 *
 * Accessible at: /test/deliberation-features
 */

import { useState } from "react";
import { toast, Toaster } from "sonner";
import {
  MessageSquare,
  Gavel,
  Link2,
  Layers,
  Brain,
  Settings,
  Shield,
  BarChart3,
  BookOpen,
  Network,
  GitBranch,
  ChevronRight,
  Check,
  Eye,
  FileText,
  Users,
  Sparkles,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  ListTree,
  PlusCircle,
  Search,
  Scale,
  Target,
  Zap,
  Hash,
  Activity,
  Flag,
  CircleDot,
  Pen,
  Quote,
  Swords,
  ShieldCheck,
  Gauge,
  SlidersHorizontal,
  LayoutDashboard,
  Map,
  Lightbulb,
  AlertTriangle,
  ThumbsUp,
  ThumbsDown,
  HelpCircle,
  ClipboardCheck,
  Workflow,
  Component,
  TreePine,
  Gamepad2,
  Star,
  Database,
  Bug,
  FileCheck,
  Archive,
  Microscope,
  Filter,
  LayoutGrid,
  List,
  PlayCircle,
  StopCircle,
  RotateCcw,
  Merge,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_DELIBERATION = {
  id: "delib-demo-1",
  title: "Should carbon pricing be the primary tool for climate mitigation?",
  status: "open" as const,
  hostName: "Climate Policy Forum",
  createdAt: "2026-01-15T10:00:00Z",
  participantCount: 24,
  claimCount: 47,
  argumentCount: 32,
  chainCount: 6,
};

const MOCK_CLAIMS: MockClaim[] = [
  {
    id: "claim-1",
    text: "Carbon pricing is the most cost-effective mechanism for reducing greenhouse gas emissions",
    label: "IN",
    confidence: 0.72,
    supportCount: 5,
    attackCount: 2,
    author: "Dr. Jane Smith",
    createdAt: "2026-01-16T10:00:00Z",
  },
  {
    id: "claim-2",
    text: "Carbon taxes disproportionately burden low-income households",
    label: "IN",
    confidence: 0.65,
    supportCount: 3,
    attackCount: 3,
    author: "Alex Chen",
    createdAt: "2026-01-16T11:30:00Z",
  },
  {
    id: "claim-3",
    text: "Revenue recycling can offset regressive impacts of carbon pricing",
    label: "UNDEC",
    confidence: 0.48,
    supportCount: 2,
    attackCount: 1,
    author: "Maria Garcia",
    createdAt: "2026-01-16T14:00:00Z",
  },
  {
    id: "claim-4",
    text: "Cap-and-trade systems have demonstrated success in reducing SO2 emissions",
    label: "IN",
    confidence: 0.88,
    supportCount: 4,
    attackCount: 0,
    author: "Thomas Lee",
    createdAt: "2026-01-17T09:00:00Z",
  },
  {
    id: "claim-5",
    text: "Carbon leakage makes unilateral pricing ineffective without border adjustments",
    label: "OUT",
    confidence: 0.35,
    supportCount: 1,
    attackCount: 4,
    author: "Dr. Jane Smith",
    createdAt: "2026-01-17T15:00:00Z",
  },
];

interface MockClaim {
  id: string;
  text: string;
  label: "IN" | "OUT" | "UNDEC";
  confidence: number;
  supportCount: number;
  attackCount: number;
  author: string;
  createdAt: string;
}

const MOCK_ARGUMENTS: MockArgument[] = [
  {
    id: "arg-1",
    conclusionText: "Carbon pricing is the most cost-effective mechanism for reducing greenhouse gas emissions",
    conclusionClaimId: "claim-1",
    schemeKey: "argument_from_consequences",
    schemeName: "Argument from Consequences",
    premises: [
      { id: "p1-1", text: "Economic analyses consistently show carbon pricing achieves emission targets at lower cost than regulations", isImplicit: false },
      { id: "p1-2", text: "Cost-effectiveness is the primary criterion for policy selection", isImplicit: true },
    ],
    attackCount: 2,
    supportCount: 1,
    dsInterval: { belief: 0.72, plausibility: 0.85 },
    status: "grounded",
  },
  {
    id: "arg-2",
    conclusionText: "Carbon taxes disproportionately burden low-income households",
    conclusionClaimId: "claim-2",
    schemeKey: "argument_from_analogy",
    schemeName: "Argument from Analogy",
    premises: [
      { id: "p2-1", text: "Consumption taxes are known to be regressive", isImplicit: false },
      { id: "p2-2", text: "Carbon taxes function similarly to consumption taxes on energy", isImplicit: false },
    ],
    attackCount: 1,
    supportCount: 2,
    dsInterval: { belief: 0.65, plausibility: 0.78 },
    status: "grounded",
  },
  {
    id: "arg-3",
    conclusionText: "Revenue recycling can offset regressive impacts of carbon pricing",
    conclusionClaimId: "claim-3",
    schemeKey: "argument_from_expert_opinion",
    schemeName: "Argument from Expert Opinion",
    premises: [
      { id: "p3-1", text: "Leading economists recommend dividend redistribution as an effective offset", isImplicit: false },
      { id: "p3-2", text: "The Canadian carbon dividend program demonstrates this in practice", isImplicit: false },
      { id: "p3-3", text: "Expert consensus supports the effectiveness of revenue recycling", isImplicit: true },
    ],
    attackCount: 0,
    supportCount: 3,
    dsInterval: { belief: 0.48, plausibility: 0.72 },
    status: "undecided",
  },
];

interface MockArgument {
  id: string;
  conclusionText: string;
  conclusionClaimId: string;
  schemeKey: string;
  schemeName: string;
  premises: { id: string; text: string; isImplicit: boolean }[];
  attackCount: number;
  supportCount: number;
  dsInterval: { belief: number; plausibility: number };
  status: "grounded" | "defeated" | "undecided";
}

const MOCK_CHAINS: MockChain[] = [
  {
    id: "chain-1",
    title: "Carbon Pricing Effectiveness Chain",
    depth: 4,
    argumentIds: ["arg-1", "arg-3"],
    rootClaim: "Carbon pricing is the most cost-effective mechanism",
    leafClaims: ["EU ETS reduced emissions by 35%", "Revenue recycling offsets inequality"],
    status: "complete",
  },
  {
    id: "chain-2",
    title: "Equity Concerns Chain",
    depth: 3,
    argumentIds: ["arg-2"],
    rootClaim: "Carbon taxes burden low-income households",
    leafClaims: ["Energy expenditure share is higher for poor households"],
    status: "incomplete",
  },
  {
    id: "chain-3",
    title: "International Coordination Chain",
    depth: 5,
    argumentIds: ["arg-1", "arg-2", "arg-3"],
    rootClaim: "Unilateral carbon pricing causes carbon leakage",
    leafClaims: ["CBAM provides border adjustment", "WTO compatibility remains uncertain"],
    status: "complete",
  },
];

interface MockChain {
  id: string;
  title: string;
  depth: number;
  argumentIds: string[];
  rootClaim: string;
  leafClaims: string[];
  status: "complete" | "incomplete";
}

const MOCK_COMMITMENTS: MockCommitment[] = [
  { participantId: "user-1", name: "Dr. Jane Smith", asserted: 3, conceded: 1, retracted: 0, active: 4 },
  { participantId: "user-2", name: "Alex Chen", asserted: 2, conceded: 2, retracted: 1, active: 3 },
  { participantId: "user-3", name: "Maria Garcia", asserted: 4, conceded: 0, retracted: 0, active: 4 },
  { participantId: "user-4", name: "Thomas Lee", asserted: 1, conceded: 3, retracted: 0, active: 4 },
];

interface MockCommitment {
  participantId: string;
  name: string;
  asserted: number;
  conceded: number;
  retracted: number;
  active: number;
}

const MOCK_LEGAL_MOVES: MockLegalMove[] = [
  { id: "move-assert", kind: "ASSERT", label: "Assert Claim", description: "Add a new claim to the deliberation" },
  { id: "move-challenge", kind: "CHALLENGE", label: "Challenge", description: "Challenge the selected claim" },
  { id: "move-concede", kind: "CONCEDE", label: "Concede", description: "Accept the selected claim" },
  { id: "move-retract", kind: "RETRACT", label: "Retract", description: "Withdraw a previously asserted claim" },
  { id: "move-question", kind: "QUESTION", label: "Question", description: "Raise a critical question about the argument" },
  { id: "move-argue", kind: "ARGUE", label: "Argue", description: "Provide an argument for or against" },
];

interface MockLegalMove {
  id: string;
  kind: string;
  label: string;
  description: string;
}

const MOCK_GLOSSARY: MockTerm[] = [
  { id: "term-1", term: "Carbon Pricing", definition: "A cost applied to carbon pollution to encourage polluters to reduce the amount of greenhouse gases they emit into the atmosphere.", source: "OECD" },
  { id: "term-2", term: "Cap-and-Trade", definition: "A system that sets a cap on overall emissions and allows companies to trade emission allowances.", source: "EPA" },
  { id: "term-3", term: "Carbon Leakage", definition: "The situation when businesses transfer production to countries with less stringent emission constraints.", source: "EU Commission" },
  { id: "term-4", term: "Revenue Recycling", definition: "The practice of returning carbon tax revenues to the economy, often through dividends or tax cuts.", source: "IMF" },
  { id: "term-5", term: "Border Carbon Adjustment", definition: "A tariff on imported goods based on the carbon emitted during their production.", source: "WTO" },
];

interface MockTerm {
  id: string;
  term: string;
  definition: string;
  source: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

interface PhaseFeature {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  status: "complete" | "partial" | "planned";
  items: string[];
}

interface Phase {
  id: string;
  title: string;
  description: string;
  features: PhaseFeature[];
}

const PHASES: Phase[] = [
  {
    id: "core",
    title: "Core Deliberation",
    description: "Debate, Arguments & Chains — the central tabs of the deliberation engine",
    features: [
      {
        id: "debate-tab",
        title: "Debate Tab",
        description: "Live deliberation feed with claim composer, card list, and settings panel",
        icon: MessageSquare,
        status: "complete" as const,
        items: [
          "DeliberationComposer (rich claim authoring with reply-to)",
          "CardListVirtuoso (virtualized feed of claims/cards)",
          "DeliberationSettingsPanel (configuration sidebar)",
          "StatusChip (open/closed/paused status display)",
          "Real-time updates via Supabase broadcast",
        ],
      },
      {
        id: "arguments-tab",
        title: "Arguments Tab",
        description: "Structured argument browser with AIF, ASPIC+, scheme breakdown and propositions",
        icon: Scale,
        status: "complete" as const,
        items: [
          "AIFArgumentsListPro (paginated AIF argument list)",
          "SchemeBreakdown (argument scheme visualization)",
          "AspicTheoryPanel (ASPIC+ defeasible reasoning)",
          "PropositionsList + PropositionComposerPro",
          "DS interval display (Dempster-Shafer)",
          "Nested tabs: Arguments / ASPIC / Propositions",
        ],
      },
      {
        id: "chains-tab",
        title: "Chains Tab",
        description: "Argument chain explorer showing linked reasoning paths",
        icon: GitBranch,
        status: "complete" as const,
        items: [
          "ChainsTab (chain list with depth/status indicators)",
          "Root claim → leaf claims traversal",
          "Chain completeness tracking",
          "Cross-argument linking",
        ],
      },
    ],
  },
  {
    id: "controls",
    title: "Phase 1: Controls & Explorer Panels",
    description: "Header controls, floating sheets, and graph navigation",
    features: [
      {
        id: "header-controls",
        title: "Header Controls",
        description: "Status, confidence mode, DS mode, settings toggle, and navigation links",
        icon: SlidersHorizontal,
        status: "complete" as const,
        items: [
          "StatusChip (content status display)",
          "Confidence mode selector (Product / Min)",
          "DS Mode toggle (Dempster-Shafer intervals)",
          "Settings panel toggle",
          "Agenda navigation (Schemes, Dialogue Timeline, Agora)",
        ],
      },
      {
        id: "graph-explorer",
        title: "Graph Explorer (Left Sheet)",
        description: "Floating panel with argument maps, claim graphs, commitments and analytics",
        icon: Map,
        status: "complete" as const,
        items: [
          "Arguments tab: AIF Dialogue-Aware Graph (Dagre layout)",
          "Claims tab: CEG MiniMap (grounded semantics)",
          "Commitments tab: CommitmentStorePanel",
          "Analytics tab: CommitmentAnalyticsDashboard",
          "Selected claim details with metadata",
        ],
      },
      {
        id: "actions-sheet",
        title: "Actions Sheet (Right Sheet)",
        description: "Dialogical actions, command card, and AIF diagram viewer",
        icon: Zap,
        status: "complete" as const,
        items: [
          "DialogueActionsButton (legal moves)",
          "CommandCard (move grid view)",
          "DiagramViewer (AIF structure for selected claim)",
          "ArgumentActionsSheet (when argument selected)",
        ],
      },
      {
        id: "dictionary-sheet",
        title: "Dictionary Sheet",
        description: "Glossary of deliberation terms with definitions",
        icon: BookOpen,
        status: "complete" as const,
        items: [
          "DefinitionSheet (searchable term glossary)",
          "Term sources and citations",
          "Dark glass variant styling",
        ],
      },
    ],
  },
  {
    id: "advanced",
    title: "Phase 2: Advanced Tabs",
    description: "Ludics, Admin, Sources — specialized deliberation tools",
    features: [
      {
        id: "ludics-tab",
        title: "Ludics Tab",
        description: "Game-semantic compilation, arena visualization, and behaviour inspection",
        icon: Brain,
        status: "complete" as const,
        items: [
          "LudicsPanel (proponent/opponent compilation via /api/ludics/compile)",
          "View modes: Forest / Unified / Split / Game",
          "GameViewPanel (InteractionPlayer, ArenaViewer, LandscapeHeatMap, ProofNarrative)",
          "BehaviourInspectorCard (composition, saturation, uniformity)",
          "TraceRibbon + JudgeConsole (step-through evaluation)",
          "CommitmentsPanel + NLCommitPopover",
          "AnalysisPanel (StrategyInspector, ChronicleViewer, CorrespondenceViewer)",
          "AIF Sync Panel (ludic acts ↔ AIF nodes)",
          "Interaction metrics (acts, loci, depth, branch factor)",
        ],
      },
      {
        id: "admin-tab",
        title: "Admin Tab",
        description: "Discourse dashboard, issues, assumptions, works management, and AIF authoring",
        icon: Settings,
        status: "complete" as const,
        items: [
          "DiscourseDashboard (contributions, engagements, response tracking)",
          "IssuesList + IssueComposer (general/clarification/community_defense)",
          "ActiveAssumptionsPanel + CreateAssumptionForm",
          "WorksList (DN/IH/TC/OP theory types with filtering)",
          "AIFAuthoringPanel (scheme composer, attack scope bar)",
          "RepresentativeViewpoints (rule selection, coverage, sequent display)",
          "CQ Review Dashboard (critical question tracking)",
        ],
      },
      {
        id: "sources-tab",
        title: "Sources Tab",
        description: "Citation browsing, evidence management, and source quality ratings",
        icon: FileText,
        status: "complete" as const,
        items: [
          "DeliberationEvidencePanel (filtered citations by intent/type/relevance)",
          "EvidenceList (aggregated sources with community ratings)",
          "EvidenceFilterBar + EvidenceBalanceBar",
          "Grouped vs list citation views",
          "Source trust badges (verification + archive status)",
          "1-10 rating system with per-source submission",
        ],
      },
    ],
  },
  {
    id: "intelligence",
    title: "Phase 3: Intelligence & Cross-Deliberation",
    description: "Thesis, Analytics, Cross-Deliberation",
    features: [
      {
        id: "thesis-tab",
        title: "Thesis Tab",
        description: "Compose and render structured theses from deliberation",
        icon: Pen,
        status: "planned" as const,
        items: [
          "ThesisComposer (structured thesis authoring)",
          "ThesisRenderer (formatted output)",
          "ThesisListView (browse existing theses)",
        ],
      },
      {
        id: "analytics-tab",
        title: "Analytics Tab",
        description: "Discourse dashboard, topology and approval analysis",
        icon: BarChart3,
        status: "planned" as const,
        items: [
          "DiscourseDashboard (participation metrics)",
          "TopologyWidget (argument topology)",
          "ApprovalsHeatStrip (approval distribution)",
        ],
      },
      {
        id: "cross-tab",
        title: "Cross-Deliberation Tab",
        description: "Search and import arguments across deliberations",
        icon: Network,
        status: "planned" as const,
        items: [
          "CrossRoomSearchPanel (find related arguments)",
          "ArgumentImportModal (import & adapt)",
          "CrossDeliberationTab (linked deliberations)",
        ],
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// DEMO COMPONENT HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    complete: "bg-green-100 text-green-700 border-green-300",
    partial: "bg-yellow-100 text-yellow-700 border-yellow-300",
    planned: "bg-slate-100 text-slate-600 border-slate-300",
  };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${colors[status] ?? colors.planned}`}>
      {status}
    </span>
  );
}

function LabelBadge({ label }: { label: "IN" | "OUT" | "UNDEC" }) {
  const colors: Record<string, string> = {
    IN: "bg-green-100 text-green-700",
    OUT: "bg-red-100 text-red-700",
    UNDEC: "bg-gray-100 text-gray-600",
  };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${colors[label]}`}>
      {label}
    </span>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 0.7 ? "bg-green-500" : value >= 0.4 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value * 100}%` }} />
      </div>
      <span className="text-[11px] font-medium text-slate-700">{(value * 100).toFixed(0)}%</span>
    </div>
  );
}

function DSIntervalBar({ belief, plausibility }: { belief: number; plausibility: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
        <div
          className="absolute h-full bg-indigo-300 rounded-full"
          style={{ left: `${belief * 100}%`, width: `${(plausibility - belief) * 100}%` }}
        />
        <div
          className="absolute h-full bg-indigo-600 rounded-full"
          style={{ width: `${belief * 100}%` }}
        />
      </div>
      <span className="text-[10px] font-mono text-slate-600">
        [{belief.toFixed(2)}, {plausibility.toFixed(2)}]
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERACTIVE DEMO SECTIONS
// ─────────────────────────────────────────────────────────────────────────────

/** 1.1 — Debate Tab Demo */
function DebateTabDemo() {
  const [selectedClaim, setSelectedClaim] = useState<string | null>(null);
  const [composerText, setComposerText] = useState("");
  const [replyTarget, setReplyTarget] = useState<{ id: string; preview: string } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        The Debate tab is the primary entry point for deliberation. Participants compose claims via the
        <strong> DeliberationComposer</strong>, which feeds into a virtualized card list.
        A collapsible settings panel provides configuration controls.
      </p>

      {/* Composer Demo */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Pen className="w-4 h-4 text-indigo-600" />
            Deliberation Composer
          </CardTitle>
          <CardDescription className="text-xs">Rich claim authoring with reply-to support</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {replyTarget && (
            <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg text-xs">
              <Quote className="w-3 h-3 text-indigo-600" />
              <span className="text-indigo-700 truncate">Replying to: {replyTarget.preview}</span>
              <button
                onClick={() => setReplyTarget(null)}
                className="ml-auto text-indigo-400 hover:text-indigo-600"
              >
                ×
              </button>
            </div>
          )}
          <div className="relative">
            <textarea
              className="w-full border border-slate-200 rounded-lg p-3 text-sm resize-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              rows={3}
              placeholder="Enter a claim or proposition..."
              value={composerText}
              onChange={(e) => setComposerText(e.target.value)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Badge variant="outline" className="text-[10px]">Claim</Badge>
              <Badge variant="outline" className="text-[10px]">Proposition</Badge>
            </div>
            <Button
              size="sm"
              onClick={() => {
                if (composerText.trim()) {
                  toast.success("Claim submitted to deliberation");
                  setComposerText("");
                  setReplyTarget(null);
                }
              }}
            >
              Submit Claim
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Claim Feed Demo */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <ListTree className="w-4 h-4 text-indigo-600" />
            Claim Feed (CardListVirtuoso)
          </CardTitle>
          <CardDescription className="text-xs">Virtualized list of claims with grounded semantics labels</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {MOCK_CLAIMS.map((claim) => (
            <div
              key={claim.id}
              onClick={() => {
                setSelectedClaim(claim.id);
                toast.info(`Selected: ${claim.text.slice(0, 50)}...`);
              }}
              className={`p-3 rounded-lg border cursor-pointer transition-all ${
                selectedClaim === claim.id
                  ? "border-indigo-300 bg-indigo-50 shadow-sm"
                  : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-800 leading-relaxed">{claim.text}</p>
                  <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-500">
                    <span>{claim.author}</span>
                    <span>·</span>
                    <span>{new Date(claim.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <LabelBadge label={claim.label} />
                  <ConfidenceBar value={claim.confidence} />
                  <div className="flex gap-2 text-[10px] text-slate-500">
                    <span className="flex items-center gap-0.5">
                      <ThumbsUp className="w-3 h-3 text-green-600" /> {claim.supportCount}
                    </span>
                    <span className="flex items-center gap-0.5">
                      <ThumbsDown className="w-3 h-3 text-red-500" /> {claim.attackCount}
                    </span>
                  </div>
                </div>
              </div>
              {selectedClaim === claim.id && (
                <div className="mt-3 pt-3 border-t border-indigo-200 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      setReplyTarget({ id: claim.id, preview: claim.text.slice(0, 60) });
                      toast.info("Reply target set");
                    }}
                  >
                    Reply
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      toast.info("Open in Graph Explorer (left sheet)");
                    }}
                  >
                    Show in Graph
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      toast.info("Dialogical Actions opened (right sheet)");
                    }}
                  >
                    Actions
                  </Button>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Settings Panel Demo */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm flex items-center gap-2">
                <Settings className="w-4 h-4 text-indigo-600" />
                Deliberation Settings Panel
              </CardTitle>
              <CardDescription className="text-xs">Collapsible configuration sidebar</CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSettingsOpen(!settingsOpen)}
              className="text-xs"
            >
              {settingsOpen ? "Hide" : "Show"} Settings
            </Button>
          </div>
        </CardHeader>
        {settingsOpen && (
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 border border-slate-200 rounded-lg">
                <div className="text-xs font-medium text-slate-700 mb-1">Visibility</div>
                <div className="text-xs text-slate-500">Public — anyone can view</div>
              </div>
              <div className="p-3 border border-slate-200 rounded-lg">
                <div className="text-xs font-medium text-slate-700 mb-1">Submission Mode</div>
                <div className="text-xs text-slate-500">Open — all participants</div>
              </div>
              <div className="p-3 border border-slate-200 rounded-lg">
                <div className="text-xs font-medium text-slate-700 mb-1">Auto-Analysis</div>
                <div className="text-xs text-slate-500">Enabled — AI scheme detection</div>
              </div>
              <div className="p-3 border border-slate-200 rounded-lg">
                <div className="text-xs font-medium text-slate-700 mb-1">Voting</div>
                <div className="text-xs text-slate-500">Approval-based</div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

/** 1.2 — Arguments Tab Demo */
function ArgumentsTabDemo() {
  const [dsMode, setDsMode] = useState(false);
  const [selectedArg, setSelectedArg] = useState<string | null>(null);
  const [nestedTab, setNestedTab] = useState<"arguments" | "aspic" | "propositions">("arguments");

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        The Arguments tab presents AIF-structured arguments with scheme breakdown,
        <strong> ASPIC+</strong> defeasible reasoning panels, and proposition management.
        Toggle DS Mode to see Dempster-Shafer belief intervals.
      </p>

      {/* DS Mode Toggle */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            setDsMode(!dsMode);
            toast.info(`DS Mode: ${!dsMode ? "ON" : "OFF"}`);
          }}
          className={`text-xs px-3 py-1.5 rounded-md border transition-all ${
            dsMode
              ? "bg-indigo-100 border-indigo-300 text-indigo-700"
              : "bg-slate-100 border-slate-300 text-slate-600"
          }`}
        >
          DS Mode: {dsMode ? "ON" : "OFF"}
        </button>
        <span className="text-[11px] text-slate-500">
          {dsMode ? "Showing Dempster-Shafer [belief, plausibility] intervals" : "Showing single confidence values"}
        </span>
      </div>

      {/* Nested Tabs */}
      <Tabs value={nestedTab} onValueChange={(v) => setNestedTab(v as any)}>
        <TabsList className="mb-3">
          <TabsTrigger value="arguments" className="text-xs">Arguments</TabsTrigger>
          <TabsTrigger value="aspic" className="text-xs">ASPIC+</TabsTrigger>
          <TabsTrigger value="propositions" className="text-xs">Propositions</TabsTrigger>
        </TabsList>

        {/* Arguments Sub-Tab */}
        <TabsContent value="arguments">
          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Scale className="w-4 h-4 text-indigo-600" />
                AIFArgumentsListPro
              </CardTitle>
              <CardDescription className="text-xs">Paginated AIF-structured arguments with scheme labels</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {MOCK_ARGUMENTS.map((arg) => (
                <div
                  key={arg.id}
                  onClick={() => {
                    setSelectedArg(arg.id);
                    toast.info(`Selected argument: ${arg.schemeName}`);
                  }}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${
                    selectedArg === arg.id
                      ? "border-indigo-300 bg-indigo-50/50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  {/* Conclusion */}
                  <div className="flex items-start gap-2 mb-3">
                    <Target className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-800">{arg.conclusionText}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-[10px]">{arg.schemeName}</Badge>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                          arg.status === "grounded" ? "bg-green-100 text-green-700" :
                          arg.status === "defeated" ? "bg-red-100 text-red-700" :
                          "bg-gray-100 text-gray-600"
                        }`}>
                          {arg.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Premises */}
                  <div className="ml-6 space-y-1.5 mb-3">
                    {arg.premises.map((p) => (
                      <div key={p.id} className="flex items-start gap-2 text-xs">
                        <ChevronRight className="w-3 h-3 text-slate-400 mt-0.5 shrink-0" />
                        <span className={p.isImplicit ? "text-slate-400 italic" : "text-slate-600"}>
                          {p.isImplicit && <span className="text-[10px] text-amber-600 mr-1">[implicit]</span>}
                          {p.text}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Metrics */}
                  <div className="ml-6 flex items-center gap-4">
                    {dsMode ? (
                      <DSIntervalBar belief={arg.dsInterval.belief} plausibility={arg.dsInterval.plausibility} />
                    ) : (
                      <ConfidenceBar value={arg.dsInterval.belief} />
                    )}
                    <div className="flex gap-2 text-[10px] text-slate-500">
                      <span className="flex items-center gap-0.5">
                        <ThumbsUp className="w-3 h-3 text-green-600" /> {arg.supportCount}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <Swords className="w-3 h-3 text-red-500" /> {arg.attackCount}
                      </span>
                    </div>
                  </div>

                  {/* Selected Actions */}
                  {selectedArg === arg.id && (
                    <div className="mt-3 pt-3 border-t border-indigo-200 flex gap-2">
                      <Button size="sm" variant="outline" className="text-xs h-7" onClick={(e) => {
                        e.stopPropagation();
                        toast.info("Opening Argument Actions Sheet (right floating panel)");
                      }}>
                        Actions Sheet
                      </Button>
                      <Button size="sm" variant="outline" className="text-xs h-7" onClick={(e) => {
                        e.stopPropagation();
                        toast.info("Viewing AIF diagram for this argument");
                      }}>
                        View Diagram
                      </Button>
                      <Button size="sm" variant="outline" className="text-xs h-7" onClick={(e) => {
                        e.stopPropagation();
                        toast.info("Opening Dialogue Timeline at this move");
                      }}>
                        Dialogue Move
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ASPIC+ Sub-Tab */}
        <TabsContent value="aspic">
          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                ASPIC+ Theory Panel
              </CardTitle>
              <CardDescription className="text-xs">Defeasible reasoning with strict/defeasible rules, contraries, and preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Strict Rules */}
              <div>
                <h4 className="text-xs font-semibold text-slate-700 mb-2">Strict Rules</h4>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs bg-slate-50 p-2 rounded">
                    <code className="text-indigo-700">r₁:</code>
                    <span className="text-slate-700">consumption_tax(X) → regressive_impact(X)</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs bg-slate-50 p-2 rounded">
                    <code className="text-indigo-700">r₂:</code>
                    <span className="text-slate-700">carbon_price(X) ∧ border_adjustment(X) → no_leakage(X)</span>
                  </div>
                </div>
              </div>

              {/* Defeasible Rules */}
              <div>
                <h4 className="text-xs font-semibold text-slate-700 mb-2">Defeasible Rules</h4>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs bg-amber-50 p-2 rounded border border-amber-200">
                    <code className="text-amber-700">d₁:</code>
                    <span className="text-slate-700">economic_analysis(X) ⇒ cost_effective(X)</span>
                    <Badge variant="outline" className="text-[9px] ml-auto">defeasible</Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs bg-amber-50 p-2 rounded border border-amber-200">
                    <code className="text-amber-700">d₂:</code>
                    <span className="text-slate-700">revenue_recycling(X) ⇒ ¬regressive_impact(X)</span>
                    <Badge variant="outline" className="text-[9px] ml-auto">defeasible</Badge>
                  </div>
                </div>
              </div>

              {/* Contraries */}
              <div>
                <h4 className="text-xs font-semibold text-slate-700 mb-2">Contraries & Contradictories</h4>
                <div className="flex gap-2">
                  <div className="flex-1 p-2 bg-red-50 border border-red-200 rounded text-xs">
                    <div className="font-medium text-red-700 mb-1">Contrary</div>
                    <span className="text-slate-700">cost_effective ⌐ cost_ineffective</span>
                  </div>
                  <div className="flex-1 p-2 bg-red-50 border border-red-200 rounded text-xs">
                    <div className="font-medium text-red-700 mb-1">Contradictory</div>
                    <span className="text-slate-700">regressive ⊥ ¬regressive</span>
                  </div>
                </div>
              </div>

              {/* Preferences */}
              <div>
                <h4 className="text-xs font-semibold text-slate-700 mb-2">Rule Preferences</h4>
                <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded">
                  d₁ &gt; d₂ (economic analysis preferred over revenue recycling assumption)
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Propositions Sub-Tab */}
        <TabsContent value="propositions">
          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <CircleDot className="w-4 h-4 text-indigo-600" />
                Propositions List
              </CardTitle>
              <CardDescription className="text-xs">Atomic propositions used across arguments</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { id: "prop-1", text: "Carbon pricing reduces emissions", usedIn: 3, type: "assertion" },
                { id: "prop-2", text: "Low-income households spend more on energy", usedIn: 2, type: "assertion" },
                { id: "prop-3", text: "Revenue recycling offsets inequality", usedIn: 1, type: "assumption" },
                { id: "prop-4", text: "Border adjustments prevent leakage", usedIn: 2, type: "assertion" },
              ].map((prop) => (
                <div key={prop.id} className="flex items-center justify-between p-2 rounded-lg border border-slate-200 text-xs">
                  <div className="flex items-center gap-2">
                    <CircleDot className="w-3 h-3 text-indigo-500" />
                    <span className="text-slate-700">{prop.text}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[9px]">{prop.type}</Badge>
                    <span className="text-slate-400 text-[10px]">used in {prop.usedIn} args</span>
                  </div>
                </div>
              ))}
              <Button size="sm" variant="outline" className="text-xs w-full mt-2" onClick={() => toast.info("PropositionComposerPro opened")}>
                <PlusCircle className="w-3 h-3 mr-1" /> Add Proposition
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** 1.3 — Chains Tab Demo */
function ChainsTabDemo() {
  const [expandedChain, setExpandedChain] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        The Chains tab shows linked argument chains — sequences of reasoning that connect
        root claims to supporting leaf claims through intermediate arguments.
      </p>

      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-indigo-600" />
            Argument Chains
          </CardTitle>
          <CardDescription className="text-xs">Linked reasoning paths through the deliberation</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {MOCK_CHAINS.map((chain) => (
            <div
              key={chain.id}
              className="border border-slate-200 rounded-lg overflow-hidden"
            >
              <div
                className="flex items-center justify-between p-3 cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => {
                  setExpandedChain(expandedChain === chain.id ? null : chain.id);
                  toast.info(`Chain: ${chain.title}`);
                }}
              >
                <div className="flex items-center gap-3">
                  <GitBranch className={`w-4 h-4 ${chain.status === "complete" ? "text-green-600" : "text-amber-500"}`} />
                  <div>
                    <div className="text-sm font-medium text-slate-800">{chain.title}</div>
                    <div className="text-[11px] text-slate-500">
                      Depth: {chain.depth} · {chain.argumentIds.length} arguments
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={chain.status} />
                  <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${expandedChain === chain.id ? "rotate-90" : ""}`} />
                </div>
              </div>

              {expandedChain === chain.id && (
                <div className="px-3 pb-3 border-t border-slate-100">
                  {/* Chain Visualization */}
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-indigo-600" />
                      <span className="text-xs font-medium text-indigo-700">Root:</span>
                      <span className="text-xs text-slate-700">{chain.rootClaim}</span>
                    </div>

                    {/* Visual chain path */}
                    <div className="ml-1 border-l-2 border-dashed border-slate-300 pl-4 space-y-2 py-2">
                      {chain.argumentIds.map((argId, i) => (
                        <div key={argId} className="flex items-center gap-2 text-xs text-slate-600">
                          <Scale className="w-3 h-3 text-slate-400" />
                          <span>Argument {i + 1}: {MOCK_ARGUMENTS.find(a => a.id === argId)?.schemeName ?? argId}</span>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-1">
                      {chain.leafClaims.map((leaf, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-green-500" />
                          <span className="text-xs font-medium text-green-700">Leaf:</span>
                          <span className="text-xs text-slate-700">{leaf}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

/** 1.4 — Header Controls Demo */
function HeaderControlsDemo() {
  const [status, setStatus] = useState<"open" | "closed" | "paused">("open");
  const [confMode, setConfMode] = useState<"product" | "min">("product");
  const [dsMode, setDsMode] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        The sticky header provides quick access to deliberation state and configuration.
        These controls persist across tab changes.
      </p>

      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <LayoutDashboard className="w-4 h-4 text-indigo-600" />
            Sticky Header Bar
          </CardTitle>
          <CardDescription className="text-xs">Interactive replica of the DeepDivePanelV2 header</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Header Replica */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3 flex-wrap">
                {/* Status */}
                <button
                  onClick={() => {
                    const next = status === "open" ? "paused" : status === "paused" ? "closed" : "open";
                    setStatus(next);
                    toast.info(`Status: ${next}`);
                  }}
                  className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${
                    status === "open" ? "bg-green-100 border-green-300 text-green-700" :
                    status === "paused" ? "bg-yellow-100 border-yellow-300 text-yellow-700" :
                    "bg-red-100 border-red-300 text-red-700"
                  }`}
                >
                  {status.toUpperCase()}
                </button>

                {/* Confidence Mode */}
                <div className="flex items-center gap-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md px-2 py-1">
                  <span className="text-slate-600">Confidence:</span>
                  <select
                    className="text-xs bg-transparent border-none focus:ring-0 p-0 text-slate-800 font-medium"
                    value={confMode}
                    onChange={(e) => {
                      setConfMode(e.target.value as any);
                      toast.info(`Confidence mode: ${e.target.value}`);
                    }}
                  >
                    <option value="product">Product</option>
                    <option value="min">Min</option>
                  </select>
                </div>

                {/* DS Mode */}
                <button
                  onClick={() => {
                    setDsMode(!dsMode);
                    toast.info(`DS Mode: ${!dsMode ? "ON" : "OFF"}`);
                  }}
                  className={`text-xs px-3 py-1.5 rounded-md border transition-all ${
                    dsMode
                      ? "bg-indigo-100 border-indigo-300 text-indigo-700"
                      : "bg-slate-100 border-slate-300 text-slate-600"
                  }`}
                >
                  DS Mode: {dsMode ? "ON" : "OFF"}
                </button>

                {/* Settings Toggle */}
                <button
                  onClick={() => {
                    setSettingsVisible(!settingsVisible);
                    toast.info(`Settings: ${!settingsVisible ? "SHOW" : "HIDE"}`);
                  }}
                  className={`text-xs px-3 py-1.5 rounded-md border transition-all ${
                    settingsVisible
                      ? "bg-indigo-100 border-indigo-300 text-indigo-700"
                      : "bg-slate-100 border-slate-300 text-slate-600"
                  }`}
                >
                  Settings: {settingsVisible ? "HIDE" : "SHOW"}
                </button>
              </div>

              {/* Right-side links */}
              <div className="flex items-center gap-2">
                <button
                  className="text-xs px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-md hover:bg-slate-100 transition-colors"
                  onClick={() => toast.info("Opens /admin/schemes in new tab")}
                >
                  Configure Schemes
                </button>
                <button
                  className="text-xs px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-md hover:bg-slate-100 transition-colors"
                  onClick={() => toast.info("Opens /deliberation/{id}/dialoguetimeline in new tab")}
                >
                  Dialogue Timeline
                </button>
                <button
                  className="text-xs px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-md hover:bg-slate-100 transition-colors"
                  onClick={() => toast.info("Opens /agora in new tab")}
                >
                  Agora
                </button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** 1.5 — Graph Explorer Demo */
function GraphExplorerDemo() {
  const [explorerTab, setExplorerTab] = useState<"arguments" | "claims" | "commitments" | "analytics">("claims");
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        The left floating sheet provides a multi-tab explorer with argument maps (AIF Dagre layout),
        claim graphs (CEG with grounded semantics), commitment tracking, and analytics.
      </p>

      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Map className="w-4 h-4 text-indigo-600" />
            Graph Explorer (Left Floating Sheet)
          </CardTitle>
          <CardDescription className="text-xs">Four-tab explorer: Arguments, Claims, Commitments, Analytics</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Tab Selector */}
          <div className="flex gap-2 mb-4">
            {(["arguments", "claims", "commitments", "analytics"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setExplorerTab(tab)}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  explorerTab === tab
                    ? "bg-indigo-100 text-indigo-700 shadow-sm"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {/* Arguments Tab */}
          {explorerTab === "arguments" && (
            <div className="space-y-3">
              <div className="text-xs text-slate-600 mb-2">
                <strong>AIF Dialogue-Aware Graph</strong> — Interactive force-directed layout of I-nodes, RA-nodes, CA-nodes
              </div>
              <div className="h-[280px] bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-center relative overflow-hidden">
                {/* Simulated graph nodes */}
                <div className="absolute" style={{ top: "30%", left: "20%" }}>
                  <div className="w-20 h-8 bg-blue-100 border border-blue-300 rounded text-[9px] text-blue-800 flex items-center justify-center cursor-pointer hover:bg-blue-200 transition-colors" onClick={() => toast.info("I-Node: Carbon pricing reduces emissions")}>
                    I: Pricing
                  </div>
                </div>
                <div className="absolute" style={{ top: "30%", left: "50%" }}>
                  <div className="w-16 h-8 bg-green-100 border border-green-300 rounded text-[9px] text-green-800 flex items-center justify-center cursor-pointer hover:bg-green-200 transition-colors" onClick={() => toast.info("RA-Node: Argument from Consequences")}>
                    RA: Csq
                  </div>
                </div>
                <div className="absolute" style={{ top: "30%", left: "75%" }}>
                  <div className="w-20 h-8 bg-blue-100 border border-blue-300 rounded text-[9px] text-blue-800 flex items-center justify-center cursor-pointer hover:bg-blue-200 transition-colors" onClick={() => toast.info("I-Node: Cost-effective solution")}>
                    I: Cost-eff
                  </div>
                </div>
                <div className="absolute" style={{ top: "60%", left: "35%" }}>
                  <div className="w-16 h-8 bg-red-100 border border-red-300 rounded text-[9px] text-red-800 flex items-center justify-center cursor-pointer hover:bg-red-200 transition-colors" onClick={() => toast.info("CA-Node: Undermining attack on premise")}>
                    CA: Atk
                  </div>
                </div>
                <div className="absolute" style={{ top: "60%", left: "60%" }}>
                  <div className="w-20 h-8 bg-blue-100 border border-blue-300 rounded text-[9px] text-blue-800 flex items-center justify-center cursor-pointer hover:bg-blue-200 transition-colors" onClick={() => toast.info("I-Node: Regressive burden")}>
                    I: Regress
                  </div>
                </div>

                {/* Legend */}
                <div className="absolute bottom-2 left-2 flex gap-3 text-[9px] text-slate-500">
                  <span className="flex items-center gap-1"><div className="w-2 h-2 bg-blue-200 border border-blue-300 rounded" /> I-Node</span>
                  <span className="flex items-center gap-1"><div className="w-2 h-2 bg-green-200 border border-green-300 rounded" /> RA-Node</span>
                  <span className="flex items-center gap-1"><div className="w-2 h-2 bg-red-200 border border-red-300 rounded" /> CA-Node</span>
                </div>
              </div>
            </div>
          )}

          {/* Claims Tab */}
          {explorerTab === "claims" && (
            <div className="space-y-3">
              <div className="text-xs text-slate-600 mb-2">
                <strong>CEG MiniMap</strong> — Claim Exploration Graph with grounded semantics labelling
              </div>
              <div className="h-[280px] bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-center relative overflow-hidden">
                {/* Simulated claim graph */}
                {MOCK_CLAIMS.slice(0, 4).map((claim, i) => {
                  const positions = [
                    { top: "20%", left: "25%" },
                    { top: "20%", left: "65%" },
                    { top: "55%", left: "15%" },
                    { top: "55%", left: "55%" },
                  ];
                  const colors: Record<string, string> = { IN: "bg-green-100 border-green-400", OUT: "bg-red-100 border-red-400", UNDEC: "bg-gray-100 border-gray-400" };
                  return (
                    <div key={claim.id} className="absolute" style={positions[i]}>
                      <div
                        className={`w-24 px-2 py-1.5 rounded-lg border-2 text-[9px] cursor-pointer transition-all hover:shadow-md ${colors[claim.label]} ${
                          selectedNode === claim.id ? "ring-2 ring-indigo-400" : ""
                        }`}
                        onClick={() => {
                          setSelectedNode(claim.id);
                          toast.info(`Selected claim: ${claim.text.slice(0, 40)}...`);
                        }}
                      >
                        <div className="font-medium truncate">{claim.text.slice(0, 25)}...</div>
                        <div className="flex justify-between mt-0.5">
                          <LabelBadge label={claim.label} />
                          <span className="text-[8px] text-slate-500">{(claim.confidence * 100).toFixed(0)}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Edges (SVG lines) */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  <line x1="37%" y1="32%" x2="65%" y2="28%" stroke="#94a3b8" strokeWidth="1" strokeDasharray="4,4" />
                  <line x1="27%" y1="32%" x2="20%" y2="58%" stroke="#22c55e" strokeWidth="1.5" />
                  <line x1="70%" y1="32%" x2="60%" y2="58%" stroke="#ef4444" strokeWidth="1.5" />
                </svg>
              </div>

              {/* Selected Claim Info */}
              {selectedNode && (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">Selected Claim</h4>
                  {(() => {
                    const claim = MOCK_CLAIMS.find(c => c.id === selectedNode);
                    if (!claim) return null;
                    return (
                      <div className="space-y-1.5">
                        <p className="text-xs text-slate-700">{claim.text}</p>
                        <div className="flex items-center gap-3">
                          <LabelBadge label={claim.label} />
                          <ConfidenceBar value={claim.confidence} />
                          <span className="text-[10px] text-slate-400">ID: {claim.id.slice(0, 12)}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {/* Commitments Tab */}
          {explorerTab === "commitments" && (
            <div className="space-y-3">
              <div className="text-xs text-slate-600 mb-2">
                <strong>CommitmentStorePanel</strong> — Track participant commitments (asserted, conceded, retracted)
              </div>
              <div className="space-y-2">
                {MOCK_COMMITMENTS.map((c) => (
                  <div key={c.participantId} className="p-3 border border-slate-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-800">{c.name}</span>
                      <Badge variant="outline" className="text-[10px]">{c.active} active</Badge>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-1 text-center p-1.5 bg-green-50 rounded">
                        <div className="text-lg font-bold text-green-700">{c.asserted}</div>
                        <div className="text-[10px] text-green-600">Asserted</div>
                      </div>
                      <div className="flex-1 text-center p-1.5 bg-blue-50 rounded">
                        <div className="text-lg font-bold text-blue-700">{c.conceded}</div>
                        <div className="text-[10px] text-blue-600">Conceded</div>
                      </div>
                      <div className="flex-1 text-center p-1.5 bg-red-50 rounded">
                        <div className="text-lg font-bold text-red-700">{c.retracted}</div>
                        <div className="text-[10px] text-red-600">Retracted</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Analytics Tab */}
          {explorerTab === "analytics" && (
            <div className="space-y-3">
              <div className="text-xs text-slate-600 mb-2">
                <strong>CommitmentAnalyticsDashboard</strong> — Aggregate statistics and trends
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-center">
                  <div className="text-2xl font-bold text-indigo-700">{MOCK_DELIBERATION.claimCount}</div>
                  <div className="text-[11px] text-indigo-600">Total Claims</div>
                </div>
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-center">
                  <div className="text-2xl font-bold text-green-700">{MOCK_DELIBERATION.argumentCount}</div>
                  <div className="text-[11px] text-green-600">Arguments</div>
                </div>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-center">
                  <div className="text-2xl font-bold text-amber-700">{MOCK_DELIBERATION.participantCount}</div>
                  <div className="text-[11px] text-amber-600">Participants</div>
                </div>
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-center">
                  <div className="text-2xl font-bold text-purple-700">{MOCK_DELIBERATION.chainCount}</div>
                  <div className="text-[11px] text-purple-600">Chains</div>
                </div>
              </div>

              {/* Participation Chart Placeholder */}
              <div className="p-4 border border-slate-200 rounded-lg">
                <h4 className="text-xs font-semibold text-slate-700 mb-3">Commitment Distribution</h4>
                <div className="flex items-end gap-2 h-24">
                  {MOCK_COMMITMENTS.map((c) => (
                    <div key={c.participantId} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full flex flex-col gap-0.5">
                        <div className="bg-green-400 rounded-t" style={{ height: `${c.asserted * 12}px` }} />
                        <div className="bg-blue-400" style={{ height: `${c.conceded * 12}px` }} />
                        <div className="bg-red-400 rounded-b" style={{ height: `${Math.max(c.retracted * 12, 2)}px` }} />
                      </div>
                      <span className="text-[9px] text-slate-500 truncate w-full text-center">{c.name.split(" ")[0]}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-center gap-4 mt-2 text-[9px] text-slate-500">
                  <span className="flex items-center gap-1"><div className="w-2 h-2 bg-green-400 rounded" /> Asserted</span>
                  <span className="flex items-center gap-1"><div className="w-2 h-2 bg-blue-400 rounded" /> Conceded</span>
                  <span className="flex items-center gap-1"><div className="w-2 h-2 bg-red-400 rounded" /> Retracted</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** 1.6 — Actions Sheet Demo */
function ActionsSheetDemo() {
  const [selectedTarget, setSelectedTarget] = useState<string | null>("claim-1");

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        The right floating sheet contextually shows either the <strong>ArgumentActionsSheet</strong> (when an argument is selected)
        or the <strong>Dialogical Actions + AIF Diagram</strong> panel (when a claim is selected).
      </p>

      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="w-4 h-4 text-indigo-600" />
            Dialogical Actions (Right Floating Sheet)
          </CardTitle>
          <CardDescription className="text-xs">Legal moves based on dialogue protocol and selected target</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Selected Target */}
          {selectedTarget && (
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
              <div className="text-xs font-medium text-indigo-900 mb-1">Selected Target</div>
              <div className="text-xs text-indigo-700">
                Claim: {MOCK_CLAIMS.find(c => c.id === selectedTarget)?.text.slice(0, 60)}...
              </div>
            </div>
          )}

          {/* Legal Moves Grid (CommandCard) */}
          <div>
            <h4 className="text-xs font-semibold text-slate-700 mb-2">Available Dialogue Moves</h4>
            <div className="grid grid-cols-3 gap-2">
              {MOCK_LEGAL_MOVES.map((move) => {
                const colors: Record<string, string> = {
                  ASSERT: "bg-green-50 border-green-200 text-green-700 hover:bg-green-100",
                  CHALLENGE: "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100",
                  CONCEDE: "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100",
                  RETRACT: "bg-red-50 border-red-200 text-red-700 hover:bg-red-100",
                  QUESTION: "bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100",
                  ARGUE: "bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100",
                };
                return (
                  <button
                    key={move.id}
                    onClick={() => toast.success(`Performed: ${move.label}`)}
                    className={`p-3 rounded-lg border text-center transition-all cursor-pointer ${colors[move.kind] ?? "bg-slate-50 border-slate-200"}`}
                  >
                    <div className="text-xs font-medium">{move.label}</div>
                    <div className="text-[9px] mt-0.5 opacity-75">{move.description}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* AIF Diagram Placeholder */}
          <div>
            <h4 className="text-xs font-semibold text-slate-700 mb-2">AIF Structure Diagram</h4>
            <div className="h-[200px] bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-center">
              <div className="text-center">
                <Network className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <div className="text-xs text-slate-500">DiagramViewer renders AIF subgraph</div>
                <div className="text-[10px] text-slate-400 mt-1">Premise → RA → Conclusion with CA attacks</div>
              </div>
            </div>
            <div className="flex gap-3 mt-2 text-[9px] text-slate-500">
              <span className="flex items-center gap-1"><div className="w-3 h-0.5 bg-slate-500" /> Premise</span>
              <span className="flex items-center gap-1"><div className="w-3 h-0.5 bg-emerald-600" /> Conclusion</span>
              <span className="flex items-center gap-1"><div className="w-3 h-0.5 bg-red-500" /> Conflict</span>
              <span className="flex items-center gap-1"><div className="w-3 h-0.5 bg-violet-500" /> Preference</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** 1.7 — Dictionary Sheet Demo */
function DictionarySheetDemo() {
  const [searchTerm, setSearchTerm] = useState("");
  const filtered = MOCK_GLOSSARY.filter(
    (t) => t.term.toLowerCase().includes(searchTerm.toLowerCase()) || t.definition.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        The Dictionary sheet provides a searchable glossary of terms used within the deliberation,
        rendered in a dark glass variant floating panel.
      </p>

      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-indigo-600" />
            Deliberation Dictionary (Glass-Dark Sheet)
          </CardTitle>
          <CardDescription className="text-xs">Searchable term glossary with source citations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search terms..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Terms */}
          <div className="space-y-2">
            {filtered.map((term) => (
              <div key={term.id} className="p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-slate-800">{term.term}</span>
                  <Badge variant="outline" className="text-[9px]">{term.source}</Badge>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">{term.definition}</p>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-6 text-xs text-slate-500">No matching terms found</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 2 — ADVANCED TABS DEMOS
// ─────────────────────────────────────────────────────────────────────────────

/** Mock data for Ludics */
const MOCK_LUDICS_DESIGNS = [
  {
    id: "design-pro-1",
    role: "proponent" as const,
    acts: 14,
    loci: 8,
    depth: 5,
    branchFactor: 2.3,
    convergent: true,
    scope: "main",
  },
  {
    id: "design-opp-1",
    role: "opponent" as const,
    acts: 11,
    loci: 7,
    depth: 4,
    branchFactor: 1.8,
    convergent: true,
    scope: "main",
  },
];

const MOCK_TRACE_STEPS = [
  { step: 0, player: "P", action: "open", locus: "ε", detail: "Proponent opens at root" },
  { step: 1, player: "O", action: "challenge", locus: "0", detail: "Opponent challenges premise 1" },
  { step: 2, player: "P", action: "defend", locus: "0.0", detail: "Proponent defends with evidence" },
  { step: 3, player: "O", action: "challenge", locus: "0.0.1", detail: "Opponent attacks sub-premise" },
  { step: 4, player: "P", action: "daimon", locus: "0.0.1.0", detail: "Proponent places daimon (†) — wins" },
];

const MOCK_WORKS = [
  { id: "work-1", title: "Main Denotation", theoryType: "DN" as const, standardOutput: null, author: "Dr. Jane Smith", createdAt: "2026-01-20" },
  { id: "work-2", title: "Internal Completeness Proof", theoryType: "IH" as const, standardOutput: "Γ ⊢ Δ verified", author: "Alex Chen", createdAt: "2026-01-22" },
  { id: "work-3", title: "Type-Correctness Check", theoryType: "TC" as const, standardOutput: "Well-typed", author: "Maria Garcia", createdAt: "2026-01-25" },
  { id: "work-4", title: "Operational Semantics Trace", theoryType: "OP" as const, standardOutput: "12 reduction steps", author: "Thomas Lee", createdAt: "2026-01-28" },
];

const MOCK_ISSUES = [
  { id: "issue-1", label: "Missing evidence for premise 2", state: "open" as const, kind: "clarification" as const, description: "The second premise of the carbon pricing argument lacks empirical support.", linkCount: 2 },
  { id: "issue-2", label: "Ambiguous term: cost-effective", state: "open" as const, kind: "general" as const, description: "The term 'cost-effective' is used differently across arguments. Need a deliberation-wide definition.", linkCount: 1 },
  { id: "issue-3", label: "Attack scope unclear on arg-2", state: "closed" as const, kind: "community_defense" as const, description: "The attack on the analogy argument was flagged but resolved after CQ review.", linkCount: 3 },
];

const MOCK_ASSUMPTIONS = [
  { id: "asm-1", text: "All participants have equal access to information", status: "active" as const, createdBy: "Dr. Jane Smith" },
  { id: "asm-2", text: "Economic models accurately reflect real-world conditions", status: "active" as const, createdBy: "Alex Chen" },
  { id: "asm-3", text: "Political feasibility is not a constraint", status: "challenged" as const, createdBy: "Maria Garcia" },
];

const MOCK_EVIDENCE_SOURCES = [
  { id: "src-1", title: "IPCC Sixth Assessment Report", authors: "IPCC Working Group III", year: 2025, type: "report", usageCount: 12, avgRating: 8.7, ratingCount: 5, verificationStatus: "verified" as const, archiveStatus: "archived" as const },
  { id: "src-2", title: "Carbon Tax Revenue Recycling: A Meta-Analysis", authors: "Williams, R. C. et al.", year: 2024, type: "journal", usageCount: 7, avgRating: 7.5, ratingCount: 3, verificationStatus: "verified" as const, archiveStatus: "none" as const },
  { id: "src-3", title: "EU ETS Phase IV Impact Assessment", authors: "European Commission", year: 2025, type: "policy", usageCount: 5, avgRating: 6.8, ratingCount: 4, verificationStatus: "pending" as const, archiveStatus: "archived" as const },
  { id: "src-4", title: "Carbon Leakage and Border Adjustment Mechanisms", authors: "Böhringer, C. & Fischer, C.", year: 2023, type: "journal", usageCount: 3, avgRating: null, ratingCount: 0, verificationStatus: "unverified" as const, archiveStatus: "none" as const },
];

const MOCK_CITATIONS = [
  { id: "cit-1", sourceTitle: "IPCC Sixth Assessment Report", targetType: "claim" as const, targetText: "Carbon pricing is the most cost-effective mechanism", quote: "Market-based instruments, including carbon pricing, have shown the highest cost-efficiency ratios across reviewed jurisdictions.", intent: "supports" as const, relevance: 9, locator: "Ch. 13, p. 42" },
  { id: "cit-2", sourceTitle: "Carbon Tax Revenue Recycling", targetType: "argument" as const, targetText: "Revenue recycling offsets regressive impacts", quote: "Lump-sum dividend programs return 60-80% of carbon tax revenue to households in the bottom two quintiles.", intent: "supports" as const, relevance: 8, locator: "Section 4.2" },
  { id: "cit-3", sourceTitle: "EU ETS Phase IV Impact Assessment", targetType: "claim" as const, targetText: "Cap-and-trade systems have demonstrated success", quote: "Phase III installations reduced emissions by an estimated 3.8% relative to the counterfactual.", intent: "provides_context" as const, relevance: 7, locator: "Table 3" },
  { id: "cit-4", sourceTitle: "Carbon Leakage and Border Adjustment", targetType: "claim" as const, targetText: "Carbon leakage makes unilateral pricing ineffective", quote: "Carbon leakage rates in energy-intensive sectors ranged from 5-25% depending on trade exposure.", intent: "refutes" as const, relevance: 6, locator: "p. 18" },
];

/** 2.1 — Ludics Tab Demo */
function LudicsTabDemo() {
  const [viewMode, setViewMode] = useState<"forest" | "unified" | "split" | "game">("forest");
  const [traceStep, setTraceStep] = useState(0);
  const [compilationStatus, setCompilationStatus] = useState<"idle" | "compiling" | "ready">("ready");
  const [selectedDesign, setSelectedDesign] = useState<string | null>(null);
  const [inspectorMode, setInspectorMode] = useState<"assoc" | "partial" | "spiritual">("assoc");

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        The Ludics tab implements Girard&apos;s ludics framework for game-semantic reasoning.
        Proponent and Opponent <strong>designs</strong> are compiled from the deliberation&apos;s argument structure,
        then explored via forest views, game playback, and behaviour analysis.
      </p>

      {/* Compilation Status */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Gamepad2 className="w-4 h-4 text-indigo-600" />
            Compilation & Designs
          </CardTitle>
          <CardDescription className="text-xs">Compile proponent/opponent designs from deliberation structure</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Compile Button */}
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              onClick={() => {
                setCompilationStatus("compiling");
                setTimeout(() => {
                  setCompilationStatus("ready");
                  toast.success("Designs compiled: 2 designs (P + O)");
                }, 1500);
              }}
              disabled={compilationStatus === "compiling"}
            >
              {compilationStatus === "compiling" ? (
                <><RotateCcw className="w-3 h-3 mr-1 animate-spin" /> Compiling...</>
              ) : (
                <><PlayCircle className="w-3 h-3 mr-1" /> Compile Designs</>
              )}
            </Button>
            <span className={`text-xs px-2 py-1 rounded-full ${
              compilationStatus === "ready" ? "bg-green-100 text-green-700" :
              compilationStatus === "compiling" ? "bg-amber-100 text-amber-700" :
              "bg-slate-100 text-slate-600"
            }`}>
              {compilationStatus === "ready" ? "2 designs ready" : compilationStatus === "compiling" ? "Compiling..." : "Not compiled"}
            </span>
          </div>

          {/* Design Cards */}
          <div className="grid grid-cols-2 gap-3">
            {MOCK_LUDICS_DESIGNS.map((d) => (
              <div
                key={d.id}
                onClick={() => {
                  setSelectedDesign(d.id);
                  toast.info(`Selected: ${d.role} design`);
                }}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  selectedDesign === d.id
                    ? "border-indigo-300 bg-indigo-50"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="outline" className={`text-[10px] ${
                    d.role === "proponent" ? "bg-blue-50 text-blue-700 border-blue-300" : "bg-red-50 text-red-700 border-red-300"
                  }`}>
                    {d.role === "proponent" ? "P (Proponent)" : "O (Opponent)"}
                  </Badge>
                  {d.convergent && (
                    <span className="text-[9px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full">convergent</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-600">
                  <span>Acts: <strong>{d.acts}</strong></span>
                  <span>Loci: <strong>{d.loci}</strong></span>
                  <span>Depth: <strong>{d.depth}</strong></span>
                  <span>Branch: <strong>{d.branchFactor.toFixed(1)}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* View Mode Selector */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TreePine className="w-4 h-4 text-indigo-600" />
            View Modes
          </CardTitle>
          <CardDescription className="text-xs">Multiple visualization modes for exploring designs</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
            {(["forest", "unified", "split", "game"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => {
                  setViewMode(mode);
                  toast.info(`View mode: ${mode}`);
                }}
                className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  viewMode === mode
                    ? "bg-white text-indigo-700 shadow-sm"
                    : "text-slate-600 hover:text-slate-800"
                }`}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>

          {/* View Content */}
          {viewMode === "forest" && (
            <div className="h-[200px] bg-slate-50 rounded-lg border border-slate-200 p-4">
              <div className="text-xs font-medium text-slate-700 mb-3">LudicsForest — Tree Visualization</div>
              <div className="flex items-start gap-8">
                {/* Proponent tree */}
                <div className="space-y-1">
                  <div className="text-[10px] font-medium text-blue-700 mb-1">Proponent</div>
                  <div className="ml-0 text-[10px] text-slate-700">ε (open)</div>
                  <div className="ml-4 text-[10px] text-slate-600">├─ 0.0 (defend)</div>
                  <div className="ml-8 text-[10px] text-slate-600">├─ 0.0.0 (assert)</div>
                  <div className="ml-8 text-[10px] text-green-600">└─ 0.0.1.0 (†)</div>
                  <div className="ml-4 text-[10px] text-slate-600">└─ 1 (assert)</div>
                </div>
                {/* Opponent tree */}
                <div className="space-y-1">
                  <div className="text-[10px] font-medium text-red-700 mb-1">Opponent</div>
                  <div className="ml-0 text-[10px] text-slate-700">ε (wait)</div>
                  <div className="ml-4 text-[10px] text-slate-600">├─ 0 (challenge)</div>
                  <div className="ml-8 text-[10px] text-slate-600">└─ 0.0.1 (attack)</div>
                  <div className="ml-4 text-[10px] text-slate-600">└─ 1 (challenge)</div>
                </div>
              </div>
            </div>
          )}

          {viewMode === "game" && (
            <div className="space-y-3">
              <div className="text-xs font-medium text-slate-700">GameViewPanel — Phase 6 Game Replay</div>
              <div className="flex gap-1 mb-2">
                {["Interaction Player", "Arena Viewer", "Landscape Map", "Proof Narrative"].map((tab) => (
                  <Badge key={tab} variant="outline" className="text-[9px] cursor-pointer hover:bg-slate-50">{tab}</Badge>
                ))}
              </div>
              <div className="h-[160px] bg-gradient-to-br from-slate-50 to-indigo-50 rounded-lg border border-slate-200 flex items-center justify-center">
                <div className="text-center">
                  <Gamepad2 className="w-8 h-8 text-indigo-300 mx-auto mb-2" />
                  <div className="text-xs text-slate-500">Interactive game replay with step-through controls</div>
                </div>
              </div>
            </div>
          )}

          {(viewMode === "unified" || viewMode === "split") && (
            <div className="h-[200px] bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-center">
              <div className="text-center">
                <TreePine className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <div className="text-xs text-slate-500">
                  {viewMode === "unified" ? "Unified tree: both designs interleaved" : "Split view: side-by-side P vs O"}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Trace Ribbon */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-600" />
            Trace Ribbon & Judge Console
          </CardTitle>
          <CardDescription className="text-xs">Step-through trace of the interaction</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Step Controls */}
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setTraceStep(Math.max(0, traceStep - 1))} disabled={traceStep === 0}>
              ← Prev
            </Button>
            <span className="text-xs text-slate-600">Step {traceStep + 1} / {MOCK_TRACE_STEPS.length}</span>
            <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setTraceStep(Math.min(MOCK_TRACE_STEPS.length - 1, traceStep + 1))} disabled={traceStep >= MOCK_TRACE_STEPS.length - 1}>
              Next →
            </Button>
            <Button size="sm" variant="outline" className="text-xs h-7 ml-auto" onClick={() => { setTraceStep(0); toast.info("Trace reset"); }}>
              <RotateCcw className="w-3 h-3 mr-1" /> Reset
            </Button>
          </div>

          {/* Trace Steps */}
          <div className="space-y-1">
            {MOCK_TRACE_STEPS.map((s, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-all ${
                  i === traceStep
                    ? "bg-indigo-50 border border-indigo-200 shadow-sm"
                    : i < traceStep
                    ? "bg-slate-50 text-slate-500"
                    : "text-slate-400"
                }`}
              >
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  s.player === "P" ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"
                }`}>
                  {s.player}
                </span>
                <code className="text-[10px] font-mono text-slate-500 w-16">{s.locus}</code>
                <Badge variant="outline" className={`text-[9px] ${
                  s.action === "daimon" ? "bg-green-50 text-green-700 border-green-300" : ""
                }`}>{s.action}</Badge>
                <span className="flex-1 text-slate-600">{s.detail}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Behaviour Inspector */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Microscope className="w-4 h-4 text-indigo-600" />
            Behaviour Inspector
          </CardTitle>
          <CardDescription className="text-xs">Composition preflight, saturation, and uniformity checks</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Mode Selector */}
          <div className="flex gap-2">
            {(["assoc", "partial", "spiritual"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => {
                  setInspectorMode(mode);
                  toast.info(`Inspector mode: ${mode}`);
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-all ${
                  inspectorMode === mode
                    ? "bg-indigo-100 border-indigo-300 text-indigo-700"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* Inspector Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 border border-slate-200 rounded-lg">
              <div className="text-xs font-semibold text-slate-700 mb-2">A) Composition Preflight</div>
              <div className="space-y-1 text-[10px] text-slate-600">
                <div className="flex justify-between">P design: <code className="text-indigo-600">design-pro-1</code></div>
                <div className="flex justify-between">O design: <code className="text-indigo-600">design-opp-1</code></div>
                <div className="flex items-center gap-1 mt-1"><Check className="w-3 h-3 text-green-600" /> No collisions detected</div>
              </div>
              <Button size="sm" variant="outline" className="text-xs h-6 w-full mt-2" onClick={() => toast.success("Preflight passed")}>
                Run Preflight
              </Button>
            </div>

            <div className="p-3 border border-slate-200 rounded-lg">
              <div className="text-xs font-semibold text-slate-700 mb-2">B) Copy / Fresh Children</div>
              <div className="space-y-1 text-[10px] text-slate-600">
                <div>Base locus: <code className="text-indigo-600">ε</code></div>
                <div>Children: <code>0</code>, <code>0.0</code>, <code>0.0.1</code></div>
              </div>
              <Button size="sm" variant="outline" className="text-xs h-6 w-full mt-2" onClick={() => toast.info("3 children copied")}>
                Copy Children
              </Button>
            </div>

            <div className="p-3 border border-slate-200 rounded-lg">
              <div className="text-xs font-semibold text-slate-700 mb-2">C) Saturation</div>
              <div className="space-y-1 text-[10px]">
                <div className="flex items-center gap-1">
                  <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[9px]">CONVERGENT</span>
                  <span className="text-slate-600">child @ 0</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[9px]">CONVERGENT</span>
                  <span className="text-slate-600">child @ 0.0</span>
                </div>
              </div>
              <Button size="sm" variant="outline" className="text-xs h-6 w-full mt-2" onClick={() => toast.success("All children saturated")}>
                Run Saturation
              </Button>
            </div>

            <div className="p-3 border border-slate-200 rounded-lg">
              <div className="text-xs font-semibold text-slate-700 mb-2">D) Uniformity (α-equiv)</div>
              <div className="space-y-1 text-[10px] text-slate-600">
                <div>Child A: <code>0</code> vs Child B: <code>0.0</code></div>
                <div className="flex items-center gap-1 mt-1">
                  <Check className="w-3 h-3 text-green-600" /> <span className="text-green-700">uniform ✓</span>
                </div>
              </div>
              <Button size="sm" variant="outline" className="text-xs h-6 w-full mt-2" onClick={() => toast.success("Uniformity check passed")}>
                Check Uniformity
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AIF Sync */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Merge className="w-4 h-4 text-indigo-600" />
            AIF Sync Panel
          </CardTitle>
          <CardDescription className="text-xs">Synchronization between ludic acts and AIF argument nodes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[
              { act: "open @ ε", aifNode: "I:claim-1", status: "synced" },
              { act: "defend @ 0.0", aifNode: "RA:arg-1", status: "synced" },
              { act: "challenge @ 0", aifNode: "CA:atk-1", status: "synced" },
              { act: "daimon @ 0.0.1.0", aifNode: "—", status: "unlinked" },
            ].map((row, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg text-xs">
                <code className="text-slate-700">{row.act}</code>
                <span className="text-slate-400">↔</span>
                <code className="text-indigo-600">{row.aifNode}</code>
                <span className={`px-1.5 py-0.5 rounded text-[9px] ${
                  row.status === "synced" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                }`}>{row.status}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** 2.2 — Admin Tab Demo */
function AdminTabDemo() {
  const [issueFilter, setIssueFilter] = useState<"all" | "open" | "closed">("all");
  const [theoryFilter, setTheoryFilter] = useState<"ALL" | "DN" | "IH" | "TC" | "OP">("ALL");
  const [showIssueComposer, setShowIssueComposer] = useState(false);

  const filteredIssues = MOCK_ISSUES.filter(
    (i) => issueFilter === "all" || i.state === issueFilter
  );
  const filteredWorks = MOCK_WORKS.filter(
    (w) => theoryFilter === "ALL" || w.theoryType === theoryFilter
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        The Admin tab provides deliberation management tools: a discourse dashboard for tracking
        contributions, issues and objections management, assumption tracking, works list, and AIF authoring.
      </p>

      {/* Discourse Dashboard */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <LayoutDashboard className="w-4 h-4 text-indigo-600" />
            Discourse Dashboard
          </CardTitle>
          <CardDescription className="text-xs">Track contributions, engagements, and respond to challenges</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-3">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-center">
              <div className="text-xl font-bold text-blue-700">8</div>
              <div className="text-[10px] text-blue-600">My Claims</div>
            </div>
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-center">
              <div className="text-xl font-bold text-green-700">5</div>
              <div className="text-[10px] text-green-600">My Arguments</div>
            </div>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-center">
              <div className="text-xl font-bold text-amber-700">3</div>
              <div className="text-[10px] text-amber-600">Pending CQs</div>
            </div>
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-center">
              <div className="text-xl font-bold text-red-700">2</div>
              <div className="text-[10px] text-red-600">Attacks on Me</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Issues & Objections */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm flex items-center gap-2">
                <Bug className="w-4 h-4 text-indigo-600" />
                Issues & Objections
              </CardTitle>
              <CardDescription className="text-xs">Track and manage issues raised during deliberation</CardDescription>
            </div>
            <Button size="sm" variant="outline" className="text-xs" onClick={() => setShowIssueComposer(!showIssueComposer)}>
              <PlusCircle className="w-3 h-3 mr-1" /> New Issue
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Issue Composer */}
          {showIssueComposer && (
            <div className="p-3 border border-indigo-200 bg-indigo-50 rounded-lg space-y-2">
              <div className="flex gap-2">
                {(["general", "clarification", "community_defense"] as const).map((kind) => (
                  <Badge key={kind} variant="outline" className={`text-[9px] cursor-pointer ${
                    kind === "clarification" ? "bg-indigo-50 border-indigo-300 text-indigo-700" :
                    kind === "community_defense" ? "bg-emerald-50 border-emerald-300 text-emerald-700" :
                    ""
                  }`}>{kind.replace("_", " ")}</Badge>
                ))}
              </div>
              <input className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-md" placeholder="Issue label..." />
              <textarea className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-md resize-none" rows={2} placeholder="Description..." />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setShowIssueComposer(false)}>Cancel</Button>
                <Button size="sm" className="text-xs h-7" onClick={() => { setShowIssueComposer(false); toast.success("Issue created"); }}>Open Issue</Button>
              </div>
            </div>
          )}

          {/* Filter */}
          <div className="flex gap-1">
            {(["all", "open", "closed"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setIssueFilter(f)}
                className={`px-3 py-1 rounded-md text-xs transition-all ${
                  issueFilter === f ? "bg-indigo-100 text-indigo-700" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          {/* Issue List */}
          <div className="space-y-2">
            {filteredIssues.map((issue) => (
              <div key={issue.id} className="p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => toast.info(`Issue: ${issue.label}`)}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-slate-800">{issue.label}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-[9px] ${
                      issue.kind === "clarification" ? "bg-indigo-50 text-indigo-700 border-indigo-300" :
                      issue.kind === "community_defense" ? "bg-emerald-50 text-emerald-700 border-emerald-300" :
                      ""
                    }`}>{issue.kind.replace("_", " ")}</Badge>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      issue.state === "open" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"
                    }`}>{issue.state}</span>
                  </div>
                </div>
                <p className="text-xs text-slate-600 truncate">{issue.description}</p>
                <div className="text-[10px] text-slate-400 mt-1">{issue.linkCount} linked items</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Assumptions */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-indigo-600" />
            Active Assumptions
          </CardTitle>
          <CardDescription className="text-xs">Track assumptions underlying the deliberation</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {MOCK_ASSUMPTIONS.map((asm) => (
            <div key={asm.id} className="flex items-center justify-between p-2 border border-slate-200 rounded-lg">
              <div className="flex items-center gap-2">
                <Lightbulb className={`w-3.5 h-3.5 ${
                  asm.status === "active" ? "text-amber-500" : "text-red-500"
                }`} />
                <span className="text-xs text-slate-700">{asm.text}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400">{asm.createdBy}</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                  asm.status === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                }`}>{asm.status}</span>
              </div>
            </div>
          ))}
          <Button size="sm" variant="outline" className="text-xs w-full mt-2" onClick={() => toast.info("CreateAssumptionForm opened")}>
            <PlusCircle className="w-3 h-3 mr-1" /> Add Assumption
          </Button>
        </CardContent>
      </Card>

      {/* Works List */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Database className="w-4 h-4 text-indigo-600" />
            Works List
          </CardTitle>
          <CardDescription className="text-xs">Theory works: Denotation (DN), Internal Homology (IH), Type-Correctness (TC), Operational (OP)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Filter */}
          <div className="flex gap-1">
            {(["ALL", "DN", "IH", "TC", "OP"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setTheoryFilter(f)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  theoryFilter === f ? "bg-indigo-100 text-indigo-700" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Works */}
          <div className="space-y-2">
            {filteredWorks.map((work) => {
              const typeColors: Record<string, string> = {
                DN: "bg-blue-100 text-blue-700 border-blue-300",
                IH: "bg-purple-100 text-purple-700 border-purple-300",
                TC: "bg-amber-100 text-amber-700 border-amber-300",
                OP: "bg-green-100 text-green-700 border-green-300",
              };
              return (
                <div key={work.id} className="p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => toast.info(`Open work: ${work.title}`)}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-800">{work.title}</span>
                    <Badge variant="outline" className={`text-[10px] ${typeColors[work.theoryType]}`}>{work.theoryType}</Badge>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-slate-500">
                    <span>{work.author}</span>
                    <span>·</span>
                    <span>{work.createdAt}</span>
                    {work.standardOutput && (
                      <><span>·</span><code className="text-indigo-600">{work.standardOutput}</code></>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* AIF Authoring & Representative Viewpoints (summary) */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Component className="w-4 h-4 text-indigo-600" />
            AIF Authoring & Viewpoints
          </CardTitle>
          <CardDescription className="text-xs">Advanced authoring tools and representative viewpoint selection</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 border border-slate-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Scale className="w-4 h-4 text-indigo-500" />
                <span className="text-xs font-semibold text-slate-700">AIFAuthoringPanel</span>
              </div>
              <p className="text-[10px] text-slate-600 mb-2">
                Scheme-based argument composer with attack scope bar (REBUTS / UNDERCUTS / UNDERMINES).
                Includes conclusion claim picker and SchemeComposerPicker modal.
              </p>
              <Button size="sm" variant="outline" className="text-xs w-full" onClick={() => toast.info("AIFAuthoringPanel opened")}>
                Open Authoring Panel
              </Button>
            </div>

            <div className="p-4 border border-slate-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Eye className="w-4 h-4 text-indigo-500" />
                <span className="text-xs font-semibold text-slate-700">Representative Viewpoints</span>
              </div>
              <p className="text-[10px] text-slate-600 mb-2">
                Rule-based selection (Utilitarian/Harmonic/MaxCov) with coverage analysis, JR satisfaction,
                sequent display (Γ ⊢ Δ), and CQ addressing workflow.
              </p>
              <div className="flex gap-1 mb-2">
                {["Utilitarian", "Harmonic", "MaxCov"].map((rule) => (
                  <Badge key={rule} variant="outline" className="text-[9px] cursor-pointer hover:bg-slate-50">{rule}</Badge>
                ))}
              </div>
              <Button size="sm" variant="outline" className="text-xs w-full" onClick={() => toast.info("Viewpoints computed")}>
                Compute Viewpoints
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** 2.3 — Sources Tab Demo */
function SourcesTabDemo() {
  const [viewMode, setViewMode] = useState<"list" | "grouped">("list");
  const [intentFilter, setIntentFilter] = useState<"all" | "supports" | "refutes" | "provides_context">("all");
  const [ratingSource, setRatingSource] = useState<string | null>(null);
  const [ratingValue, setRatingValue] = useState<number | null>(null);

  const filteredCitations = MOCK_CITATIONS.filter(
    (c) => intentFilter === "all" || c.intent === intentFilter
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        The Sources tab provides two views: a citation browser with filtering by intent, type, and relevance,
        and an aggregated source quality panel with community ratings and trust indicators.
      </p>

      {/* Citation Browser (DeliberationEvidencePanel) */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-indigo-600" />
            Browse Citations (DeliberationEvidencePanel)
          </CardTitle>
          <CardDescription className="text-xs">Filter and search all citations by intent, source type, or content</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Filters Row */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Intent Filter */}
            <div className="flex gap-1">
              {(["all", "supports", "refutes", "provides_context"] as const).map((intent) => {
                const colors: Record<string, string> = {
                  all: "bg-slate-100 text-slate-700",
                  supports: "bg-green-100 text-green-700",
                  refutes: "bg-red-100 text-red-700",
                  provides_context: "bg-blue-100 text-blue-700",
                };
                const count = intent === "all" ? MOCK_CITATIONS.length : MOCK_CITATIONS.filter(c => c.intent === intent).length;
                return (
                  <button
                    key={intent}
                    onClick={() => setIntentFilter(intent)}
                    className={`px-2 py-1 rounded-md text-xs transition-all ${
                      intentFilter === intent ? `${colors[intent]} font-medium` : "text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    {intent === "provides_context" ? "Context" : intent.charAt(0).toUpperCase() + intent.slice(1)} ({count})
                  </button>
                );
              })}
            </div>

            <div className="ml-auto flex gap-1">
              <button
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded ${viewMode === "list" ? "bg-indigo-100 text-indigo-700" : "text-slate-400"}`}
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("grouped")}
                className={`p-1.5 rounded ${viewMode === "grouped" ? "bg-indigo-100 text-indigo-700" : "text-slate-400"}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Balance Bar */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden flex">
              <div className="bg-green-400 h-full" style={{ width: "50%" }} />
              <div className="bg-blue-400 h-full" style={{ width: "25%" }} />
              <div className="bg-red-400 h-full" style={{ width: "25%" }} />
            </div>
            <div className="flex gap-2 text-[9px] text-slate-500">
              <span className="flex items-center gap-0.5"><div className="w-2 h-2 bg-green-400 rounded" /> Supports</span>
              <span className="flex items-center gap-0.5"><div className="w-2 h-2 bg-blue-400 rounded" /> Context</span>
              <span className="flex items-center gap-0.5"><div className="w-2 h-2 bg-red-400 rounded" /> Refutes</span>
            </div>
          </div>

          {/* Citations List */}
          <div className="space-y-2">
            {filteredCitations.map((cit) => {
              const intentColors: Record<string, string> = {
                supports: "bg-green-100 text-green-700 border-green-300",
                refutes: "bg-red-100 text-red-700 border-red-300",
                provides_context: "bg-blue-100 text-blue-700 border-blue-300",
              };
              return (
                <div key={cit.id} className="p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {cit.targetType === "claim" ? (
                        <Target className="w-3 h-3 text-indigo-500" />
                      ) : (
                        <Scale className="w-3 h-3 text-indigo-500" />
                      )}
                      <span className="text-[10px] text-slate-500">{cit.targetType}</span>
                      <span className="text-xs text-slate-700 truncate">{cit.targetText}</span>
                    </div>
                    <Badge variant="outline" className={`text-[9px] ${intentColors[cit.intent]}`}>
                      {cit.intent.replace("_", " ")}
                    </Badge>
                  </div>
                  {cit.quote && (
                    <blockquote className="text-xs text-slate-600 italic border-l-2 border-slate-300 pl-3 mb-2">
                      &ldquo;{cit.quote}&rdquo;
                    </blockquote>
                  )}
                  <div className="flex items-center gap-3 text-[10px] text-slate-500">
                    <span className="font-medium">{cit.sourceTitle}</span>
                    <span>·</span>
                    <span>{cit.locator}</span>
                    <span>·</span>
                    <span className="flex items-center gap-0.5">
                      {Array.from({ length: Math.min(cit.relevance, 10) }, (_, i) => (
                        <Star key={i} className={`w-2.5 h-2.5 ${i < cit.relevance ? "text-amber-400 fill-amber-400" : "text-slate-300"}`} />
                      )).slice(0, 5)}
                      <span className="ml-0.5">{cit.relevance}/10</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Source Quality Ratings (EvidenceList) */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Star className="w-4 h-4 text-indigo-600" />
            Source Quality Ratings (EvidenceList)
          </CardTitle>
          <CardDescription className="text-xs">Community-evaluated sources with trust badges and ratings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-xs text-slate-600 mb-1">
            {MOCK_EVIDENCE_SOURCES.length} sources · {MOCK_EVIDENCE_SOURCES.reduce((s, e) => s + e.usageCount, 0)} total citations
          </div>

          {MOCK_EVIDENCE_SOURCES.map((src) => (
            <div key={src.id} className="p-3 border border-slate-200 rounded-lg">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-800">{src.title}</span>
                    <ExternalLink className="w-3 h-3 text-slate-400" />
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {src.authors} · {src.year} · {src.type}
                  </div>
                </div>
                {/* Trust Badges */}
                <div className="flex gap-1">
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                    src.verificationStatus === "verified" ? "bg-green-100 text-green-700" :
                    src.verificationStatus === "pending" ? "bg-amber-100 text-amber-700" :
                    "bg-slate-100 text-slate-600"
                  }`}>
                    {src.verificationStatus}
                  </span>
                  {src.archiveStatus === "archived" && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                      <Archive className="w-2.5 h-2.5 inline mr-0.5" />archived
                    </span>
                  )}
                </div>
              </div>

              {/* Metrics */}
              <div className="flex items-center gap-4 text-[10px] text-slate-600">
                <span>Used {src.usageCount}×</span>
                {src.avgRating !== null ? (
                  <span className="flex items-center gap-0.5">
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                    {src.avgRating.toFixed(1)} ({src.ratingCount} ratings)
                  </span>
                ) : (
                  <span className="text-slate-400">No ratings yet</span>
                )}
              </div>

              {/* Rating Widget */}
              {ratingSource === src.id ? (
                <div className="mt-2 p-2 bg-slate-50 rounded-lg">
                  <div className="flex gap-1 mb-2">
                    {Array.from({ length: 10 }, (_, i) => (
                      <button
                        key={i}
                        onClick={() => setRatingValue(i + 1)}
                        className={`w-7 h-7 rounded text-[10px] font-medium border transition-all ${
                          ratingValue === i + 1
                            ? "bg-amber-100 border-amber-400 text-amber-700"
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" className="text-xs h-6" onClick={() => { setRatingSource(null); setRatingValue(null); }}>Cancel</Button>
                    <Button size="sm" className="text-xs h-6" onClick={() => { toast.success(`Rated ${src.title}: ${ratingValue}/10`); setRatingSource(null); setRatingValue(null); }}>Submit</Button>
                  </div>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs h-6 mt-1"
                  onClick={() => setRatingSource(src.id)}
                >
                  <Star className="w-3 h-3 mr-1" /> Rate this source
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function DeliberationFeaturesPage() {
  const [activePhase, setActivePhase] = useState("core");
  const [activeDemo, setActiveDemo] = useState("debate-tab");

  const allFeatures = PHASES.flatMap((p) => p.features);
  const currentFeature = allFeatures.find((f) => f.id === activeDemo);

  const demoComponents: Record<string, React.ReactNode> = {
    "debate-tab": <DebateTabDemo />,
    "arguments-tab": <ArgumentsTabDemo />,
    "chains-tab": <ChainsTabDemo />,
    "header-controls": <HeaderControlsDemo />,
    "graph-explorer": <GraphExplorerDemo />,
    "actions-sheet": <ActionsSheetDemo />,
    "dictionary-sheet": <DictionarySheetDemo />,
    "ludics-tab": <LudicsTabDemo />,
    "admin-tab": <AdminTabDemo />,
    "sources-tab": <SourcesTabDemo />,
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
        <Toaster position="bottom-right" />

        {/* Header */}
        <div className="relative overflow-hidden border-b border-slate-900/10">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-400/10 via-violet-400/10 to-indigo-400/10" />
          <div className="relative mx-auto max-w-7xl px-6 py-12 text-center">
            <Badge className="mb-4 bg-indigo-100 text-indigo-700 border-indigo-300">Phase 1 + 2</Badge>
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-indigo-700 via-violet-700 to-indigo-700 bg-clip-text text-transparent">
              Deliberation Engine Features
            </h1>
            <p className="mt-3 text-base text-slate-500 max-w-2xl mx-auto">
              Interactive demonstration of the core deliberation engine —
              debate, structured argumentation, chains, graph exploration, dialogical actions,
              ludics game semantics, admin tools, and evidence sources.
            </p>
            <div className="mt-4 flex items-center justify-center gap-3 text-sm text-slate-500">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 backdrop-blur-sm px-3 py-1 border border-slate-900/10 shadow-sm">
                <Scale className="w-3.5 h-3.5" /> {MOCK_DELIBERATION.argumentCount} arguments
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 backdrop-blur-sm px-3 py-1 border border-slate-900/10 shadow-sm">
                <Target className="w-3.5 h-3.5" /> {MOCK_DELIBERATION.claimCount} claims
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 backdrop-blur-sm px-3 py-1 border border-slate-900/10 shadow-sm">
                <Users className="w-3.5 h-3.5" /> {MOCK_DELIBERATION.participantCount} participants
              </span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="grid grid-cols-12 gap-8">
            {/* Left Sidebar — Phase/Feature Navigation */}
            <div className="col-span-4">
              <div className="sticky top-6 space-y-4">
                {PHASES.map((phase) => (
                  <div key={phase.id} className="space-y-1.5">
                    <button
                      onClick={() => setActivePhase(phase.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-all ${
                        activePhase === phase.id
                          ? "bg-indigo-50 border border-indigo-200"
                          : "hover:bg-slate-50"
                      }`}
                    >
                      <div className="text-sm font-semibold text-slate-800">{phase.title}</div>
                      <div className="text-[11px] text-slate-500">{phase.description}</div>
                    </button>

                    {activePhase === phase.id && (
                      <div className="ml-3 space-y-1">
                        {phase.features.map((feature) => {
                          const Icon = feature.icon;
                          const isActive = activeDemo === feature.id;
                          const hasDemo = !!demoComponents[feature.id];
                          return (
                            <button
                              key={feature.id}
                              onClick={() => {
                                if (hasDemo) {
                                  setActiveDemo(feature.id);
                                } else {
                                  toast.info(`${feature.title} — coming in a future phase`);
                                }
                              }}
                              className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all ${
                                isActive
                                  ? "bg-indigo-100 text-indigo-700 font-medium"
                                  : hasDemo
                                  ? "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
                                  : "text-slate-400 cursor-default"
                              }`}
                            >
                              <Icon className="w-3.5 h-3.5 shrink-0" />
                              <span className="flex-1">{feature.title}</span>
                              <StatusBadge status={feature.status} />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Right Content — Active Demo */}
            <div className="col-span-8">
              {currentFeature && (
                <div className="space-y-4">
                  {/* Feature Header */}
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-indigo-100 rounded-lg">
                      <currentFeature.icon className="w-5 h-5 text-indigo-700" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-slate-800">{currentFeature.title}</h2>
                      <p className="text-sm text-slate-500">{currentFeature.description}</p>
                    </div>
                    <div className="ml-auto">
                      <StatusBadge status={currentFeature.status} />
                    </div>
                  </div>

                  {/* Feature Checklist */}
                  <Card className="border-slate-200 bg-slate-50/50">
                    <CardContent className="py-3 px-4">
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {currentFeature.items.map((item, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-xs text-slate-600">
                            <Check className="w-3 h-3 text-green-600 shrink-0" />
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Interactive Demo */}
                  {demoComponents[activeDemo] ?? (
                    <Card className="border-dashed border-2 border-slate-200">
                      <CardContent className="py-12 text-center">
                        <Sparkles className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                        <div className="text-sm font-medium text-slate-600">Coming in a future phase</div>
                        <div className="text-xs text-slate-400 mt-1">This demo will be built in Phase 2 or 3</div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
