"use client";

/**
 * Living Peer Review Demo Page — Phase 4
 *
 * Interactive demonstration of Phase 4 academic features:
 * - Phase 4.1: Public Peer Review Deliberations
 * - Phase 4.2: Argumentation-Based Reputation
 * - Phase 4.3: Academic Credit Integration (ORCID, CV Export, Institutional Reports)
 *
 * Accessible at: /test/living-peer-review
 */

import * as React from "react";
import { useState } from "react";
import { toast, Toaster } from "sonner";
import {
  BookOpen,
  Check,
  ChevronRight,
  ClipboardList,
  Download,
  ExternalLink,
  FileText,
  GraduationCap,
  Link2,
  MessageSquare,
  Scale,
  Settings,
  Shield,
  Star,
  Trophy,
  Upload,
  UserCheck,
  Users,
  Award,
  BarChart3,
  Building2,
  Calendar,
  CircleCheck,
  Clock,
  Eye,
  Gauge,
  Layers,
  Lightbulb,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  TooltipProvider,
} from "@/components/ui/tooltip";

// ─────────────────────────────────────────────────────────────────────────────
// PHASE DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

const PHASES = [
  {
    id: "phase41",
    title: "Phase 4.1: Public Peer Review",
    description: "Structured review deliberations",
    features: [
      {
        id: "review-setup",
        title: "Review Templates & Creation",
        description: "Create structured review deliberations with configurable templates and phases",
        icon: ClipboardList,
        phase: "Phase 4.1",
        status: "complete" as const,
        items: [
          "Review templates with criteria sets",
          "Multi-phase review structure",
          "Blind/open review modes",
          "Target type support (paper, preprint, thesis, grant)",
        ],
      },
      {
        id: "assignments",
        title: "Reviewer Assignments",
        description: "Assign reviewers with roles, track responses, and manage commitments",
        icon: UserCheck,
        phase: "Phase 4.1",
        status: "complete" as const,
        items: [
          "Invite & assign reviewers with roles",
          "Accept/decline workflow",
          "Reviewer commitments on specific issues",
          "Commitment resolution tracking",
        ],
      },
      {
        id: "author-response",
        title: "Author Response System",
        description: "Authors respond to reviewer critiques through structured dialogue moves",
        icon: MessageSquare,
        phase: "Phase 4.1",
        status: "complete" as const,
        items: [
          "Concede, rebut, clarify, revise moves",
          "Move-to-commitment linking",
          "Phase-scoped author responses",
          "Response completeness tracking",
        ],
      },
      {
        id: "review-lifecycle",
        title: "Review Lifecycle & Decisions",
        description: "Advance through review phases with editorial decisions and progress tracking",
        icon: Layers,
        phase: "Phase 4.1",
        status: "complete" as const,
        items: [
          "Phase advancement (Initial → Response → Revision)",
          "Editorial decisions (accept/revise/reject)",
          "Progress & timeline visualization",
          "Phase outcomes & summaries",
        ],
      },
    ],
  },
  {
    id: "phase42",
    title: "Phase 4.2: Argumentation-Based Reputation",
    description: "Scholar profiles & metrics",
    features: [
      {
        id: "contributions",
        title: "Contribution Tracking",
        description: "Track every scholarly action from arguments to reviews",
        icon: TrendingUp,
        phase: "Phase 4.2",
        status: "complete" as const,
        items: [
          "19 contribution types tracked",
          "Quality multiplier scoring",
          "Verification system",
          "Deliberation-scoped contributions",
        ],
      },
      {
        id: "scholar-stats",
        title: "Scholar Statistics",
        description: "Aggregate metrics for defense rates, consensus, and impact",
        icon: BarChart3,
        phase: "Phase 4.2",
        status: "complete" as const,
        items: [
          "Defense success rate",
          "Attack precision score",
          "Consensus rate tracking",
          "Citation count & downstream usage",
        ],
      },
      {
        id: "expertise",
        title: "Topic Expertise & Discovery",
        description: "Build expertise profiles and discover experts by topic",
        icon: GraduationCap,
        phase: "Phase 4.2",
        status: "complete" as const,
        items: [
          "5-level expertise system (Novice → Authority)",
          "Per-topic expertise scoring",
          "Expert discovery by topic area",
          "Reputation leaderboard",
        ],
      },
      {
        id: "reviewer-profile",
        title: "Reviewer Recognition",
        description: "Track reviewer quality, timeliness, and specializations",
        icon: Award,
        phase: "Phase 4.2",
        status: "complete" as const,
        items: [
          "Review completion & quality metrics",
          "Timeliness (avg response days)",
          "Blocking concern resolution rate",
          "Specialization tracking",
        ],
      },
    ],
  },
  {
    id: "phase43",
    title: "Phase 4.3: Academic Credit Integration",
    description: "ORCID, CV export & reporting",
    features: [
      {
        id: "orcid",
        title: "ORCID Integration",
        description: "Connect ORCID to attribute contributions to your scholarly profile",
        icon: Link2,
        phase: "Phase 4.3",
        status: "complete" as const,
        items: [
          "OAuth 2.0 connection flow",
          "Push works to ORCID profile",
          "Auto-sync eligible contributions",
          "Token refresh & error handling",
        ],
      },
      {
        id: "cv-export",
        title: "CV Export",
        description: "Export contributions in multiple academic formats",
        icon: Download,
        phase: "Phase 4.3",
        status: "complete" as const,
        items: [
          "JSON-LD (Schema.org) structured data",
          "BibTeX citation format",
          "LaTeX document source",
          "CSV spreadsheet export",
        ],
      },
      {
        id: "institutional",
        title: "Institutional Reports",
        description: "Aggregate reports for departments and institutions",
        icon: Building2,
        phase: "Phase 4.3",
        status: "complete" as const,
        items: [
          "Faculty contribution breakdown",
          "Department & institution aggregates",
          "Impact metrics (citations, consensus)",
          "Period-over-period comparison",
        ],
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA — PEER REVIEW (4.1)
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_REVIEW_TEMPLATES = [
  { id: "t1", name: "Standard Peer Review", phases: 3, criteria: 6, usage: 24 },
  { id: "t2", name: "Rapid Review", phases: 2, criteria: 4, usage: 12 },
  { id: "t3", name: "Grant Proposal Review", phases: 4, criteria: 8, usage: 7 },
];

const MOCK_REVIEW = {
  id: "rev-1",
  title: "Distributed Consensus in Multi-Agent Systems",
  targetType: "PAPER",
  status: "IN_REVIEW",
  isBlinded: false,
  isPublicReview: true,
  currentPhase: "Initial Review",
  phases: [
    { name: "Initial Review", status: "ACTIVE", order: 1 },
    { name: "Author Response", status: "PENDING", order: 2 },
    { name: "Revision Round", status: "PENDING", order: 3 },
  ],
  reviewers: [
    { name: "Dr. Sarah Chen", role: "REVIEWER", status: "ACCEPTED", commitments: 3 },
    { name: "Prof. James Miller", role: "REVIEWER", status: "ACCEPTED", commitments: 2 },
    { name: "Dr. Aisha Patel", role: "REVIEWER", status: "INVITED", commitments: 0 },
  ],
  timeline: [
    { event: "Review created", date: "Jan 15, 2026", actor: "Editor" },
    { event: "Reviewers invited", date: "Jan 16, 2026", actor: "Editor" },
    { event: "Dr. Chen accepted", date: "Jan 18, 2026", actor: "Dr. Chen" },
    { event: "Prof. Miller accepted", date: "Jan 19, 2026", actor: "Prof. Miller" },
    { event: "Initial Review phase started", date: "Jan 20, 2026", actor: "System" },
    { event: "Dr. Chen submitted 3 commitments", date: "Feb 1, 2026", actor: "Dr. Chen" },
    { event: "Prof. Miller submitted 2 commitments", date: "Feb 3, 2026", actor: "Prof. Miller" },
  ],
};

const MOCK_COMMITMENTS = [
  {
    id: "cm1",
    reviewer: "Dr. Sarah Chen",
    topic: "Methodology",
    description: "The consensus algorithm lacks formal convergence guarantees under network partitions.",
    position: "CONCERNED",
    strength: "STRONG",
    isResolved: false,
  },
  {
    id: "cm2",
    reviewer: "Dr. Sarah Chen",
    topic: "Related Work",
    description: "Missing comparison with Byzantine fault-tolerant protocols (PBFT, HotStuff).",
    position: "CONCERNED",
    strength: "MODERATE",
    isResolved: false,
  },
  {
    id: "cm3",
    reviewer: "Dr. Sarah Chen",
    topic: "Contribution",
    description: "Novel approach to agent communication is well-motivated and original.",
    position: "SUPPORTIVE",
    strength: "STRONG",
    isResolved: false,
  },
  {
    id: "cm4",
    reviewer: "Prof. James Miller",
    topic: "Experiments",
    description: "Simulation scale (100 agents) may not reflect real-world deployments of 10,000+ agents.",
    position: "CONCERNED",
    strength: "MODERATE",
    isResolved: false,
  },
  {
    id: "cm5",
    reviewer: "Prof. James Miller",
    topic: "Presentation",
    description: "Paper is clearly written with good use of formal notation.",
    position: "SUPPORTIVE",
    strength: "MODERATE",
    isResolved: false,
  },
];

const MOCK_AUTHOR_RESPONSES = [
  {
    id: "ar1",
    moveType: "REBUT",
    commitmentId: "cm1",
    commitmentTopic: "Methodology",
    text: "We provide convergence guarantees in Theorem 3.2 (Section 4). The proof covers asynchronous networks with up to f < n/3 faulty nodes.",
    supportingArgId: "arg-proof-1",
  },
  {
    id: "ar2",
    moveType: "CONCEDE",
    commitmentId: "cm2",
    commitmentTopic: "Related Work",
    text: "We agree this comparison is needed. We will add a dedicated section comparing with PBFT and HotStuff in the revision.",
  },
  {
    id: "ar3",
    moveType: "CLARIFY",
    commitmentId: "cm4",
    commitmentTopic: "Experiments",
    text: "Our simulations use 100 agents per cluster with 50 clusters (5,000 total). We will clarify this in Section 6 and add a 10,000-agent experiment.",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA — REPUTATION (4.2)
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_SCHOLAR_STATS = {
  totalArguments: 47,
  argumentsWithConsensus: 31,
  totalAttacks: 18,
  successfulAttacks: 12,
  totalDefenses: 23,
  successfulDefenses: 19,
  reviewsCompleted: 8,
  averageReviewDepth: 4.2,
  citationCount: 34,
  downstreamUsage: 15,
  defenseSuccessRate: 0.826,
  attackPrecision: 0.667,
  consensusRate: 0.66,
  reputationScore: 78.4,
};

const MOCK_EXPERTISE = [
  { topicArea: "Distributed Systems", expertiseScore: 89, level: "EXPERT", contributions: 23, consensus: 18 },
  { topicArea: "Consensus Algorithms", expertiseScore: 76, level: "ESTABLISHED", contributions: 15, consensus: 10 },
  { topicArea: "Multi-Agent Systems", expertiseScore: 62, level: "ESTABLISHED", contributions: 12, consensus: 7 },
  { topicArea: "Formal Verification", expertiseScore: 35, level: "CONTRIBUTOR", contributions: 8, consensus: 3 },
  { topicArea: "Machine Learning", expertiseScore: 18, level: "NOVICE", contributions: 4, consensus: 1 },
];

const MOCK_LEADERBOARD = [
  { rank: 1, name: "Dr. Sarah Chen", score: 94.2, arguments: 82, reviews: 15, expertise: "Distributed Systems" },
  { rank: 2, name: "Prof. James Miller", score: 88.7, arguments: 65, reviews: 22, expertise: "Formal Methods" },
  { rank: 3, name: "Dr. Aisha Patel", score: 82.1, arguments: 54, reviews: 11, expertise: "AI Safety" },
  { rank: 4, name: "Dr. Wei Zhang", score: 78.4, arguments: 47, reviews: 8, expertise: "Distributed Systems" },
  { rank: 5, name: "Prof. Elena Rossi", score: 71.5, arguments: 39, reviews: 19, expertise: "Game Theory" },
];

const MOCK_REVIEWER_PROFILE = {
  totalReviews: 8,
  completedOnTime: 7,
  averageCommitments: 4.2,
  blockingConcernRate: 0.375,
  concernResolutionRate: 0.833,
  revisionInfluenceRate: 0.625,
  averageResponseDays: 5.3,
  invitationAcceptRate: 0.909,
  repeatInvitations: 4,
  topSpecialties: [
    { topicArea: "Distributed Systems", reviewCount: 4 },
    { topicArea: "Consensus Algorithms", reviewCount: 3 },
    { topicArea: "Formal Verification", reviewCount: 2 },
  ],
};

const MOCK_CONTRIBUTIONS = [
  { type: "ARGUMENT_CREATED", count: 47, label: "Arguments Created" },
  { type: "ATTACK_INITIATED", count: 18, label: "Attacks Initiated" },
  { type: "DEFENSE_PROVIDED", count: 23, label: "Defenses Provided" },
  { type: "CONSENSUS_ACHIEVED", count: 31, label: "Consensus Achieved" },
  { type: "REVIEW_COMPLETED", count: 8, label: "Reviews Completed" },
  { type: "CITATION_RECEIVED", count: 34, label: "Citations Received" },
];

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA — CREDIT (4.3)
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_ORCID_CONNECTION = {
  orcidId: "0000-0002-1825-0097",
  autoSyncEnabled: true,
  lastSyncAt: "2026-02-10T14:30:00Z",
  syncedWorkCount: 12,
  hasErrors: false,
};

const MOCK_SYNCED_WORKS = [
  { title: "Scholarly Argument: Distributed consensus in multi-agent...", type: "SCHOLARLY_ARGUMENT", status: "SYNCED", syncedAt: "Feb 10, 2026" },
  { title: "Peer Review: Byzantine Fault Tolerance Analysis", type: "PEER_REVIEW", status: "SYNCED", syncedAt: "Feb 8, 2026" },
  { title: "Scholarly Argument: Formal verification of protocol...", type: "SCHOLARLY_ARGUMENT", status: "SYNCED", syncedAt: "Feb 5, 2026" },
  { title: "Peer Review: Scalable Multi-Agent Communication", type: "PEER_REVIEW", status: "SYNCED", syncedAt: "Jan 28, 2026" },
  { title: "Scholarly Argument: Agent communication overhead...", type: "SCHOLARLY_ARGUMENT", status: "FAILED", syncedAt: "Jan 25, 2026" },
];

const MOCK_EXPORT_FORMATS = [
  { id: "json-ld", label: "JSON-LD", description: "Schema.org structured data", icon: FileText },
  { id: "bibtex", label: "BibTeX", description: "LaTeX bibliography format", icon: FileText },
  { id: "latex", label: "LaTeX", description: "Document source file", icon: FileText },
  { id: "csv", label: "CSV", description: "Spreadsheet compatible", icon: Download },
];

const MOCK_REPORT_DATA = {
  period: "Jan 1, 2026 — Feb 12, 2026",
  totalContributors: 42,
  totalContributions: 387,
  topContributors: [
    { name: "Dr. Sarah Chen", count: 38, score: 94.2 },
    { name: "Prof. James Miller", count: 31, score: 88.7 },
    { name: "Dr. Aisha Patel", count: 27, score: 82.1 },
  ],
  impactMetrics: {
    totalCitations: 156,
    consensusAchieved: 43,
    reviewsCompleted: 28,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPER COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function FeatureCard({ feature }: { feature: (typeof PHASES)[0]["features"][0] }) {
  const Icon = feature.icon;
  return (
    <Card className="h-full bg-indigo-50/60">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-100 text-indigo-700">
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                {feature.title}
                <Badge className="bg-indigo-600 text-xs">{feature.phase}</Badge>
              </CardTitle>
              <CardDescription className="text-sm">{feature.description}</CardDescription>
            </div>
          </div>
          <Badge variant="default" className="bg-green-600 shrink-0">
            <Check className="w-3 h-3 mr-1" />
            Complete
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1.5">
          {feature.items.map((item, i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-slate-600">
              <Check className="w-3 h-3 text-green-500 shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function StatCard({
  label,
  value,
  subtext,
  color = "indigo",
}: {
  label: string;
  value: string | number;
  subtext?: string;
  color?: string;
}) {
  const colorMap: Record<string, string> = {
    indigo: "text-indigo-600",
    green: "text-green-600",
    amber: "text-amber-600",
    blue: "text-blue-600",
    purple: "text-purple-600",
  };
  return (
    <div className="text-center">
      <p className={`text-2xl font-bold ${colorMap[color] || colorMap.indigo}`}>{value}</p>
      <p className={`text-xs ${colorMap[color] || colorMap.indigo}`}>{label}</p>
      {subtext && <p className="text-[10px] text-slate-400 mt-0.5">{subtext}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DEMO — 4.1 PEER REVIEW
// ─────────────────────────────────────────────────────────────────────────────

function ReviewSetupDemo() {
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(false);

  const handleCreate = async () => {
    setCreating(true);
    toast.info("Creating review deliberation...");
    await new Promise((r) => setTimeout(r, 1200));
    setCreated(true);
    setCreating(false);
    toast.success("Review deliberation created", {
      description: "3 phases configured, 6 criteria loaded from template",
    });
  };

  return (
    <Card className="bg-indigo-50/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5" />
          Review Templates & Setup
          <Badge className="ml-2 bg-indigo-600 text-xs">Phase 4.1</Badge>
        </CardTitle>
        <CardDescription>
          Create structured review deliberations from configurable templates
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-medium">Available Templates:</p>
          {MOCK_REVIEW_TEMPLATES.map((t) => (
            <div key={t.id} className="flex items-center justify-between p-3 border rounded-lg bg-white">
              <div>
                <p className="text-sm font-medium">{t.name}</p>
                <p className="text-xs text-muted-foreground">
                  {t.phases} phases • {t.criteria} criteria
                </p>
              </div>
              <Badge variant="outline" className="text-xs">{t.usage} uses</Badge>
            </div>
          ))}
        </div>

        {!created ? (
          <Button
            className="w-full bg-indigo-600 hover:bg-indigo-700"
            disabled={creating}
            onClick={handleCreate}
          >
            {creating ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Creating...
              </div>
            ) : (
              "Create Review from Template"
            )}
          </Button>
        ) : (
          <div className="p-3 border border-green-200 bg-green-50 rounded-lg">
            <div className="flex items-center gap-2">
              <CircleCheck className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-green-700">Review Created Successfully</span>
            </div>
            <p className="text-xs text-green-600 mt-1">&quot;Distributed Consensus in Multi-Agent Systems&quot; — 3 review phases configured</p>
          </div>
        )}

        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-xs text-green-700">
            <strong>✅ Implemented:</strong> Templates at{" "}
            <code className="bg-green-100 px-1 rounded">lib/review/templateService.ts</code> •
            API at <code className="bg-green-100 px-1 rounded">/api/review</code>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function ReviewPhaseDemo() {
  const [activePhase, setActivePhase] = useState(0);

  return (
    <Card className="bg-indigo-50/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="w-5 h-5" />
          Review Phase Progression
          <Badge className="ml-2 bg-indigo-600 text-xs">Phase 4.1</Badge>
        </CardTitle>
        <CardDescription>
          Reviews advance through structured phases with outcomes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          {MOCK_REVIEW.phases.map((phase, i) => (
            <React.Fragment key={phase.name}>
              <button
                className={`flex-1 p-3 rounded-lg border text-center transition-all ${
                  i === activePhase
                    ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200"
                    : i < activePhase
                    ? "border-green-300 bg-green-50"
                    : "border-slate-200 bg-white"
                }`}
                onClick={() => setActivePhase(i)}
              >
                <div className="flex items-center justify-center gap-1">
                  {i < activePhase ? (
                    <Check className="w-3 h-3 text-green-600" />
                  ) : i === activePhase ? (
                    <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                  ) : (
                    <Clock className="w-3 h-3 text-slate-400" />
                  )}
                  <span className={`text-xs font-medium ${
                    i === activePhase ? "text-indigo-700" : i < activePhase ? "text-green-700" : "text-slate-500"
                  }`}>
                    {phase.name}
                  </span>
                </div>
              </button>
              {i < MOCK_REVIEW.phases.length - 1 && (
                <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
              )}
            </React.Fragment>
          ))}
        </div>

        <div className="p-4 border rounded-lg bg-white space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">{MOCK_REVIEW.title}</h4>
            <Badge variant="outline" className="text-xs">
              {MOCK_REVIEW.targetType}
            </Badge>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {MOCK_REVIEW.reviewers.map((r) => (
              <div key={r.name} className="p-2 border rounded bg-slate-50 text-center">
                <p className="text-xs font-medium truncate">{r.name}</p>
                <Badge
                  variant="outline"
                  className={`text-[10px] mt-1 ${
                    r.status === "ACCEPTED"
                      ? "text-green-700 border-green-300"
                      : "text-amber-700 border-amber-300"
                  }`}
                >
                  {r.status}
                </Badge>
                {r.commitments > 0 && (
                  <p className="text-[10px] text-slate-500 mt-0.5">{r.commitments} commitments</p>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Badge variant="outline" className="text-xs">
              <Eye className="w-3 h-3 mr-1" />
              Public Review
            </Badge>
            <Badge variant="outline" className="text-xs">
              <UserCheck className="w-3 h-3 mr-1" />
              Open (not blinded)
            </Badge>
          </div>
        </div>

        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-xs text-green-700">
            <strong>✅ Implemented:</strong> Phase engine at{" "}
            <code className="bg-green-100 px-1 rounded">lib/review/progressService.ts</code> •
            API at <code className="bg-green-100 px-1 rounded">/api/review/[id]/phase/advance</code>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function CommitmentsDemo() {
  const [resolvedIds, setResolvedIds] = useState<string[]>([]);

  const handleResolve = (id: string) => {
    setResolvedIds((prev) => [...prev, id]);
    toast.success("Commitment resolved", { description: "Marked as addressed by author" });
  };

  return (
    <Card className="bg-indigo-50/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="w-5 h-5" />
          Reviewer Commitments
          <Badge className="ml-2 bg-indigo-600 text-xs">Phase 4.1</Badge>
        </CardTitle>
        <CardDescription>
          Typed positions (supportive/concerned) on specific aspects of the work
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {MOCK_COMMITMENTS.map((c) => {
          const isResolved = resolvedIds.includes(c.id);
          return (
            <div
              key={c.id}
              className={`p-3 border rounded-lg transition-all ${
                isResolved ? "bg-green-50 border-green-200 opacity-70" : "bg-white"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-slate-500">{c.reviewer}</span>
                    <Badge variant="outline" className="text-[10px]">{c.topic}</Badge>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        c.position === "SUPPORTIVE"
                          ? "text-green-700 border-green-300 bg-green-50"
                          : "text-amber-700 border-amber-300 bg-amber-50"
                      }`}
                    >
                      {c.position}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        c.strength === "STRONG"
                          ? "text-red-700 border-red-300"
                          : "text-slate-600 border-slate-300"
                      }`}
                    >
                      {c.strength}
                    </Badge>
                  </div>
                  <p className="text-sm">{c.description}</p>
                </div>
                {!isResolved && c.position === "CONCERNED" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 text-xs h-7"
                    onClick={() => handleResolve(c.id)}
                  >
                    Resolve
                  </Button>
                )}
                {isResolved && (
                  <Badge className="bg-green-600 shrink-0 text-xs">
                    <Check className="w-3 h-3 mr-1" />
                    Resolved
                  </Badge>
                )}
              </div>
            </div>
          );
        })}

        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-xs text-green-700">
            <strong>✅ Implemented:</strong> Commitments at{" "}
            <code className="bg-green-100 px-1 rounded">lib/review/commitmentService.ts</code> •
            API at <code className="bg-green-100 px-1 rounded">/api/review/[id]/commitments</code>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function AuthorResponseDemo() {
  const [respondedIds, setRespondedIds] = useState<string[]>(["ar1"]);

  const handleRespond = (id: string) => {
    setRespondedIds((prev) => [...prev, id]);
    toast.success("Author response submitted");
  };

  const moveTypeColors: Record<string, string> = {
    REBUT: "text-red-700 border-red-300 bg-red-50",
    CONCEDE: "text-green-700 border-green-300 bg-green-50",
    CLARIFY: "text-blue-700 border-blue-300 bg-blue-50",
    REVISE: "text-purple-700 border-purple-300 bg-purple-50",
  };

  const moveTypeIcons: Record<string, React.ReactNode> = {
    REBUT: <Shield className="w-3 h-3" />,
    CONCEDE: <Check className="w-3 h-3" />,
    CLARIFY: <Lightbulb className="w-3 h-3" />,
    REVISE: <Settings className="w-3 h-3" />,
  };

  return (
    <Card className="bg-indigo-50/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Author Response Workflow
          <Badge className="ml-2 bg-indigo-600 text-xs">Phase 4.1</Badge>
        </CardTitle>
        <CardDescription>
          Authors respond with structured dialogue moves: rebut, concede, clarify, or revise
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {MOCK_AUTHOR_RESPONSES.map((ar) => {
          const isSubmitted = respondedIds.includes(ar.id);
          return (
            <div key={ar.id} className="p-3 border rounded-lg bg-white">
              <div className="flex items-center gap-2 mb-2">
                <Badge
                  variant="outline"
                  className={`text-xs ${moveTypeColors[ar.moveType]}`}
                >
                  {moveTypeIcons[ar.moveType]}
                  <span className="ml-1">{ar.moveType}</span>
                </Badge>
                <span className="text-xs text-slate-500">
                  Re: {ar.commitmentTopic} commitment
                </span>
                {isSubmitted && (
                  <Badge className="bg-green-600 text-[10px] ml-auto">Submitted</Badge>
                )}
              </div>
              <p className="text-sm">{ar.text}</p>
              {ar.supportingArgId && (
                <p className="text-xs text-indigo-600 mt-1">
                  <Link2 className="w-3 h-3 inline mr-1" />
                  Linked to supporting argument
                </p>
              )}
              {!isSubmitted && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 text-xs h-7"
                  onClick={() => handleRespond(ar.id)}
                >
                  Submit Response
                </Button>
              )}
            </div>
          );
        })}

        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-xs text-green-700">
            <strong>✅ Implemented:</strong> Author responses at{" "}
            <code className="bg-green-100 px-1 rounded">lib/review/authorResponseService.ts</code> •
            API at <code className="bg-green-100 px-1 rounded">/api/review/[id]/responses</code>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function ReviewTimelineDemo() {
  return (
    <Card className="bg-indigo-50/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Review Timeline
          <Badge className="ml-2 bg-indigo-600 text-xs">Phase 4.1</Badge>
        </CardTitle>
        <CardDescription>
          Chronological history of all review events
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative ml-4 space-y-0">
          {MOCK_REVIEW.timeline.map((event, i) => (
            <div key={i} className="flex gap-3 pb-4 relative">
              <div className="absolute left-0 top-0 bottom-0 w-px bg-indigo-200" style={{ left: "5px" }} />
              <div className="relative z-10 mt-1">
                <div className={`w-3 h-3 rounded-full border-2 ${
                  i === MOCK_REVIEW.timeline.length - 1
                    ? "bg-indigo-500 border-indigo-500"
                    : "bg-white border-indigo-300"
                }`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{event.event}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-slate-500">{event.date}</span>
                  <span className="text-xs text-slate-400">•</span>
                  <span className="text-xs text-slate-500">{event.actor}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="p-3 bg-green-50 border border-green-200 rounded-lg mt-2">
          <p className="text-xs text-green-700">
            <strong>✅ Implemented:</strong> Timeline at{" "}
            <code className="bg-green-100 px-1 rounded">lib/review/progressService.ts</code> •
            API at <code className="bg-green-100 px-1 rounded">/api/review/[id]/timeline</code>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DEMO — 4.2 REPUTATION
// ─────────────────────────────────────────────────────────────────────────────

function ScholarStatsDemo() {
  const s = MOCK_SCHOLAR_STATS;

  return (
    <Card className="bg-indigo-50/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          Scholar Statistics
          <Badge className="ml-2 bg-indigo-600 text-xs">Phase 4.2</Badge>
        </CardTitle>
        <CardDescription>
          Aggregated metrics derived from argumentation outcomes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Reputation Score */}
        <div className="p-4 border rounded-lg bg-white text-center">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Reputation Score</p>
          <p className="text-4xl font-bold text-indigo-600">{s.reputationScore}</p>
          <div className="w-full h-2 bg-slate-100 rounded-full mt-2">
            <div
              className="h-full bg-gradient-to-r from-indigo-400 to-indigo-600 rounded-full"
              style={{ width: `${s.reputationScore}%` }}
            />
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 border rounded-lg bg-white">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-4 h-4 text-green-600" />
              <span className="text-xs font-medium">Defense Success</span>
            </div>
            <p className="text-xl font-bold text-green-600">
              {Math.round(s.defenseSuccessRate * 100)}%
            </p>
            <p className="text-[10px] text-slate-500">{s.successfulDefenses}/{s.totalDefenses} defenses held</p>
          </div>
          <div className="p-3 border rounded-lg bg-white">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-medium">Attack Precision</span>
            </div>
            <p className="text-xl font-bold text-amber-600">
              {Math.round(s.attackPrecision * 100)}%
            </p>
            <p className="text-[10px] text-slate-500">{s.successfulAttacks}/{s.totalAttacks} attacks succeeded</p>
          </div>
          <div className="p-3 border rounded-lg bg-white">
            <div className="flex items-center gap-2 mb-1">
              <Scale className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-medium">Consensus Rate</span>
            </div>
            <p className="text-xl font-bold text-blue-600">
              {Math.round(s.consensusRate * 100)}%
            </p>
            <p className="text-[10px] text-slate-500">{s.argumentsWithConsensus}/{s.totalArguments} reached consensus</p>
          </div>
          <div className="p-3 border rounded-lg bg-white">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-purple-600" />
              <span className="text-xs font-medium">Citation Impact</span>
            </div>
            <p className="text-xl font-bold text-purple-600">{s.citationCount}</p>
            <p className="text-[10px] text-slate-500">{s.downstreamUsage} downstream usages</p>
          </div>
        </div>

        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-xs text-green-700">
            <strong>✅ Implemented:</strong> Stats at{" "}
            <code className="bg-green-100 px-1 rounded">lib/reputation/statsService.ts</code> •
            API at <code className="bg-green-100 px-1 rounded">/api/reputation/stats/[userId]</code>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function ExpertiseDemo() {
  const levelColors: Record<string, string> = {
    AUTHORITY: "bg-purple-100 text-purple-700 border-purple-300",
    EXPERT: "bg-indigo-100 text-indigo-700 border-indigo-300",
    ESTABLISHED: "bg-blue-100 text-blue-700 border-blue-300",
    CONTRIBUTOR: "bg-green-100 text-green-700 border-green-300",
    NOVICE: "bg-slate-100 text-slate-600 border-slate-300",
  };

  return (
    <Card className="bg-indigo-50/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GraduationCap className="w-5 h-5" />
          Topic Expertise
          <Badge className="ml-2 bg-indigo-600 text-xs">Phase 4.2</Badge>
        </CardTitle>
        <CardDescription>
          Expertise levels derived from contributions and consensus in each topic
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {MOCK_EXPERTISE.map((e) => (
          <div key={e.topicArea} className="p-3 border rounded-lg bg-white">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">{e.topicArea}</span>
              <Badge variant="outline" className={`text-xs ${levelColors[e.level]}`}>
                {e.level}
              </Badge>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full">
              <div
                className="h-full bg-gradient-to-r from-blue-400 to-indigo-500 rounded-full transition-all"
                style={{ width: `${e.expertiseScore}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[10px] text-slate-500">
                {e.contributions} contributions • {e.consensus} consensus
              </span>
              <span className="text-[10px] font-medium text-indigo-600">
                {e.expertiseScore}/100
              </span>
            </div>
          </div>
        ))}

        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-xs text-green-700">
            <strong>✅ Implemented:</strong> Expertise at{" "}
            <code className="bg-green-100 px-1 rounded">lib/reputation/expertiseService.ts</code> •
            API at <code className="bg-green-100 px-1 rounded">/api/reputation/expertise/[userId]</code>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function LeaderboardDemo() {
  return (
    <Card className="bg-indigo-50/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="w-5 h-5" />
          Reputation Leaderboard
          <Badge className="ml-2 bg-indigo-600 text-xs">Phase 4.2</Badge>
        </CardTitle>
        <CardDescription>
          Top scholars ranked by reputation score
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {MOCK_LEADERBOARD.map((entry) => (
            <div
              key={entry.rank}
              className={`flex items-center gap-3 p-3 border rounded-lg ${
                entry.rank <= 3 ? "bg-gradient-to-r from-amber-50 to-white border-amber-200" : "bg-white"
              }`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                entry.rank === 1 ? "bg-amber-400 text-white" :
                entry.rank === 2 ? "bg-slate-300 text-white" :
                entry.rank === 3 ? "bg-amber-600 text-white" :
                "bg-slate-100 text-slate-600"
              }`}>
                {entry.rank}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{entry.name}</p>
                <p className="text-xs text-slate-500">
                  {entry.arguments} arguments • {entry.reviews} reviews • {entry.expertise}
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-indigo-600">{entry.score}</p>
                <p className="text-[10px] text-slate-500">reputation</p>
              </div>
            </div>
          ))}
        </div>

        <div className="p-3 bg-green-50 border border-green-200 rounded-lg mt-4">
          <p className="text-xs text-green-700">
            <strong>✅ Implemented:</strong> Leaderboard at{" "}
            <code className="bg-green-100 px-1 rounded">lib/reputation/statsService.ts</code> •
            API at <code className="bg-green-100 px-1 rounded">/api/reputation/leaderboard</code>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function ReviewerProfileDemo() {
  const p = MOCK_REVIEWER_PROFILE;

  return (
    <Card className="bg-indigo-50/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="w-5 h-5" />
          Reviewer Profile
          <Badge className="ml-2 bg-indigo-600 text-xs">Phase 4.2</Badge>
        </CardTitle>
        <CardDescription>
          Quality, timeliness, and specialization metrics for reviewers
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 border rounded-lg bg-white text-center">
            <p className="text-xl font-bold text-indigo-600">{p.totalReviews}</p>
            <p className="text-[10px] text-slate-500">Total Reviews</p>
          </div>
          <div className="p-3 border rounded-lg bg-white text-center">
            <p className="text-xl font-bold text-green-600">{Math.round(p.invitationAcceptRate * 100)}%</p>
            <p className="text-[10px] text-slate-500">Accept Rate</p>
          </div>
          <div className="p-3 border rounded-lg bg-white text-center">
            <p className="text-xl font-bold text-blue-600">{p.averageResponseDays}d</p>
            <p className="text-[10px] text-slate-500">Avg Response</p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Quality Metrics</p>
          {[
            { label: "On-time completion", value: p.completedOnTime, total: p.totalReviews, pct: Math.round((p.completedOnTime / p.totalReviews) * 100) },
            { label: "Concern resolution", value: null, total: null, pct: Math.round(p.concernResolutionRate * 100) },
            { label: "Revision influence", value: null, total: null, pct: Math.round(p.revisionInfluenceRate * 100) },
          ].map((m) => (
            <div key={m.label} className="flex items-center gap-3">
              <span className="text-xs text-slate-600 w-36 shrink-0">{m.label}</span>
              <div className="flex-1 h-2 bg-slate-100 rounded-full">
                <div
                  className="h-full bg-indigo-500 rounded-full"
                  style={{ width: `${m.pct}%` }}
                />
              </div>
              <span className="text-xs font-medium text-slate-700 w-10 text-right">{m.pct}%</span>
            </div>
          ))}
        </div>

        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Specializations</p>
          <div className="flex flex-wrap gap-2">
            {p.topSpecialties.map((s) => (
              <Badge key={s.topicArea} variant="outline" className="text-xs">
                {s.topicArea} ({s.reviewCount})
              </Badge>
            ))}
          </div>
        </div>

        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-xs text-green-700">
            <strong>✅ Implemented:</strong> Reviewer profiles at{" "}
            <code className="bg-green-100 px-1 rounded">lib/reputation/reviewerProfileService.ts</code> •
            API at <code className="bg-green-100 px-1 rounded">/api/reputation/reviewer/[userId]</code>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function ContributionsDemo() {
  return (
    <Card className="bg-indigo-50/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gauge className="w-5 h-5" />
          Contribution Breakdown
          <Badge className="ml-2 bg-indigo-600 text-xs">Phase 4.2</Badge>
        </CardTitle>
        <CardDescription>
          All tracked scholarly actions and their counts
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {MOCK_CONTRIBUTIONS.map((c) => {
          const maxCount = Math.max(...MOCK_CONTRIBUTIONS.map((x) => x.count));
          return (
            <div key={c.type} className="flex items-center gap-3">
              <span className="text-xs text-slate-600 w-40 shrink-0">{c.label}</span>
              <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-400 to-indigo-600 rounded-full flex items-center justify-end pr-1 transition-all"
                  style={{ width: `${(c.count / maxCount) * 100}%` }}
                >
                  <span className="text-[9px] font-bold text-white">{c.count}</span>
                </div>
              </div>
            </div>
          );
        })}

        <div className="p-3 bg-green-50 border border-green-200 rounded-lg mt-3">
          <p className="text-xs text-green-700">
            <strong>✅ Implemented:</strong> Tracking at{" "}
            <code className="bg-green-100 px-1 rounded">lib/reputation/contributionService.ts</code> •
            API at <code className="bg-green-100 px-1 rounded">/api/reputation/contributions/[userId]</code>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DEMO — 4.3 CREDIT INTEGRATION
// ─────────────────────────────────────────────────────────────────────────────

function OrcidDemo() {
  const [connected, setConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState(false);

  const handleConnect = async () => {
    toast.info("Redirecting to ORCID...", { description: "OAuth 2.0 authorization" });
    await new Promise((r) => setTimeout(r, 1500));
    setConnected(true);
    toast.success("ORCID connected!", {
      description: `Linked to ${MOCK_ORCID_CONNECTION.orcidId}`,
    });
  };

  const handleSync = async () => {
    setSyncing(true);
    toast.info("Syncing contributions to ORCID...");
    await new Promise((r) => setTimeout(r, 2000));
    setSyncing(false);
    setSynced(true);
    toast.success("Sync complete", { description: "12 works synced to ORCID" });
  };

  return (
    <Card className="bg-indigo-50/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="w-5 h-5" />
          ORCID Integration
          <Badge className="ml-2 bg-indigo-600 text-xs">Phase 4.3</Badge>
        </CardTitle>
        <CardDescription>
          Connect your ORCID to push scholarly contributions to your academic profile
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!connected ? (
          <div className="p-6 border-2 border-dashed rounded-lg text-center bg-white">
            <div className="w-12 h-12 rounded-full bg-green-100 mx-auto mb-3 flex items-center justify-center">
              <Link2 className="w-6 h-6 text-green-700" />
            </div>
            <p className="text-sm font-medium mb-1">Connect your ORCID iD</p>
            <p className="text-xs text-muted-foreground mb-3">
              Link your ORCID to attribute your Mesh contributions to your scholarly profile
            </p>
            <Button
              className="bg-green-700 hover:bg-green-800"
              onClick={handleConnect}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Connect ORCID
            </Button>
          </div>
        ) : (
          <>
            <div className="p-4 border rounded-lg bg-white">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                    <Check className="w-4 h-4 text-green-700" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">ORCID Connected</p>
                    <p className="text-xs text-green-600 font-mono">{MOCK_ORCID_CONNECTION.orcidId}</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs text-green-700 border-green-300">
                  Auto-sync ON
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-2 bg-slate-50 rounded text-center">
                  <p className="text-lg font-bold text-indigo-600">{MOCK_ORCID_CONNECTION.syncedWorkCount}</p>
                  <p className="text-[10px] text-slate-500">Works Synced</p>
                </div>
                <div className="p-2 bg-slate-50 rounded text-center">
                  <p className="text-xs text-slate-600">Last sync</p>
                  <p className="text-xs font-medium">Feb 10, 2026</p>
                </div>
              </div>
            </div>

            {!synced && (
              <Button
                className="w-full bg-indigo-600 hover:bg-indigo-700"
                disabled={syncing}
                onClick={handleSync}
              >
                {syncing ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Syncing to ORCID...
                  </div>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Sync All Contributions
                  </>
                )}
              </Button>
            )}

            {synced && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Recently Synced Works</p>
                {MOCK_SYNCED_WORKS.map((w, i) => (
                  <div key={i} className="flex items-center justify-between p-2 border rounded bg-white">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{w.title}</p>
                      <p className="text-[10px] text-slate-500">{w.syncedAt}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <Badge variant="outline" className="text-[10px]">{w.type.replace("_", " ")}</Badge>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          w.status === "SYNCED"
                            ? "text-green-700 border-green-300"
                            : "text-red-700 border-red-300"
                        }`}
                      >
                        {w.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-xs text-green-700">
            <strong>✅ Implemented:</strong> ORCID at{" "}
            <code className="bg-green-100 px-1 rounded">lib/credit/orcidService.ts</code> •
            API at <code className="bg-green-100 px-1 rounded">/api/credit/orcid/*</code>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function CvExportDemo() {
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState<string | null>(null);

  const handleExport = async (format: string) => {
    setExporting(true);
    toast.info(`Generating ${format} export...`);
    await new Promise((r) => setTimeout(r, 1200));
    setExporting(false);
    setExported(format);
    toast.success(`${format} export generated`, {
      description: "47 contributions included",
    });
  };

  return (
    <Card className="bg-indigo-50/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="w-5 h-5" />
          CV Export
          <Badge className="ml-2 bg-indigo-600 text-xs">Phase 4.3</Badge>
        </CardTitle>
        <CardDescription>
          Export your scholarly contributions in academic formats
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {MOCK_EXPORT_FORMATS.map((f) => {
            const Icon = f.icon;
            const isSelected = exported === f.label;
            return (
              <button
                key={f.id}
                disabled={exporting}
                className={`p-3 border rounded-lg text-left transition-all ${
                  isSelected
                    ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200"
                    : "bg-white hover:border-indigo-300"
                }`}
                onClick={() => handleExport(f.label)}
              >
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-indigo-600" />
                  <span className="text-sm font-medium">{f.label}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{f.description}</p>
                {isSelected && (
                  <Badge className="bg-green-600 text-xs mt-2">
                    <Check className="w-3 h-3 mr-1" />
                    Generated
                  </Badge>
                )}
              </button>
            );
          })}
        </div>

        {exported && (
          <div className="p-3 border rounded-lg bg-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">contributions.{exported === "JSON-LD" ? "jsonld" : exported.toLowerCase()}</p>
                <p className="text-xs text-slate-500">47 contributions • Generated just now</p>
              </div>
              <Button variant="outline" size="sm" className="text-xs">
                <Download className="w-3 h-3 mr-1" />
                Download
              </Button>
            </div>
          </div>
        )}

        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-xs text-green-700">
            <strong>✅ Implemented:</strong> Export at{" "}
            <code className="bg-green-100 px-1 rounded">lib/credit/cvExportService.ts</code> •
            API at <code className="bg-green-100 px-1 rounded">/api/credit/export</code>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function InstitutionalReportDemo() {
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    toast.info("Generating institutional report...");
    await new Promise((r) => setTimeout(r, 1800));
    setGenerating(false);
    setGenerated(true);
    toast.success("Report generated", {
      description: `${MOCK_REPORT_DATA.totalContributions} contributions from ${MOCK_REPORT_DATA.totalContributors} scholars`,
    });
  };

  return (
    <Card className="bg-indigo-50/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="w-5 h-5" />
          Institutional Reports
          <Badge className="ml-2 bg-indigo-600 text-xs">Phase 4.3</Badge>
        </CardTitle>
        <CardDescription>
          Aggregate reports for departments and institutions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!generated ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Faculty Contributions", desc: "Per-faculty breakdown" },
                { label: "Department Summary", desc: "Aggregate by department" },
                { label: "Institution Overview", desc: "Full institution stats" },
                { label: "Impact Report", desc: "Citation & consensus impact" },
              ].map((rt) => (
                <div key={rt.label} className="p-3 border rounded-lg bg-white">
                  <p className="text-sm font-medium">{rt.label}</p>
                  <p className="text-xs text-muted-foreground">{rt.desc}</p>
                </div>
              ))}
            </div>
            <Button
              className="w-full bg-indigo-600 hover:bg-indigo-700"
              disabled={generating}
              onClick={handleGenerate}
            >
              {generating ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating Report...
                </div>
              ) : (
                "Generate Institution Overview"
              )}
            </Button>
          </>
        ) : (
          <div className="space-y-4">
            <div className="p-3 border rounded-lg bg-white">
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Report Period</p>
              <p className="text-sm font-medium">{MOCK_REPORT_DATA.period}</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 border rounded-lg bg-white text-center">
                <p className="text-xl font-bold text-indigo-600">{MOCK_REPORT_DATA.totalContributors}</p>
                <p className="text-[10px] text-slate-500">Contributors</p>
              </div>
              <div className="p-3 border rounded-lg bg-white text-center">
                <p className="text-xl font-bold text-green-600">{MOCK_REPORT_DATA.totalContributions}</p>
                <p className="text-[10px] text-slate-500">Contributions</p>
              </div>
              <div className="p-3 border rounded-lg bg-white text-center">
                <p className="text-xl font-bold text-amber-600">{MOCK_REPORT_DATA.impactMetrics.totalCitations}</p>
                <p className="text-[10px] text-slate-500">Citations</p>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Top Contributors</p>
              {MOCK_REPORT_DATA.topContributors.map((c, i) => (
                <div key={c.name} className="flex items-center justify-between p-2 border-b last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <span className="text-sm">{c.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500">{c.count} contributions</span>
                    <Badge variant="outline" className="text-xs">{c.score}</Badge>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="p-2 bg-blue-50 rounded text-center">
                <p className="text-sm font-bold text-blue-700">{MOCK_REPORT_DATA.impactMetrics.consensusAchieved}</p>
                <p className="text-[10px] text-blue-600">Consensus</p>
              </div>
              <div className="p-2 bg-green-50 rounded text-center">
                <p className="text-sm font-bold text-green-700">{MOCK_REPORT_DATA.impactMetrics.reviewsCompleted}</p>
                <p className="text-[10px] text-green-600">Reviews</p>
              </div>
              <div className="p-2 bg-purple-50 rounded text-center">
                <p className="text-sm font-bold text-purple-700">{MOCK_REPORT_DATA.impactMetrics.totalCitations}</p>
                <p className="text-[10px] text-purple-600">Citations</p>
              </div>
            </div>

            <button
              className="text-xs text-indigo-600 hover:underline"
              onClick={() => setGenerated(false)}
            >
              Reset demo
            </button>
          </div>
        )}

        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-xs text-green-700">
            <strong>✅ Implemented:</strong> Reports at{" "}
            <code className="bg-green-100 px-1 rounded">lib/credit/institutionalReportService.ts</code> •
            API at <code className="bg-green-100 px-1 rounded">/api/credit/reports</code>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function LivingPeerReviewDemo() {
  return (
    <TooltipProvider>
      <Toaster position="top-right" richColors closeButton />
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        {/* Sticky Header */}
        <div className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-indigo-100 text-indigo-700">
                  <Scale className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">Living Peer Review Demo</h1>
                  <p className="text-sm text-muted-foreground">
                    Phase 4: Open Review, Reputation & Academic Credit
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  <Check className="w-3 h-3 mr-1" />
                  Phase 4 Complete
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
          {/* Introduction Card */}
          <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-100">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-white shadow-sm">
                  <Shield className="w-8 h-8 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-indigo-900">
                    Living Peer Review & Academic Credit
                  </h2>
                  <p className="text-indigo-700 mt-1">
                    Transform peer review from opaque gatekeeping to structured, credited discourse.
                    Public review deliberations flow through defined phases, reputation emerges from
                    argumentation outcomes, and contributions translate to recognized academic credit.
                  </p>
                  <div className="flex gap-6 mt-4">
                    <StatCard label="Sub-Phases" value="3/3" />
                    <StatCard label="Features" value="11" />
                    <StatCard label="Services" value="21" />
                    <StatCard label="API Routes" value="23" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabs */}
          <Tabs defaultValue="overview" className="w-full">
                          <TabsList className="flex w-full justify-start p-1 h-auto">
              
              <TabsTrigger value="overview" className="text-sm">Overview</TabsTrigger>
              <TabsTrigger value="peer-review" className="text-sm">Peer Review</TabsTrigger>
              <TabsTrigger value="commitments" className="text-sm">Commitments</TabsTrigger>
              <TabsTrigger value="reputation" className="text-sm">Reputation</TabsTrigger>
              <TabsTrigger value="credit" className="text-sm">Credit</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              {PHASES.map((phase) => (
                <div key={phase.id}>
                  <div className="flex items-center gap-3 mb-4">
                    <h3 className="text-lg font-semibold">{phase.title}</h3>
                    <Badge variant="outline">{phase.description}</Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {phase.features.map((feature) => (
                      <FeatureCard key={feature.id} feature={feature} />
                    ))}
                  </div>
                </div>
              ))}
            </TabsContent>

            {/* Peer Review Tab (Phase 4.1) */}
            <TabsContent value="peer-review" className="space-y-6">
              <div className="rounded-lg border bg-slate-50 p-4">
                <h3 className="font-semibold text-lg">
                  Public Peer Review Deliberations{" "}
                  <Badge variant="outline" className="ml-2">Phase 4.1</Badge>
                </h3>
                <p className="text-sm text-muted-foreground">
                  Structured reviews with templates, phase progression, reviewer assignments, and author response workflows.
                </p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ReviewSetupDemo />
                <ReviewPhaseDemo />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <AuthorResponseDemo />
                <ReviewTimelineDemo />
              </div>
            </TabsContent>

            {/* Commitments Tab (Phase 4.1 deep dive) */}
            <TabsContent value="commitments" className="space-y-6">
              <div className="rounded-lg border bg-slate-50 p-4">
                <h3 className="font-semibold text-lg">
                  Reviewer Commitments & Author Responses{" "}
                  <Badge variant="outline" className="ml-2">Phase 4.1</Badge>
                </h3>
                <p className="text-sm text-muted-foreground">
                  Reviewers take typed positions on specific aspects. Authors respond with structured dialogue moves — and commitments track to resolution.
                </p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <CommitmentsDemo />
                <AuthorResponseDemo />
              </div>
            </TabsContent>

            {/* Reputation Tab (Phase 4.2) */}
            <TabsContent value="reputation" className="space-y-6">
              <div className="rounded-lg border bg-slate-50 p-4">
                <h3 className="font-semibold text-lg">
                  Argumentation-Based Reputation{" "}
                  <Badge variant="outline" className="ml-2">Phase 4.2</Badge>
                </h3>
                <p className="text-sm text-muted-foreground">
                  Scholar profiles built from argumentation outcomes — defense rates, consensus achievement, topic expertise, and reviewer recognition.
                </p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ScholarStatsDemo />
                <ExpertiseDemo />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <LeaderboardDemo />
                <ReviewerProfileDemo />
              </div>
              <div className="grid grid-cols-1 gap-6">
                <ContributionsDemo />
              </div>
            </TabsContent>

            {/* Credit Tab (Phase 4.3) */}
            <TabsContent value="credit" className="space-y-6">
              <div className="rounded-lg border bg-slate-50 p-4">
                <h3 className="font-semibold text-lg">
                  Academic Credit Integration{" "}
                  <Badge variant="outline" className="ml-2">Phase 4.3</Badge>
                </h3>
                <p className="text-sm text-muted-foreground">
                  ORCID integration, multi-format CV export, and institutional reporting so contributions translate to recognized academic credit.
                </p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <OrcidDemo />
                <CvExportDemo />
              </div>
              <div className="grid grid-cols-1 gap-6">
                <InstitutionalReportDemo />
              </div>
            </TabsContent>
          </Tabs>

          {/* Complete Implementation Reference */}
          <Card className="bg-slate-800 text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                Phase 4 Implementation Reference
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                <div>
                  <p className="font-semibold mb-2 text-indigo-300">Phase 4.1 — Peer Review</p>
                  <ul className="space-y-1 text-slate-300 font-mono text-xs">
                    <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> lib/review/reviewService.ts</li>
                    <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> lib/review/templateService.ts</li>
                    <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> lib/review/assignmentService.ts</li>
                    <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> lib/review/commitmentService.ts</li>
                    <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> lib/review/authorResponseService.ts</li>
                    <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> lib/review/progressService.ts</li>
                    <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> /api/review/* (12 routes)</li>
                  </ul>
                </div>
                <div>
                  <p className="font-semibold mb-2 text-indigo-300">Phase 4.2 — Reputation</p>
                  <ul className="space-y-1 text-slate-300 font-mono text-xs">
                    <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> lib/reputation/contributionService.ts</li>
                    <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> lib/reputation/statsService.ts</li>
                    <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> lib/reputation/reviewerProfileService.ts</li>
                    <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> lib/reputation/expertiseService.ts</li>
                    <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> /api/reputation/* (6 routes)</li>
                  </ul>
                </div>
                <div>
                  <p className="font-semibold mb-2 text-indigo-300">Phase 4.3 — Credit</p>
                  <ul className="space-y-1 text-slate-300 font-mono text-xs">
                    <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> lib/credit/orcidService.ts</li>
                    <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> lib/credit/cvExportService.ts</li>
                    <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> lib/credit/institutionalReportService.ts</li>
                    <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> /api/credit/orcid/* (3 routes)</li>
                    <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> /api/credit/export</li>
                    <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> /api/credit/reports</li>
                  </ul>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-700">
                <p className="text-xs text-slate-400">
                  <strong className="text-slate-300">Key Integration Points:</strong>{" "}
                  Reviews use <code className="bg-slate-700 px-1 rounded">ReviewDeliberation</code> model built on Deliberations •
                  Reputation tracks via <code className="bg-slate-700 px-1 rounded">ScholarContribution</code> &amp; <code className="bg-slate-700 px-1 rounded">ScholarStats</code> •
                  ORCID syncs via <code className="bg-slate-700 px-1 rounded">OrcidConnection</code> with auto-sync •
                  CV exports in JSON-LD, BibTeX, LaTeX, CSV
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="text-center text-sm text-slate-500 pb-8">
            <p>Living Peer Review Demo • Phase 4 Complete (4.1 + 4.2 + 4.3) • Mesh Platform</p>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
