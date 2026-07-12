// components/arguments/ArgumentCardV2.tsx
"use client";
import * as React from "react";
import useSWR from "swr";
import { 
  ChevronDown, 
  ChevronRight, 
  CheckCircle2, 
  ShieldX,
  ShieldAlert,
  Shield,
  ShieldCheck,
  Target,
  AlertCircle,
  AlertTriangle,
  HelpCircle,
  Sparkles,
  PanelBottomOpen,
  StepForward,
  MessageSquare,
  Loader2,
  Link as LinkIcon,
  Swords,
  Plus,
  View,
  PlusCircle,
  Split,
  Share2,
} from "lucide-react";
import { useModalStore } from "@/lib/stores/modalStore";
import { ShareArgumentModal } from "@/components/modals/ShareArgumentModal";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { AttackMenuPro } from "./AttackMenuPro";
import { ArgumentAttackModal } from "./ArgumentAttackModal";
import CriticalQuestionsV3 from "@/components/claims/CriticalQuestionsV3";
import { SchemeSpecificCQsModal } from "./SchemeSpecificCQsModal";
import { SchemeBreakdownModal } from "./SchemeBreakdownModal";
import { DialogueStateBadge } from "@/components/dialogue/DialogueStateBadge";
import { StaleArgumentBadge } from "@/components/arguments/StaleArgumentBadge";
import { ConfidenceDisplay } from "@/components/confidence/ConfidenceDisplay";
import { DialogueActionsButton } from "@/components/dialogue/DialogueActionsButton";
import { DialogueProvenanceBadge, type DialogueMoveKind } from "@/components/aif/DialogueMoveNode";
import { DialogueMoveDetailModal } from "@/components/dialogue/DialogueMoveDetailModal";
import { OrthogonalityBadge, DecisiveBadge, CommitmentAnchorBadge } from "@/components/ludics/InsightsBadges";
import type { LudicsInsights } from "@/lib/ludics/computeInsights";
import { ClaimDetailPanel } from "@/components/claims/ClaimDetailPanel";
import { useContraryCount } from "@/components/claims/contraryBadge/useContraryCount";
import { ContraryBadge } from "@/components/claims/contraryBadge/ContraryBadge";
import { TypologyAxisStrip } from "@/components/typology/TypologyAxisStrip";
import { Button } from "@/components/ui/button";
import { GlossaryText } from "@/components/glossary/GlossaryText";
import { InlineCommitmentCount } from "@/components/aif/CommitmentBadge";
import { 
  formatSchemeDisplay, 
  shouldShowMultiSchemeUI, 
  getSchemeBadgeVariant,
  getSchemeTooltip 
} from "@/lib/utils/argument-scheme-compat";
import { SchemeAdditionDialog } from "@/components/argumentation/SchemeAdditionDialog";
import { DependencyEditor } from "@/components/argumentation/DependencyEditor";
import { ArgumentNetBuilder } from "@/components/argumentation/ArgumentNetBuilder";
import { QuickContraryDialog } from "./QuickContraryDialog";
import { 
  PermalinkCopyButton, 
  QuickCiteButton,
  ArgumentCitationBadge,
} from "@/components/citations/argument";
import { useArgumentCitations } from "@/lib/citations/argumentCitationHooks";
import { current } from "immer";

const fetcher = (url: string) => fetch(url).then(r => r.json());

// Inline share button — opens the ShareArgumentModal via the global modal store.
function ShareButtonInline({
  argumentId,
  claimText,
  confidence,
  schemeName,
}: {
  argumentId: string;
  claimText: string;
  confidence?: number | null;
  schemeName?: string | null;
}) {
  const { openModal } = useModalStore();
  return (
    <button
      onClick={() =>
        openModal(
          <ShareArgumentModal
            argumentId={argumentId}
            claimText={claimText}
            confidence={confidence}
            schemeName={schemeName}
          />
        )
      }
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-50 border border-sky-200 hover:bg-sky-100 hover:border-sky-300 transition-all cursor-pointer text-xs font-medium text-sky-700"
      title="Share this argument"
    >
      <Share2 className="w-3 h-3" />
      Share
    </button>
  );
}

type Prem = { id: string; text: string };

interface ArgumentCardV2Props {
  deliberationId: string;
  authorId: string;
  id: string;
  conclusion: { id: string; text: string };
  premises: Prem[];
  onAnyChange?: () => void;
  schemeKey?: string | null; // DEPRECATED: Use schemes array instead (Phase 4)
  schemeName?: string | null; // DEPRECATED: Use schemes array instead (Phase 4)
  schemes?: Array<{ // Phase 4: Multi-scheme support
    schemeId: string;
    schemeKey: string;
    schemeName: string;
    confidence: number;
    isPrimary: boolean;
    ruleType?: 'STRICT' | 'DEFEASIBLE'; // Phase 1b.3: ASPIC+ strict rules
    ruleName?: string | null;            // Phase 1b.3: Optional rule name for strict rules
  }>;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  currentUserId?: string;
  confidence?: number;
  dsMode?: boolean; // Dempster-Shafer mode toggle
  provenance?: {
    kind: string;
    sourceDeliberationId: string;
    sourceDeliberationName: string;
    fingerprint?: string;
  } | null;
  // Phase 3: Dialogue Visualization - Dialogue Provenance
  dialogueProvenance?: {
    moveId: string;
    moveKind: DialogueMoveKind;
    speakerName?: string;
  } | null;
  // Phase 3: Dialogue Tab Navigation
  onViewDialogueMove?: (moveId: string, deliberationId: string) => void;
  // Phase 2 Week 2: Ludics Integration
  showLudicsBadges?: boolean; // Default true
}

// ============================================================================
// DESIGN TOKENS - Visual Language for Attack Types
// ============================================================================
const ATTACK_TYPES = {
  REBUTS: {
    label: "Rebuttal",
    icon: ShieldX,
    color: "rose",
    bgClass: "bg-rose-50",
    borderClass: "border-rose-200",
    textClass: "text-rose-700",
    hoverClass: "hover:bg-rose-100",
    badgeClass: "bg-rose-100 text-rose-800 border-rose-300",
    description: "Challenges the conclusion"
  },
  UNDERCUTS: {
    label: "Undercut",
    icon: ShieldAlert,
    color: "amber",
    bgClass: "bg-amber-50",
    borderClass: "border-amber-200",
    textClass: "text-amber-700",
    hoverClass: "hover:bg-amber-100",
    badgeClass: "bg-amber-100 text-amber-800 border-amber-300",
    description: "Challenges the inference"
  },
  UNDERMINES: {
    label: "Undermine",
    icon: Shield,
    color: "slate",
    bgClass: "bg-slate-50",
    borderClass: "border-slate-200",
    textClass: "text-slate-700",
    hoverClass: "hover:bg-slate-100",
    badgeClass: "bg-slate-100 text-slate-800 border-slate-300",
    description: "Challenges a premise"
  }
} as const;

const DIALOGUE_STATE = {
  answered: {
    label: "Answered",
    icon: CheckCircle2,
    bgClass: "bg-emerald-50",
    borderClass: "border-emerald-200",
    textClass: "text-emerald-700",
    badgeClass: "bg-emerald-600 text-white"
  },
  challenged: {
    label: "Challenged",
    icon: AlertCircle,
    bgClass: "bg-amber-50",
    borderClass: "border-amber-200",
    textClass: "text-amber-700",
    badgeClass: "bg-amber-600 text-white"
  },
  neutral: {
    label: "Active",
    icon: MessageSquare,
    bgClass: "bg-slate-50",
    borderClass: "border-slate-200",
    textClass: "text-slate-600",
    badgeClass: "bg-slate-500 text-white"
  }
} as const;

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function AttackBadge({ 
  type, 
  count, 
  dialogueState 
}: { 
  type: keyof typeof ATTACK_TYPES; 
  count: number;
  dialogueState?: "answered" | "challenged" | "neutral";
}) {
  const attack = ATTACK_TYPES[type];
  const Icon = attack.icon;
  const state = dialogueState ? DIALOGUE_STATE[dialogueState] : null;

  return (
    <div 
      className={`
        inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border
        ${attack.bgClass} ${attack.borderClass} ${attack.textClass}
        text-xs font-medium transition-all duration-200
      `}
      title={`${attack.description} (${count})`}
    >
      <Icon className="w-3.5 h-3.5" />
      <span>{count}</span>
      {state && (
        <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${state.badgeClass}`}>
          {state.label === "Answered" ? "✓" : state.label === "Challenged" ? "!" : "◉"}
        </span>
      )}
    </div>
  );
}

function CQStatusPill({ 
  required, 
  satisfied, 
  type = "claim",
  onClick 
}: { 
  required: number; 
  satisfied: number;
  type?: "claim" | "argument";
  onClick?: () => void;
}) {
  const hasData = required > 0;
  const percentage = hasData ? Math.round((satisfied / required) * 100) : 0;
  const isComplete = hasData && percentage === 100;
  const colorClass = !hasData
    ? "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
    : isComplete
    ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
    : "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100";

  return (
    <button
      onClick={onClick}
      className={`
        inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border
        ${colorClass}
        text-xs font-medium transition-all duration-200
      `}
      title={hasData ? `${satisfied}/${required} critical questions satisfied` : "View critical questions"}
    >
      {!hasData ? (
        <HelpCircle className="w-3 h-3" />
      ) : isComplete ? (
        <CheckCircle2 className="w-3 h-3" />
      ) : (
        <AlertCircle className="w-3 h-3" />
      )}
      <span>
        {type === "claim" ? "Claim" : "Arg"} CQ{hasData ? ` ${percentage}%` : ""}
      </span>
    </button>
  );
}

function SectionHeader({ 
  title, 
  icon: Icon, 
  count, 
  expanded, 
  onToggle,
  badge 
}: { 
  title: string; 
  icon: React.ElementType; 
  count?: number;
  expanded: boolean; 
  onToggle: () => void;
  badge?: React.ReactNode;
}) {
  return (
    <button
      onClick={onToggle}
      className="
        w-full flex items-center justify-between px-4 py-2.5
        bg-slate-50 hover:bg-slate-100 border-b border-slate-200
        transition-colors duration-200
      "
    >
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-slate-600" />
        <span className="text-sm font-semibold text-slate-800">{title}</span>
        {count !== undefined && (
          <span className="text-xs font-medium text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">
            {count}
          </span>
        )}
        {badge}
      </div>
      {expanded ? (
        <ChevronDown className="w-4 h-4 text-slate-500" />
      ) : (
        <ChevronRight className="w-4 h-4 text-slate-500" />
      )}
    </button>
  );
}

function AttackItem({ attack, deliberationId, authorId, currentUserId, onAnyChange }: { attack: any; deliberationId: string; authorId: string; currentUserId?: string; onAnyChange?: () => void }) {
  const attackType = ATTACK_TYPES[attack.attackType as keyof typeof ATTACK_TYPES];
  const Icon = attackType?.icon || Shield;
  
  // Determine dialogue state based on WHY/GROUNDS counts
  let dialogueState: "answered" | "challenged" | "neutral" = "neutral";
  if (attack.groundsCount > 0) {
    dialogueState = "answered";
  } else if (attack.whyCount > 0) {
    dialogueState = "challenged";
  }

  const state = DIALOGUE_STATE[dialogueState];
  const StateIcon = state.icon;
  
  // Phase 8: ASPIC+ attack type styling
  const getAspicStyle = (aspicType: string | undefined) => {
    if (!aspicType) return null;
    
    switch (aspicType.toLowerCase()) {
      case 'rebutting':
        return { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300', label: 'REBUTS' };
      case 'undercutting':
        return { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300', label: 'UNDERCUTS' };
      case 'undermining':
        return { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300', label: 'UNDERMINES' };
      default:
        return null;
    }
  };
  
  const aspicStyle = getAspicStyle(attack.aspicAttackType);

  return (
    <div 
      className="flex flex-col gap-2 p-3 rounded-lg bg-white border border-slate-200 hover:border-slate-300 transition-colors"
    >
      <div className="flex items-start gap-2">
        <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${attackType?.textClass || "text-slate-600"}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-xs font-semibold ${attackType?.textClass || "text-slate-700"}`}>
              {attackType?.label || attack.attackType}
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              {attack.id.slice(-6)}
            </span>
            {/* Phase 8: ASPIC+ Attack Type Badge */}
            {aspicStyle && (
              <span 
                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide ${aspicStyle.bg} ${aspicStyle.text} border ${aspicStyle.border}`}
                title={`ASPIC+ Classification: ${attack.aspicAttackType}`}
              >
                ⚔️ {aspicStyle.label}
              </span>
            )}
            {/* Dialogue State Badge */}
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold ${state.badgeClass}`}>
              <StateIcon className="w-3 h-3" />
              {state.label}
            </span>
          </div>
          {/* Display claim text if available */}
          {attack.claimText && (
            <div className="text-sm text-slate-700 leading-relaxed">
              <GlossaryText text={attack.claimText} />
            </div>
          )}
          
          {/* Collapsible Claim Details */}
          {attack.fromClaimId && (
            <ClaimDetailPanel 
              claimId={attack.fromClaimId}
              deliberationId={deliberationId}
              claimText={attack.claimText || ""}
              createdById={authorId}
              claimAuthorId={authorId}
              currentUserId={currentUserId}
              className="mt-2"
            />
          )}
          
          {(attack.whyCount > 0 || attack.groundsCount > 0) && (
            <div className="flex items-center gap-2 mt-1.5">
              {attack.whyCount > 0 && (
                <span className="text-[10px] font-medium text-slate-600 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                  {attack.whyCount} WHY
                </span>
              )}
              {attack.groundsCount > 0 && (
                <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                  {attack.groundsCount} GROUNDS
                </span>
              )}
            </div>
          )}
        </div>
        {/* Dialogue Actions for Attack Claim */}
        {attack.fromClaimId && (
          <DialogueActionsButton
            deliberationId={deliberationId}
            targetType="claim"
            targetId={attack.fromClaimId}
            locusPath="0"
            variant="icon"
            onMovePerformed={onAnyChange}
          />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ArgumentCardV2({
  deliberationId,
  authorId,
  id,
  conclusion,
  premises,
  onAnyChange,
  currentUserId,
  schemeKey,
  schemeName,
  schemes: propsSchemes = [],
  createdAt,
  updatedAt,
  confidence,
  dsMode = false,
  provenance,
  dialogueProvenance,
  onViewDialogueMove,
  showLudicsBadges = true
}: ArgumentCardV2Props) {
  const [expandedSections, setExpandedSections] = React.useState({
    premises: false,
    inference: false,
    assumptions: false,
    attacks: false,
  });
  const [loading, setLoading] = React.useState(false);
  const [attacks, setAttacks] = React.useState<any[]>([]);
  const [attackCount, setAttackCount] = React.useState<number>(0); // Track count separately
  const [cqDialogOpen, setCqDialogOpen] = React.useState(false);
  const [argCqDialogOpen, setArgCqDialogOpen] = React.useState(false);
  const [schemeDialogOpen, setSchemeDialogOpen] = React.useState(false);
  const [citations, setCitations] = React.useState<any[]>([]);
  const [loadingCitations, setLoadingCitations] = React.useState(false);
  const [showAttackModal, setShowAttackModal] = React.useState(false); // Phase F: Attack creation modal
  const [showSchemeAdditionDialog, setShowSchemeAdditionDialog] = React.useState(false); // Phase 2: Multi-scheme support
  const [showDependencyEditor, setShowDependencyEditor] = React.useState(false); // Phase 2 Feature #2: Dependency editor
  const [showNetBuilder, setShowNetBuilder] = React.useState(false); // Phase 4 Feature #4: Net builder
  const [showContraryDialog, setShowContraryDialog] = React.useState(false); // Phase 1d.2: Quick contrary dialog
  
  // Phase 1d.1 (refactored): contrary fetch is centralized in useContraryCount.
  // Phase 3: Dialogue Move Detail Modal
  const [dialogueMoveModalOpen, setDialogueMoveModalOpen] = React.useState(false);
  const [selectedDialogueMoveId, setSelectedDialogueMoveId] = React.useState<string | null>(null);

  // Phase 2 Week 2: Fetch Ludics insights for this deliberation
  const { data: ludicsInsights } = useSWR<LudicsInsights>(
    showLudicsBadges ? `/api/ludics/insights?deliberationId=${deliberationId}` : null,
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false }
  );

  // Phase 4: Fetch multi-scheme data if not provided via props
  // Always fetch if we don't have scheme data, even when schemeName is provided (legacy support)
  const shouldFetchSchemes = (!propsSchemes || propsSchemes.length === 0) && id;
  const { data: schemesData, mutate: mutateSchemes } = useSWR(
    shouldFetchSchemes ? `/api/arguments/${id}/schemes` : null,
    fetcher
  );

  // Use schemes from props or fetched data
  const schemes = React.useMemo(() => {
    // Prioritize fetched data if available and non-empty
    if (schemesData?.schemes && schemesData.schemes.length > 0) {
      return schemesData.schemes;
    }
    // Fall back to props schemes if available and non-empty
    if (propsSchemes && propsSchemes.length > 0) {
      return propsSchemes;
    }
    // Default to empty array
    return [];
  }, [propsSchemes, schemesData?.schemes]);
  
  // Debug logging
  React.useEffect(() => {
    if (id) {
      console.log('[ArgumentCardV2] Scheme data:', {
        argumentId: id,
        propsSchemes,
        schemesData,
        schemes,
        schemeKey,
        schemeName
      });
    }
  }, [id, propsSchemes, schemesData, schemes, schemeKey, schemeName]);

  // Fetch CQ data for the conclusion claim (claim-level CQs)
  const { data: cqData } = useSWR(
    conclusion?.id ? `/api/cqs?targetType=claim&targetId=${conclusion.id}` : null,
    fetcher
  );

  // Fetch CQ data for the argument itself (argument-level CQs)
  const { data: argCqData } = useSWR(
    id ? `/api/cqs?targetType=argument&targetId=${id}` : null,
    fetcher
  );

  // Argument-level scheme CQs (relational shape) for the SchemeSpecificCQsModal.
  // Returns `{ items: CQItem[], authorId }` — the items are correctly shaped
  // (cqKey/text/status/attackType/targetScope/premiseType) and `authorId` is the
  // argument's real author for role detection.
  const { data: schemeCqData, mutate: mutateSchemeCqs } = useSWR(
    id && argCqDialogOpen ? `/api/arguments/${id}/cqs` : null,
    fetcher
  );

  // Phase 3 Quick Win: Fetch AssumptionUse records
  const { data: assumptionsData } = useSWR(
    id ? `/api/arguments/${id}/assumption-uses` : null,
    fetcher
  );

  // Fetch implicit warrant data
  const { data: warrantData } = useSWR(
    id ? `/api/arguments/${id}/assumptions` : null,
    fetcher
  );

  // Fetch commitment data for this deliberation to show inline badges
  const { data: commitmentData } = useSWR(
    deliberationId ? `/api/aif/dialogue/${deliberationId}/commitments` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      refreshInterval: 60000, // Refresh every minute
    }
  );

  // Phase 3.3: Fetch argument citations data
  const { data: argCitationsData, isLoading: citationsLoading } = useArgumentCitations(id);
  const argCitationCount = React.useMemo(() => {
    if (!argCitationsData) return { made: 0, received: 0, total: 0 };
    const made = argCitationsData.citationsMade?.length || 0;
    const received = argCitationsData.citationsReceived?.length || 0;
    return { made, received, total: made + received };
  }, [argCitationsData]);

  // Build map of claim ID -> commitment count
  const commitmentCounts = React.useMemo(() => {
    if (!commitmentData || !Array.isArray(commitmentData)) return new Map<string, { total: number; active: number }>();
    
    const counts = new Map<string, { total: number; active: number }>();
    
    for (const store of commitmentData) {
      for (const commitment of store.commitments || []) {
        const current = counts.get(commitment.claimId) || { total: 0, active: 0 };
        counts.set(commitment.claimId, {
          total: current.total + 1,
          active: commitment.isActive ? current.active + 1 : current.active,
        });
      }
    }
    
    return counts;
  }, [commitmentData]);

  // Compute CQ status for claim
  const cqStatus = React.useMemo(() => {
    if (!cqData) return null;
    const schemes = cqData.schemes || [];
    if (schemes.length === 0) return null;
    
    let required = 0;
    let satisfied = 0;
    schemes.forEach((scheme: any) => {
      const cqs = scheme.cqs || [];
      required += cqs.length;
      satisfied += cqs.filter((cq: any) => cq.satisfied).length;
    });
    
    if (required === 0) return null;
    return { required, satisfied };
  }, [cqData]);

  // Compute CQ status for argument
  const argCqStatus = React.useMemo(() => {
    if (!argCqData) return null;
    const schemes = argCqData.schemes || [];
    if (schemes.length === 0) return null;
    
    let required = 0;
    let satisfied = 0;
    schemes.forEach((scheme: any) => {
      const cqs = scheme.cqs || [];
      required += cqs.length;
      satisfied += cqs.filter((cq: any) => cq.satisfied).length;
    });
    
    if (required === 0) return null;
    return { required, satisfied };
  }, [argCqData]);

  // Fetch citations for the argument
  React.useEffect(() => {
    let cancel = false;
    (async () => {
      setLoadingCitations(true);
      try {
        const r = await fetch(`/api/arguments/${encodeURIComponent(id)}/citations`, { cache: "no-store" });
        const j = await r.json().catch(() => ({}));
        if (!cancel && j?.ok && j?.citations) {
          setCitations(j.citations);
        }
      } catch {
        // Silent fail - citations not critical
      } finally {
        if (!cancel) setLoadingCitations(false);
      }
    })();
    return () => { cancel = true; };
  }, [id]);

  // Phase 1d.1: Centralized contrary fetch + live updates via useContraryCount.
  const {
    items: contraries,
    count: contraryCount,
  } = useContraryCount({
    deliberationId,
    claimId: conclusion?.id ?? null,
  });
  const hasContraries = contraryCount > 0;

  // Listen for citation changes
  React.useEffect(() => {
    const handler = (e: any) => {
      if (e.detail?.targetType === "argument" && e.detail?.targetId === id) {
        // Refetch citations
        (async () => {
          try {
            const r = await fetch(`/api/arguments/${encodeURIComponent(id)}/citations`, { cache: "no-store" });
            const j = await r.json().catch(() => ({}));
            if (j?.ok && j?.citations) {
              setCitations(j.citations);
            }
          } catch {
            // Silent fail
          }
        })();
      }
    };
    window.addEventListener("citations:changed", handler);
    return () => window.removeEventListener("citations:changed", handler);
  }, [id]);

  // Fetch attack count (always, not just when expanded)
  React.useEffect(() => {
    const fetchAttackCount = async () => {
      try {
        const [edgesRes, caRes] = await Promise.all([
          fetch(`/api/arguments/${id}/attacks`, { cache: "no-store" }),
          fetch(`/api/ca?targetArgumentId=${id}`, { cache: "no-store" })
        ]);

        const edgesData = edgesRes.ok ? await edgesRes.json() : { items: [] };
        const caData = caRes.ok ? await caRes.json() : { items: [] };

        const edgeCount = (edgesData.items || []).length;
        const caCount = (caData.items || []).filter((ca: any) => 
          ca.conflictedArgumentId === id && ca.legacyAttackType
        ).length;

        setAttackCount(edgeCount + caCount);
      } catch (err) {
        console.error("Failed to fetch attack count:", err);
      }
    };

    fetchAttackCount();
  }, [id]);

  // Listen for changes that should trigger attack count refresh
  React.useEffect(() => {
    const handler = () => {
      // Re-trigger attack count fetch
      (async () => {
        try {
          const [edgesRes, caRes] = await Promise.all([
            fetch(`/api/arguments/${id}/attacks`, { cache: "no-store" }),
            fetch(`/api/ca?targetArgumentId=${id}`, { cache: "no-store" })
          ]);

          const edgesData = edgesRes.ok ? await edgesRes.json() : { items: [] };
          const caData = caRes.ok ? await caRes.json() : { items: [] };

          const edgeCount = (edgesData.items || []).length;
          const caCount = (caData.items || []).filter((ca: any) => 
            ca.conflictedArgumentId === id && ca.legacyAttackType
          ).length;

          setAttackCount(edgeCount + caCount);
        } catch (err) {
          console.error("Failed to refresh attack count:", err);
        }
      })();
    };
    
    window.addEventListener("claims:changed", handler);
    window.addEventListener("arguments:changed", handler);
    window.addEventListener("dialogue:moves:refresh", handler);
    
    return () => {
      window.removeEventListener("claims:changed", handler);
      window.removeEventListener("arguments:changed", handler);
      window.removeEventListener("dialogue:moves:refresh", handler);
    };
  }, [id]);

  // Fetch attacks when attacks section is expanded
  React.useEffect(() => {
    if (!expandedSections.attacks) return;
    
    const fetchAttacks = async () => {
      setLoading(true);
      try {
        const [edgesRes, caRes] = await Promise.all([
          fetch(`/api/arguments/${id}/attacks`, { cache: "no-store" }),
          fetch(`/api/ca?targetArgumentId=${id}`, { cache: "no-store" })
        ]);

        const edgesData = edgesRes.ok ? await edgesRes.json() : { items: [] };
        const caData = caRes.ok ? await caRes.json() : { items: [] };

        const edgeAttacks = (edgesData.items || []).map((edge: any) => ({
          id: edge.id,
          attackType: edge.attackType,
          targetScope: edge.targetScope,
          fromArgumentId: edge.fromArgumentId,
          whyCount: edge.whyCount || 0,
          groundsCount: edge.groundsCount || 0,
          dialogueStatus: edge.dialogueStatus || "neutral",
          source: "edge"
        }));

        const filteredCAs = (caData.items || [])
          .filter((ca: any) => ca.conflictedArgumentId === id && ca.legacyAttackType);

        // Fetch claim text for CA attacks
        const caAttacksWithText = await Promise.all(
          filteredCAs.map(async (ca: any) => {
            let claimText = null;
            if (ca.conflictingClaimId) {
              try {
                const claimRes = await fetch(`/api/claims/${ca.conflictingClaimId}`, { cache: "no-store" });
                if (claimRes.ok) {
                  const claimData = await claimRes.json();
                  claimText = claimData.claim?.text || claimData.text || null;
                }
              } catch (err) {
                console.error("Failed to fetch claim text:", err);
              }
            }

            return {
              id: ca.id,
              attackType: ca.legacyAttackType,
              targetScope: ca.legacyTargetScope,
              fromArgumentId: ca.conflictingArgumentId,
              fromClaimId: ca.conflictingClaimId,
              claimText, // Add claim text
              aspicAttackType: ca.aspicAttackType,
              whyCount: 0,
              groundsCount: 0,
              dialogueStatus: "neutral",
              source: "ca"
            };
          })
        );

        setAttacks([...edgeAttacks, ...caAttacksWithText]);
      } catch (err) {
        console.error("Failed to fetch attacks:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAttacks();
  }, [expandedSections.attacks, id]);

  // Listen for changes that should trigger attack refresh
  React.useEffect(() => {
    const handler = () => {
      if (expandedSections.attacks) {
        // Re-trigger attack fetch when claims or arguments change
        setExpandedSections(prev => ({ ...prev, attacks: false }));
        setTimeout(() => setExpandedSections(prev => ({ ...prev, attacks: true })), 100);
      }
    };
    
    window.addEventListener("claims:changed", handler);
    window.addEventListener("arguments:changed", handler);
    window.addEventListener("dialogue:moves:refresh", handler);
    
    return () => {
      window.removeEventListener("claims:changed", handler);
      window.removeEventListener("arguments:changed", handler);
      window.removeEventListener("dialogue:moves:refresh", handler);
    };
  }, [expandedSections.attacks]);

  const handleRefresh = React.useCallback(() => {
    if (expandedSections.attacks) {
      // Re-trigger attack fetch
      setExpandedSections(prev => ({ ...prev, attacks: false }));
      setTimeout(() => setExpandedSections(prev => ({ ...prev, attacks: true })), 0);
    }
    onAnyChange?.();
  }, [expandedSections.attacks, onAnyChange]);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Group attacks by type
  const rebutAttacks = attacks.filter(a => a.attackType === "REBUTS");
  const undercutAttacks = attacks.filter(a => a.attackType === "UNDERCUTS");
  const undermineAttacks = attacks.filter(a => a.attackType === "UNDERMINES");
  const totalAttacks = attacks.length;

  // Phase 1d.1: Compute contrary display data
  const contraryClaimTexts = contraries.map((c) => c.otherText);

  return (
    <TooltipProvider>
      <div 
        className="argument-card-v2 border-2 border-slate-300 rounded-xl bg-white shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
        data-has-contraries={hasContraries}
        data-contrary-count={contraryCount}
        data-contrary-ids={JSON.stringify(contraries.map((c) => c.otherId))}
      >
      {/* Header - Always Visible */}
      <div className="px-4 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2 mb-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-slate-900 leading-snug inline-flex items-center gap-2 flex-wrap">
                  <span>{conclusion.text}</span>
                  {commitmentCounts.get(conclusion.id) && (
                    <InlineCommitmentCount 
                      count={commitmentCounts.get(conclusion.id)!.total}
                      isActive={commitmentCounts.get(conclusion.id)!.active > 0}
                      className="ml-1"
                    />
                  )}
                </h3>
                
                {/* Collapsible Claim Details */}
                <ClaimDetailPanel 
                  claimId={conclusion.id}
                  deliberationId={deliberationId}
                  claimText={conclusion.text}
                  createdById={authorId}
                  claimAuthorId={authorId}
                  className="mt-2"
                />

                {/* B3.6: Tagged disagreement axis pills (argument-level) */}
                <TypologyAxisStrip
                  deliberationId={deliberationId}
                  targetType="ARGUMENT"
                  targetId={id}
                  className="mt-2"
                />
              </div>
            </div>
            
            {/* Badges Row */}
            <div className="flex items-center gap-2 flex-wrap ml-7">
              {/* Phase 3: Dialogue Provenance Badge */}
              {dialogueProvenance && (
                <DialogueProvenanceBadge
                  moveId={dialogueProvenance.moveId}
                  moveKind={dialogueProvenance.moveKind}
                  speakerName={dialogueProvenance.speakerName}
                  onClick={() => {
                    setSelectedDialogueMoveId(dialogueProvenance.moveId);
                    setDialogueMoveModalOpen(true);
                  }}
                />
              )}
              
              {/* Phase 5A: Provenance Badge for Imported Arguments */}
              {provenance && (
                <a
                  href={`/room/${provenance.sourceDeliberationId}?highlightArg=${provenance.fingerprint?.split(":")[1] || ""}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-medium hover:bg-amber-100 hover:border-amber-300 transition-colors cursor-pointer"
                  title={`View source argument in "${provenance.sourceDeliberationName}" (fingerprint: ${provenance.fingerprint?.slice(0, 8)}...)`}
                  onClick={(e) => e.stopPropagation()}
                >
                  📥 From {provenance.sourceDeliberationName}
                </a>
              )}
              
              {/* Phase 3: Dialogue State Badge */}
              <DialogueStateBadge 
                deliberationId={deliberationId}
                argumentId={id}
              />
              
              {/* Phase 3: Temporal Decay Badge */}
              {updatedAt && (
                <StaleArgumentBadge 
                  lastUpdatedAt={updatedAt}
                />
              )}
              
              {/* Phase 3: DS Mode Confidence Display */}
              {confidence !== undefined && (
                <ConfidenceDisplay 
                  value={confidence}
                  dsMode={dsMode}
                  showLabel={false}
                  className="text-xs"
                />
              )}
              
              {/* Scheme badge - clickable to open modal */}
              {(schemeName || schemes.length > 0) && (
                <button
                  onClick={() => setSchemeDialogOpen(true)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300 transition-all cursor-pointer"
                  title={getSchemeTooltip({ schemeName, schemes } as any)}
                >
                  <span className="text-xs font-medium text-indigo-700">
                    {/* Week 5: Simple scheme display logic */}
                    {schemes.length > 0 
                      ? (schemes.length === 1 
                          ? schemes[0].schemeName 
                          : `${schemes[0].schemeName} + ${schemes.length - 1} more`)
                      : (schemeName || "No scheme")}
                  </span>
                  {shouldShowMultiSchemeUI({ schemeName, schemes } as any) && (
                    <span className="inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-indigo-600 rounded-full">
                      {schemes.length}
                    </span>
                  )}
                </button>
              )}
              
              {cqStatus && (
                <CQStatusPill 
                  required={cqStatus.required} 
                  satisfied={cqStatus.satisfied}
                  type="claim"
                  onClick={() => setCqDialogOpen(true)}
                />
              )}
              
              {/* Dialogue Actions for Conclusion Claim */}
              <DialogueActionsButton
                deliberationId={deliberationId}
                targetType="claim"
                targetId={conclusion.id}
                locusPath="0"
                variant="compact"
                label="Dialogue"
                onMovePerformed={onAnyChange}
              />
              
              {/* ASPIC+ Attack Button - Unified attack creation at argument level */}
              <button
                onClick={() => setShowAttackModal(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300 transition-all cursor-pointer text-xs font-medium text-indigo-700"
                title="Create ASPIC+ attack (Rebut, Undermine, or Undercut)"
              >
                <Swords className="w-3 h-3" />
                Attack
              </button>
              
              {/* Phase 1d.2: Mark as Contrary Button */}
              <button
                onClick={() => setShowContraryDialog(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 hover:bg-rose-100 hover:border-rose-300 transition-all cursor-pointer text-xs font-medium text-rose-700"
                title="Mark this claim as contrary to another claim"
              >
                <Split className="w-3 h-3" />
                Mark Contrary
              </button>
              
              {/* Phase 3.3: Argument Citation Actions */}
              {/* Phase 2: Share Argument */}
              <ShareButtonInline
                argumentId={id}
                claimText={conclusion.text}
                confidence={confidence}
                schemeName={schemes?.[0]?.schemeName ?? schemeName ?? null}
              />

              <PermalinkCopyButton
                argumentId={id}
                variant="ghost"
                size="sm"
                showFormats={true}
              />
              
              <QuickCiteButton
                citingArgumentId={id}
                citingArgumentText={conclusion.text}
              />
              
              {argCqStatus && (
                <CQStatusPill 
                  required={argCqStatus.required} 
                  satisfied={argCqStatus.satisfied}
                  type="argument"
                  onClick={() => setArgCqDialogOpen(true)}
                />
              )}

              {/* Source Citations Badge */}
              {citations.length > 0 && (
                <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium">
                  <LinkIcon className="w-3 h-3" />
                  <span>{citations.length}</span>
                </div>
              )}
              
              {/* Phase 3.3: Argument Citations Badge */}
              {argCitationCount.total > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium cursor-help">
                      <span>📖</span>
                      <span>{argCitationCount.total}</span>
                      <span className="text-blue-500 text-[10px]">
                        ({argCitationCount.received}↓ {argCitationCount.made}↑)
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">
                      <strong>{argCitationCount.received}</strong> citations received • <strong>{argCitationCount.made}</strong> citations made
                    </p>
                  </TooltipContent>
                </Tooltip>
              )}

              {/* Phase 1d.1: Contraries Badge */}
              {hasContraries && (
                <ContraryBadge
                  deliberationId={deliberationId}
                  claimId={conclusion?.id ?? null}
                  claimText={conclusion?.text}
                />
              )}

              {/* Phase 2 Week 2: Ludics Badges */}
              {showLudicsBadges && ludicsInsights && (
                <>
                  {/* Orthogonality Status Badge */}
                  <OrthogonalityBadge
                    status={ludicsInsights.hasOrthogonality ? "orthogonal" : "non-orthogonal"}
                    size="sm"
                  />

                  {/* Decisive Steps Badge */}
                  {ludicsInsights.daimonCount > 0 && (
                    <DecisiveBadge
                      count={ludicsInsights.daimonCount}
                      size="sm"
                    />
                  )}
                  
                  {/* Commitment Anchor Badge - show if argument has commitments */}
                  {ludicsInsights.totalActs && ludicsInsights.totalActs > 0 && (
                    <CommitmentAnchorBadge 
                      count={ludicsInsights.totalActs}
                      size="sm"
                    />
                  )}
                </>
              )}

              {/* Attack badges - show simple count when collapsed, detailed when expanded */}
              {attackCount > 0 && !expandedSections.attacks && (
                <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
                  <Shield className="w-3 h-3" />
                  <span>{attackCount} {attackCount === 1 ? "Challenge" : "Challenges"}</span>
                </div>
              )}
              {totalAttacks > 0 && expandedSections.attacks && (
                <>
                  {rebutAttacks.length > 0 && (
                    <AttackBadge 
                      type="REBUTS" 
                      count={rebutAttacks.length}
                      dialogueState={rebutAttacks[0]?.dialogueStatus}
                    />
                  )}
                  {undercutAttacks.length > 0 && (
                    <AttackBadge 
                      type="UNDERCUTS" 
                      count={undercutAttacks.length}
                      dialogueState={undercutAttacks[0]?.dialogueStatus}
                    />
                  )}
                  {undermineAttacks.length > 0 && (
                    <AttackBadge 
                      type="UNDERMINES" 
                      count={undermineAttacks.length}
                      dialogueState={undermineAttacks[0]?.dialogueStatus}
                    />
                  )}
                </>
              )}
            </div>
          </div>

          {/* Quick Action Button
          <div className="shrink-0">
            <AttackMenuPro
              deliberationId={deliberationId}
              authorId={authorId}
              target={{ id, conclusion, premises }}
              onDone={handleRefresh}
            />
          </div> */}
        </div>
      </div>

      {/* Collapsible Sections */}
      <div className="divide-y divide-slate-200">
        {/* PREMISES SECTION */}
        <div>
          <SectionHeader
            title="Premises"
            icon={Target}
            count={premises.length}
            expanded={expandedSections.premises}
            onToggle={() => toggleSection("premises")}
            badge={undermineAttacks.length > 0 ? (
              <AttackBadge 
                type="UNDERMINES" 
                count={undermineAttacks.length}
                dialogueState={undermineAttacks[0]?.dialogueStatus}
              />
            ) : undefined}
          />
          {expandedSections.premises && (
            <div className="p-4 space-y-2 bg-slate-50/50">
              {premises.length > 0 ? (
                premises.map((p, idx) => (
                  <div 
                    key={p.id}
                    className="flex flex-col gap-2 p-3 rounded-lg bg-white border border-slate-200 hover:border-slate-300 transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-600 text-xs font-bold shrink-0">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-700 leading-relaxed inline-flex items-center gap-2 flex-wrap">
                          <span>{p.text}</span>
                          {commitmentCounts.get(p.id) && (
                            <InlineCommitmentCount 
                              count={commitmentCounts.get(p.id)!.total}
                              isActive={commitmentCounts.get(p.id)!.active > 0}
                            />
                          )}
                        </p>
                        
                        {/* Collapsible Claim Details */}
                        <ClaimDetailPanel 
                          claimId={p.id}
                          deliberationId={deliberationId}
                          claimText={p.text}
                          createdById={authorId}
                          claimAuthorId={authorId}
                          className="mt-2"
                        />
                      </div>
                      {/* Dialogue Actions for Premise Claim */}
                      <DialogueActionsButton
                        deliberationId={deliberationId}
                        targetType="claim"
                        targetId={p.id}
                        locusPath="0"
                        variant="icon"
                        onMovePerformed={onAnyChange}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-800 leading-relaxed">
                    <strong>No premises found.</strong> This argument may be a bare assertion.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* INFERENCE SECTION */}
        <div>
          <SectionHeader
            title="Inference"
            icon={StepForward}
            expanded={expandedSections.inference}
            onToggle={() => toggleSection("inference")}
            badge={undercutAttacks.length > 0 ? (
              <AttackBadge 
                type="UNDERCUTS" 
                count={undercutAttacks.length}
                dialogueState={undercutAttacks[0]?.dialogueStatus}
              />
            ) : undefined}
          />
          {expandedSections.inference && (
            <div className="p-2 bg-indigo-50/50">
              <div className="px-5 py-3 rounded-lg bg-white border border-indigo-200">
                <p className="text-sm text-indigo-900 leading-relaxed">
                  The reasoning that connects the premises to the conclusion.
                </p>
                
                {/* Phase 4: Multi-scheme display */}
                {schemes.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="text-sm items-center font-medium text-indigo-700">
                          Argumentation Scheme{schemes.length > 1 ? "s" : ""}:
                        </div>
                        <Button
                          variant="ghost"
                          onClick={() => setSchemeDialogOpen(true)}
                          className="flex items-center text-indigo-600 hover:text-indigo-800  "
                        >
                           <View className="h-3 w-3" />
                          View scheme details 
                        </Button>
                      </div>
                      <Button
                      variant="ghost"
                        onClick={() => setShowSchemeAdditionDialog(true)}
                        className="flex items-center gap-1  text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-md border border-indigo-200 transition-colors"
                        title="Add supporting scheme"
                      >
                        
                        <PlusCircle className="h-3 w-3" />
                        Add Scheme
                      </Button>
                      {schemes.length >= 2 && (
                        <>
                          <Button
                            variant="ghost"
                            onClick={() => setShowDependencyEditor(true)}
                            className="flex items-center gap-1 text-xs font-medium text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded-md border border-purple-200 transition-colors"
                            title="Edit scheme dependencies"
                          >
                            <LinkIcon className="h-3 w-3" />
                            Edit Dependencies
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => setShowNetBuilder(true)}
                            className="flex items-center gap-1 text-xs font-medium text-sky-600 hover:text-sky-800 hover:bg-sky-50 rounded-md border border-sky-200 transition-colors"
                            title="Build explicit scheme net"
                          >
                            <StepForward className="h-3 w-3" />
                            Build Net
                          </Button>
                        </>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-indigo-200">
                      {schemes.map((scheme: any) => (
                        <button
                          key={scheme.schemeId}
                          onClick={() => setSchemeDialogOpen(true)}
                          className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border transition-all  ${
                            scheme.isPrimary
                              ? "bg-indigo-100 border-indigo-300 text-indigo-800 hover:bg-indigo-200"
                              : "bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200"
                          }`}
                          title={scheme.isPrimary ? "Primary scheme - click for details" : "Click for details"}
                        >
                          <span className="font-semibold">{scheme.schemeName}</span>
                          {/* Phase 1b.3: Strict rule badge */}
                          {scheme.ruleType === 'STRICT' && (
                            <span 
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-sky-100 border border-sky-300 text-sky-700 text-[10px] font-bold"
                              title={`Strict rule${scheme.ruleName ? `: ${scheme.ruleName}` : ''} - Conclusion is logically guaranteed and cannot be rebutted`}
                            >
                              <ShieldCheck className="h-2.5 w-2.5" />
                              STRICT
                            </span>
                          )}
                          <span className="text-xs opacity-75">
                            {Math.round(scheme.confidence * 100)}%
                          </span>
                          {scheme.isPrimary && (
                            <span className="ml-0.5 text-[10px] font-bold">★</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  // Fallback to legacy single scheme display
                  schemeKey && (
                    <button
                      onClick={() => setSchemeDialogOpen(true)}
                      className="block mt-2 text-xs font-medium text-indigo-700 hover:text-indigo-900 underline"
                    >
                      Using scheme: <span className="font-mono">{schemeName || schemeKey}</span> →
                    </button>
                  )
                )}
                
                {/* Reconstruction Justification - NEW */}
                {schemes.length > 0 && schemes.some((s: any) => s.justification) && (
                  <div className="mt-3 p-3 rounded-lg bg-indigo-50/50 border border-indigo-200">
                    <div className="flex items-start gap-2">
                      <span className="text-indigo-600 text-sm shrink-0">💭</span>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-semibold text-indigo-800 mb-1">
                          Argument Construction Notes
                        </h4>
                        <div className="space-y-2">
                          {schemes.map((scheme: any, idx: number) => (
                            scheme.justification && (
                              <div key={idx} className="text-xs text-indigo-700 leading-relaxed">
                                {schemes.length > 1 && (
                                  <span className="font-medium">
                                    {scheme.schemeName || `Scheme ${idx + 1}`}:
                                  </span>
                                )}{" "}
                                <span className="italic">{scheme.justification}</span>
                              </div>
                            )
                          ))}
                        </div>
                        <p className="text-[10px] text-indigo-600 mt-2">
                          Explanation of reasoning process used for argument construction.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Implicit Warrant Display - Toulmin Unstated Assumption */}
                {warrantData?.implicitWarrant?.text && (
                  <div className="mt-3 p-3 rounded-lg bg-amber-50/50 border border-amber-200">
                    <div className="flex items-start gap-2">
                      <span className="text-amber-600 text-sm shrink-0" title="Logical Gap Indicator">⚠️</span>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-semibold text-amber-800 mb-1">
                          Unstated Assumption (Implicit Warrant)
                        </h4>
                        <div className="text-xs text-amber-700 leading-relaxed">
                          <span className="italic">{warrantData.implicitWarrant.text}</span>
                        </div>
                        <p className="text-[10px] text-amber-600 mt-2">
                          Missing premise or general rule that bridges premises to conclusion (Toulmin warrant / enthymeme).
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* OPEN ASSUMPTIONS SECTION - Phase 3 Quick Win */}
        {assumptionsData?.assumptions && assumptionsData.assumptions.length > 0 && (
          <div>
            <SectionHeader
              title="Open Assumptions"
              icon={PanelBottomOpen}
              count={assumptionsData.assumptions.length}
              expanded={expandedSections.assumptions}
              onToggle={() => toggleSection("assumptions")}
            />
            {expandedSections.assumptions && (
              <div className="p-4 space-y-2 bg-sky-50/50">
                <div className="text-xs text-sky-700 mb-3 flex items-center gap-2">
                  <AlertCircle className="w-3 h-3" />
                  <span>This argument relies on the following assumptions:</span>
                </div>
                {assumptionsData.assumptions.map((assumption: any, idx: number) => (
                  <div 
                    key={assumption.id}
                    className="flex items-start gap-2 p-3 rounded-lg bg-white border border-sky-200 hover:border-sky-300 transition-colors"
                  >
                    <span className="inline-flex items-center justify-center min-w-[1.75rem] h-7 rounded-full bg-sky-100 text-sky-700 text-xs font-bold shrink-0">
                      λ{idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700 leading-relaxed">{assumption.text}</p>
                      <div className="flex items-center gap-3 mt-1.5 text-[10px]">
                        {assumption.weight !== undefined && (
                          <span className="font-medium text-sky-700">
                            weight: {assumption.weight.toFixed(2)}
                          </span>
                        )}
                        {assumption.role && assumption.role !== "premise" && (
                          <span className="text-slate-500">
                            role: {assumption.role}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div className="text-[10px] text-sky-600 bg-sky-50 p-2 rounded border border-sky-200 mt-2">
                  💡 <strong>Tip:</strong> Retracting or challenging an assumption may affect this argument&apos;s confidence.
                </div>
              </div>
            )}
          </div>
        )}

        {/* CITATIONS SECTION */}
        {citations.length > 0 && (
          <div>
            <SectionHeader
              title="Evidence & Citations"
              icon={LinkIcon}
              count={citations.length}
              expanded={expandedSections.assumptions}
              onToggle={() => toggleSection("assumptions")}
            />
            {expandedSections.assumptions && (
              <div className="p-4 space-y-2 bg-slate-50/50">
                {citations.map((citation: any) => {
                  const hasUrl = !!citation.url;
                  const CardWrapper = hasUrl ? "a" : "div";
                  const linkProps = hasUrl ? {
                    href: citation.url,
                    target: "_blank",
                    rel: "noopener noreferrer",
                  } : {};
                  
                  return (
                    <CardWrapper
                      key={citation.id}
                      {...linkProps}
                      className={`flex items-start gap-2 p-3 rounded-lg bg-white border border-slate-200 transition-all group ${
                        hasUrl 
                          ? "hover:border-indigo-300 hover:bg-indigo-50/30 cursor-pointer" 
                          : "opacity-90"
                      }`}
                    >
                      <LinkIcon className={`w-4 h-4 mt-0.5 shrink-0 ${hasUrl ? "text-slate-400 group-hover:text-indigo-600" : "text-slate-300"}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium leading-tight ${hasUrl ? "text-slate-900 group-hover:text-indigo-700" : "text-slate-700"}`}>
                          {citation.title}
                        </p>
                        {citation.authors && (
                          <p className="text-xs text-slate-600 mt-0.5">
                            {Array.isArray(citation.authors) 
                              ? citation.authors.map((a: any) => a.family || a.literal).join(", ")
                              : citation.authors
                            }
                          </p>
                        )}
                        {citation.text && (
                          <p className="text-xs text-slate-500 mt-1 italic border-l-2 border-slate-300 pl-2">
                            &ldquo;{citation.text}&rdquo;
                          </p>
                        )}
                        {citation.locator && (
                          <p className="text-[10px] text-slate-400 mt-1">
                            {citation.locator}
                          </p>
                        )}
                        {!hasUrl && (
                          <p className="text-[10px] text-amber-600 mt-1">
                            No link available
                          </p>
                        )}
                      </div>
                    </CardWrapper>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ATTACKS SECTION */}
        <div>
          <SectionHeader
            title="Challenges"
            icon={Shield}
            count={attackCount}
            expanded={expandedSections.attacks}
            onToggle={() => toggleSection("attacks")}
          />
          {expandedSections.attacks && (
            <div className="p-4 space-y-2 bg-slate-50/50">
              {loading ? (
                <div className="flex items-center justify-center gap-2 p-4">
                  <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
                  <span className="text-sm text-slate-600">Loading challenges...</span>
                </div>
              ) : attacks.length > 0 ? (
                <>
                  {rebutAttacks.map(attack => (
                    <AttackItem 
                      key={attack.id} 
                      attack={attack} 
                      deliberationId={deliberationId}
                      authorId={authorId}
                      currentUserId={currentUserId}
                      onAnyChange={onAnyChange}
                    />
                  ))}
                  {undercutAttacks.map(attack => (
                    <AttackItem 
                      key={attack.id} 
                      attack={attack} 
                      deliberationId={deliberationId}
                      authorId={authorId}
                      currentUserId={currentUserId}
                      onAnyChange={onAnyChange}
                    />
                  ))}
                  {undermineAttacks.map(attack => (
                    <AttackItem 
                      key={attack.id} 
                      attack={attack} 
                      deliberationId={deliberationId}
                      authorId={authorId}
                      currentUserId={currentUserId}
                      onAnyChange={onAnyChange}
                    />
                  ))}
                </>
              ) : (
                <div className="text-center py-6">
                  <Shield className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">No challenges yet</p>
                  <p className="text-xs text-slate-400 mt-1">
                    This argument hasn&apos;t been challenged
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* CQ Dialogs */}
      <Dialog open={cqDialogOpen} onOpenChange={setCqDialogOpen}>
        <DialogContent className="!z-[60] bg-white/95 backdrop-blur-xl rounded-xl max-w-[90vw] w-full sm:max-w-[880px] max-h-[85vh] overflow-y-auto shadow-2xl">
          {/* Water droplets */}
          <div className="absolute top-10 right-20 w-24 h-24 bg-sky-400/10 rounded-full blur-3xl animate-pulse pointer-events-none" />
          <div className="absolute bottom-20 left-10 w-32 h-32 bg-cyan-400/8 rounded-full blur-3xl animate-pulse delay-1000 pointer-events-none" />
          
          <div className="relative z-10">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold text-sky-900 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-600" />
                Claim-level Critical Questions
              </DialogTitle>
            </DialogHeader>
            <div className="mt-4">
              {conclusion?.id && (
                <CriticalQuestionsV3
                  targetType="claim"
                  targetId={conclusion.id}
                  createdById={authorId}
                  deliberationId={deliberationId}
                />
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <SchemeSpecificCQsModal
        open={argCqDialogOpen}
        onOpenChange={setArgCqDialogOpen}
        argumentId={id}
        deliberationId={deliberationId}
        authorId={schemeCqData?.authorId ?? authorId}
        currentUserId={currentUserId}
        cqs={schemeCqData?.items ?? []}
        meta={{
          scheme: (() => {
            const primary = schemes?.[0];
            if (primary) {
              return { id: primary.schemeId, key: primary.schemeKey, name: primary.schemeName };
            }
            return schemeKey
              ? { id: schemeKey, key: schemeKey, name: schemeName ?? schemeKey }
              : null;
          })(),
          conclusion: conclusion ? { id: conclusion.id, text: conclusion.text } : null,
          premises: premises ?? null,
        }}
        onRefresh={() => {
          mutateSchemeCqs();
          onAnyChange?.();
        }}
      />

      {/* Scheme Breakdown Modal */}
      <SchemeBreakdownModal
        open={schemeDialogOpen}
        onOpenChange={setSchemeDialogOpen}
        argumentId={id}
        argumentText={conclusion.text}
      />
      
      {/* Phase 3: Dialogue Move Detail Modal */}
      <DialogueMoveDetailModal
        moveId={selectedDialogueMoveId}
        open={dialogueMoveModalOpen}
        onOpenChange={setDialogueMoveModalOpen}
        onViewFullDialogue={(moveId, delibId) => {
          if (onViewDialogueMove) {
            onViewDialogueMove(moveId, delibId);
          }
        }}
      />
      
      {/* Argument-Level Attack Modal */}
      {showAttackModal && (
        <ArgumentAttackModal
          deliberationId={deliberationId}
          argumentId={id}
          conclusion={conclusion}
          premises={premises}
          schemeKey={schemeKey || schemes[0]?.schemeKey}
          schemeName={schemeName || schemes[0]?.schemeName}
          onClose={() => setShowAttackModal(false)}
          onCreated={() => {
            onAnyChange?.();
            // Refetch attacks if section is expanded
            if (expandedSections.attacks) {
              setLoading(true);
              // Trigger refetch (component will reload)
            }
          }}
        />
      )}
      
      {/* Phase 2: Multi-Scheme Addition Dialog */}
      <SchemeAdditionDialog
        open={showSchemeAdditionDialog}
        onClose={() => setShowSchemeAdditionDialog(false)}
        argumentId={id}
        deliberationId={deliberationId}
        existingSchemes={schemes.map((s: any) => ({
          id: s.id || "",
          schemeId: s.schemeId,
          argumentId: id,
          role: s.role || "supporting",
          explicitness: s.explicitness || "explicit",
          isPrimary: s.isPrimary,
          confidence: s.confidence,
          order: s.order || 0,
          textEvidence: s.textEvidence,
          justification: s.justification,
          scheme: {
            id: s.schemeId,
            name: s.schemeName,
            key: s.schemeKey,
            category: s.category,
            materialRelation: s.materialRelation,
            reasoningType: s.reasoningType
          }
        }))}
        onSchemeAdded={(schemeInstanceId) => {
          console.log("Scheme added:", schemeInstanceId);
          setShowSchemeAdditionDialog(false);
          mutateSchemes(); // Refresh schemes data
          onAnyChange?.(); // Notify parent of change
        }}
      />

      {/* Phase 2 Feature #2: Dependency Editor */}
      <DependencyEditor
        open={showDependencyEditor}
        onClose={() => setShowDependencyEditor(false)}
        argumentId={id}
        schemes={schemes.map((s: any) => ({
          id: s.id || "",
          schemeId: s.schemeId,
          role: s.role || "supporting",
          explicitness: s.explicitness || "explicit",
          isPrimary: s.isPrimary,
          confidence: s.confidence,
          order: s.order || 0,
          scheme: {
            id: s.schemeId,
            name: s.schemeName,
            description: s.schemeSummary
          }
        }))}
        onDependenciesUpdated={() => {
          console.log("Dependencies updated");
          setShowDependencyEditor(false);
          mutateSchemes(); // Refresh to potentially trigger visualization update
          onAnyChange?.(); // Notify parent of change
        }}
      />

      {/* Phase 4 Feature #4: Argument Net Builder */}
      <ArgumentNetBuilder
        open={showNetBuilder}
        onClose={() => setShowNetBuilder(false)}
        argumentId={id}
        onComplete={(netId) => {
          console.log("Net created:", netId);
          setShowNetBuilder(false);
          mutateSchemes(); // Refresh to show net
          onAnyChange?.(); // Notify parent of change
        }}
      />
      
      {/* Phase 1d.2: Quick Contrary Dialog */}
      <QuickContraryDialog
        open={showContraryDialog}
        onOpenChange={setShowContraryDialog}
        deliberationId={deliberationId}
        sourceClaim={{
          id: conclusion.id,
          text: conclusion.text
        }}
        currentUserId={currentUserId}
        onContraryCreated={() => {
          // Dialog will dispatch contraries:changed event
          // ArgumentCardV2 will auto-refresh via existing listener
          onAnyChange?.(); // Notify parent of change
        }}
      />
    </div>
    </TooltipProvider>
  );
}
