"use client";
import { useEffect, useState, useMemo } from "react";
import { GalleryVerticalEnd, MessageSquare, Settings } from "lucide-react";
import DeliberationComposer from "./DeliberationComposer";
import { RepresentativeViewpoints } from "./RepresentativeViewpoints";
import ArgumentsList from "./ArgumentsList";
import CardComposerTab from "@/components/deepdive/CardComposerTab";
import StatusChip from "@/components/governance/StatusChip";
import { Tabs, TabsList, TabsContent, TabsTrigger } from "../ui/tabs";
import CegMiniMap from "./CegMiniMap";
import TopologyWidget from "./TopologyWidget";
import DiscusHelpPage from "../help/HelpPage";
import ApprovalsHeatStrip from "@/components/deepdive/ApprovalsHeatStrip";
import WorksList from "../work/WorksList";
import LudicsPanel from "./LudicsPanel";
import { FloatingSheet, SheetToggleButton } from "../ui/FloatingSheet";
import { DialogueInspector } from "@/components/dialogue/DialogueInspector";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DeliberationSettingsPanel } from "../deliberations/DeliberationSettingsPanel";
import { DeliberationSettingsModal } from "../deliberations/DeliberationSettingsModal";
import { AFMinimap } from '@/components/dialogue/minimap/AFMinimap';
import { DeliberationLoadingScreen } from "@/components/deliberations/DeliberationLoadingScreen";
import BehaviourInspectorCard from '@/components/ludics/BehaviourInspectorCard';
import { scrollIntoViewById } from "@/lib/client/scroll";
import { CommandCard, performCommand } from '@/components/dialogue/command-card/CommandCard';
import { CommandCardAction } from "../dialogue/command-card/types";
import type { AifSubgraph } from '@/lib/arguments/diagram';
import { movesToActions } from "@/lib/dialogue/movesToActions"; // ✅ Use newer adapter instead of legalMovesToCommandCard
import { CQContextPanel } from "../dialogue/command-card/CQContextPanel";
import { DialogueActionsButton } from "@/components/dialogue/DialogueActionsButton";
import { useMinimapData } from '@/lib/client/minimap/useMinimapData';
import useSWR, { mutate as swrMutate } from "swr";
import { DefinitionSheet } from "@/components/glossary/DefinitionSheet";
import { AIFAuthoringPanel } from "./AIFAuthoringPanel";
import { DeliberationStateCard } from "@/components/deliberation/DeliberationStateCard";
import { FrontierLane } from "@/components/deliberation/FrontierLane";
import React from "react";
import clsx from "clsx";
import { SectionCard, ChipBar, StickyHeader } from "./shared";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { ArgumentsTab, AnalyticsTab, DebateTab } from "./v3/tabs";
import { ChainsTab } from "./v3/tabs/ChainsTab"; // Task 1.7: Chains tab
import CardListVirtuoso from "@/components/deepdive/CardListVirtuoso";
import { useAuth } from "@/lib/AuthContext";
import DeliberationTitle from "@/components/deepdive/DeliberationTitle";
import { useSheetPersistence, useDeliberationState } from "./v3/hooks";
import { getUserFromCookies } from "@/lib/server/getUser";
import AIFArgumentsListPro from '@/components/arguments/AIFArgumentsListPro';
import PropositionsList from "../propositions/PropositionsList";
import PropositionComposer from "../propositions/PropositionComposer";
import { DiagramViewer } from "../dialogue/deep-dive/DiagramViewer";
import IssuesDrawer from "@/components/issues/IssuesDrawer";
import IssueComposer from "@/components/issues/IssueComposer";
import { ConfidenceProvider } from "../agora/useConfidence";
import { AspicTheoryPanel } from "@/components/aspic/AspicTheoryPanel";
import ClaimMiniMap from "../claims/ClaimMiniMap";
import { PropositionComposerPro } from "../propositions/PropositionComposerPro";
import IssuesList from "../issues/IssuesList";
import { ArgumentActionsSheet } from "../arguments/ArgumentActionsSheet";
import { ThesisComposer } from "../thesis/ThesisComposer";
import { ThesisRenderer } from "../thesis/ThesisRenderer";
import { ThesisListView } from "../thesis/ThesisListView";
import { ActiveAssumptionsPanel } from "@/components/assumptions/ActiveAssumptionsPanel";
import { CreateAssumptionForm } from "@/components/assumptions/CreateAssumptionForm";
import CrossRoomSearchPanel from "@/components/crossDeliberation/CrossRoomSearchPanel";
import { DeliberationPathwaysTab } from "@/components/pathways/DeliberationPathwaysTab";
import ArgumentImportModal from "@/components/crossDeliberation/ArgumentImportModal";
import CrossDeliberationTab from "@/components/crossDeliberation/CrossDeliberationTab";
import { SchemeBreakdown } from "@/components/arguments/SchemeBreakdown";
import { DialogueAwareGraphPanel } from "@/components/aif/DialogueAwareGraphPanel";
import { AifDiagramViewerDagre } from "@/components/map/Aifdiagramviewerdagre";
import { EvidenceList } from "@/components/evidence/EvidenceList";
import { DeliberationEvidencePanel } from "@/components/citations/DeliberationEvidencePanel";
import { DiscourseDashboard } from "@/components/discourse/DiscourseDashboard";
import { CommitmentStorePanel } from "@/components/aif/CommitmentStorePanel";
import { CommitmentAnalyticsDashboard } from "@/components/aif/CommitmentAnalyticsDashboard";

const fetcher = (u: string) => fetch(u, { cache: 'no-store' }).then(r => r.json());

type Selection = {
  id: string;
  deliberationId: string;
  rule: "utilitarian" | "harmonic" | "maxcov";
  k: number;
  coverageAvg: number;
  coverageMin: number;
  jrSatisfied: boolean;
  views: {
    index: number;
    arguments: { id: string; text: string; confidence?: number | null }[];
  }[];
};

function useCompileStep(deliberationId: string | undefined) {
  const [state, setState] = React.useState<{
    proId?: string;
    oppId?: string;
    trace?: any;
    loading: boolean;
  }>({ loading: false });

  // Auto-compilation removed - designs will be fetched only when user navigates to Ludics tab
  // or manually clicks compile button
  
  return state;
}

function WorksCounts({ deliberationId }: { deliberationId: string }) {
  const [counts, setCounts] = useState<{ DN: number; IH: number; TC: number; OP: number }>({ DN: 0, IH: 0, TC: 0, OP: 0 });
  useEffect(() => {
    if (!deliberationId) return;
    (async () => {
      const res = await fetch(`/api/works?deliberationId=${encodeURIComponent(deliberationId)}`, { cache: 'no-store' });
      const json = await res.json();
      const tallies = { DN: 0, IH: 0, TC: 0, OP: 0 } as any;
      for (const w of (json.works ?? [])) tallies[w.theoryType] = (tallies[w.theoryType] ?? 0) + 1;
      setCounts(tallies);
    })();
  }, [deliberationId]);
  return (
    <ChipBar>
      <span className="text-[11px] text-neutral-900 py-1">
        DN <b>{counts.DN}</b> · IH <b>{counts.IH}</b> · TC <b>{counts.TC}</b> · OP <b>{counts.OP}</b>
      </span>
    </ChipBar>
  );
}

function usePersisted(key: string, def = true) {
  const [open, setOpen] = useState<boolean>(def);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(key);
      if (saved != null) {
        setOpen(saved === "1");
      }
    } catch {
      // ignore if unavailable
    }
  }, [key]);

  useEffect(() => {
    try {
      window.localStorage.setItem(key, open ? "1" : "0");
    } catch {
      // ignore if unavailable
    }
  }, [key, open]);

  return { open, setOpen };
}

// Helper component for commitments tab content
function CommitmentsTabContent({ 
  deliberationId, 
  onClaimClick 
}: { 
  deliberationId: string; 
  onClaimClick: (claimId: string) => void;
}) {
  const { data: commitmentData, error: commitmentError, isLoading: commitmentLoading, mutate: commitmentMutate } = useSWR(
    `/api/aif/dialogue/${deliberationId}/commitments`,
    fetcher,
    {
      revalidateOnFocus: false,
      refreshInterval: 30000, // Refresh every 30 seconds
    }
  );

  return (
    <div>
      <div className="px-3">
        <h3 className="text-sm font-semibold text-slate-700 mb-2">
          Participant Commitments
        </h3>
        <p className="text-xs text-slate-500 mb-3">
          Track which claims participants have asserted, conceded, or retracted
        </p>
      </div>

      {commitmentLoading ? (
        <div className="h-[400px] rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-2"></div>
            <div className="text-sm text-slate-600">Loading commitments...</div>
          </div>
        </div>
      ) : commitmentError ? (
        <div className="h-[400px] rounded-lg border border-red-200 bg-red-50 flex items-center justify-center">
          <div className="text-center p-4">
            <svg className="w-12 h-12 text-red-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="text-sm text-red-900 font-medium mb-1">Failed to load</div>
            <div className="text-xs text-red-700">{String(commitmentError)}</div>
          </div>
        </div>
      ) : !commitmentData || commitmentData.length === 0 ? (
        <div className="h-[400px] rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center">
          <div className="text-center p-4">
            <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm text-slate-600 font-medium mb-1">No commitments yet</div>
            <div className="text-xs text-slate-500">Participants will appear here as they make commitments</div>
          </div>
        </div>
      ) : (
        <CommitmentStorePanel 
          stores={commitmentData}
          deliberationId={deliberationId}
          onClaimClick={onClaimClick}
          onRefresh={() => commitmentMutate()}
          showTimeline={false}
          className="border p-0 overflow-none shadow-none"
        />
      )}
    </div>
  );
}

export default function DeepDivePanel({
  deliberationId,
  containerClassName,
  selectedClaimId,
  onClose,
  className,
  hostName,
}: {
  deliberationId: string;
  containerClassName?: string;
  className?: string;
  selectedClaimId?: string;
  onClose?: () => void;
  hostName?: string | null;
}) {
  const { proId, oppId, trace, loading } = useCompileStep(deliberationId);

  // Week 3 Task 3.2: Consolidated deliberation state hook
  const { state: delibState, actions: delibActions } = useDeliberationState({
    initialTab: 'debate',
    initialConfig: {
      confMode: 'product',
      rule: 'utilitarian',
      dsMode: false,
      cardFilter: 'all',
    },
  });

  const [sel, setSel] = useState<Selection | null>(null);
  
  const { user } = useAuth();
  const authorId = user?.userId != null ? String(user.userId) : undefined;
  const [rhetoricSample, setRhetoricSample] = useState<string>('');

  // Fetch current user ID for issues dashboard
  const [currentUserId, setCurrentUserId] = React.useState<string | undefined>(undefined);
  React.useEffect(() => {
    getUserFromCookies().then((u) => {
      const userId = u?.userId != null ? String(u.userId) : undefined;
      setCurrentUserId(userId);
    });
  }, []);

  // Ludics designs are only needed for the Ludics tab, not for the entire deliberation
  const ludicsReady = !!proId && !!oppId;

  const [diagramData, setDiagramData] = useState<AifSubgraph | null>(null);
  const [commandActions, setCommandActions] = useState<CommandCardAction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Floating sheet state with persistence (Week 3 Task 3.1: useSheetPersistence hook)
  const { state: sheets, actions: sheetActions } = useSheetPersistence({
    storageKey: `dd:sheets:${deliberationId}`,
    defaultState: { left: false, right: false, terms: false },
  });
  const [leftSheetTab, setLeftSheetTab] = useState<'arguments' | 'claims' | 'commitments' | 'analytics'>('claims');
  const [selectedTermId, setSelectedTermId] = useState<string | undefined>();
  const [selectedArgumentForActions, setSelectedArgumentForActions] = useState<{
    id: string;
    text?: string;
    conclusionText?: string;
    conclusionClaimId?: string;
    schemeKey?: string;
    schemeId?: string;
    schemeName?: string;
    premises?: Array<{ id: string; text: string; isImplicit?: boolean }>;
  } | null>(null);

  // at top of the component with the other state
const [issuesOpen, setIssuesOpen] = useState(false);
const [composerOpen, setComposerOpen] = useState(false);
const [issueTargetId, setIssueTargetId] = useState<string | null>(null);

  // Thesis state
  const [thesisComposerOpen, setThesisComposerOpen] = useState(false);
  const [selectedThesisId, setSelectedThesisId] = useState<string | null>(null);
  const [thesisViewerOpen, setThesisViewerOpen] = useState(false);
  const [viewedThesisId, setViewedThesisId] = useState<string | null>(null);

  // Settings modal (visibility + moderators)
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Load leftSheetTab from localStorage (other sheet state managed by hook)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`dd:sheets:${deliberationId}`);
      if (saved) {
        const { leftTab } = JSON.parse(saved);
        setLeftSheetTab(leftTab ?? 'arguments');
      }
    } catch (error) {
      console.error('Failed to load sheet tab state:', error);
    }
  }, [deliberationId]);

  // Save leftSheetTab to localStorage (sheet open/close state managed by hook)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`dd:sheets:${deliberationId}`);
      const existing = saved ? JSON.parse(saved) : {};
      localStorage.setItem(
        `dd:sheets:${deliberationId}`,
        JSON.stringify({
          ...existing,
          leftTab: leftSheetTab,
        })
      );
    } catch (error) {
      console.error('Failed to save sheet tab state:', error);
    }
  }, [leftSheetTab, deliberationId]);

  const [selectedClaim, setSelectedClaim] = useState<{
    id: string;
    locusPath?: string | null;
  } | null>(selectedClaimId ? { id: selectedClaimId } : null);

  const handleNodeClick = (nodeId: string) => {
    handleClaimSelect(nodeId);
  };

  // Unified claim selection handler
  function handleClaimSelect(id: string, locusPath?: string | null) {
    setSelectedClaim({ id, locusPath: locusPath ?? null });

    // Scroll to the claim in the ArgumentsList
    requestAnimationFrame(() => {
      const element = document.getElementById(`row-${id}`);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  // Derived values:
  const selectedNodeId = selectedClaim?.id;
  const hudTarget = selectedClaim ? {
    type: 'claim' as const,
    id: selectedClaim.id,
    locusPath: selectedClaim.locusPath
  } : null;

  // Use the existing useMinimapData hook instead of manual fetch
const { 
    nodes: minimapNodes, 
    edges: minimapEdges,
    loading: minimapLoading,
    error: minimapError 
  } = useMinimapData(deliberationId, {
    semantics: 'grounded',
    supportDefense: true,
    radius: 1,
    maxNodes: 400,
  });

  // Fetch diagram data when node is selected
  useEffect(() => {
    if (!selectedNodeId) {
      setDiagramData(null);
      return;
    }

    async function fetchDiagramData() {
      setIsLoading(true);
      try {
        // First get the top argument for this claim
        const topArgResponse = await fetch(`/api/claims/${selectedNodeId}`);
        const topArgData = await topArgResponse.json();

        if (topArgData?.top?.id) {
          // Then fetch the AIF diagram for that argument
          const response = await fetch(`/api/arguments/${topArgData.top.id}?view=diagram`);
          const data = await response.json();
          setDiagramData(data.aif || data);
        } else {
          setDiagramData(null);
        }
      } catch (error) {
        console.error('Failed to fetch diagram data:', error);
        setDiagramData(null);
      } finally {
        setIsLoading(false);
      }
    }

    fetchDiagramData();
  }, [selectedNodeId]);

  

  // Fetch available commands
//   useEffect(() => {
//     if (!selectedNodeId) return;

//     async function fetchCommands() {
//       try {
//         const response = await fetch(
//           `/api/dialogue/moves?deliberationId=${deliberationId}&targetId=${selectedNodeId}&targetType=claim`
//         );
//         const data = await response.json();
//         setCommandActions(data.items || []);
//       } catch (error) {
//         console.error('Failed to fetch commands:', error);
//       }
//     }

//     fetchCommands();
//   }, [deliberationId, selectedNodeId]);

  async function handleCommandPerform(action: CommandCardAction) {
    try {
      // Execute the command
      await performCommand(action);

      // Emit global refresh event first (fastest feedback)
      window.dispatchEvent(new CustomEvent('mesh:dialogue:refresh'));

      // Create parallel fetch promises for better performance
      const refreshPromises: Promise<any>[] = [];

      // Refresh diagram and commands if node is selected
      if (selectedNodeId) {
        setIsLoading(true);

        // Diagram data - fetch top argument first, then AIF
        refreshPromises.push(
          fetch(`/api/claims/${selectedNodeId}/top-argument`, { cache: 'no-store' })
            .then(res => res.json())
            .then(topArgData => {
              if (topArgData?.top?.id) {
                return fetch(`/api/arguments/${topArgData.top.id}?view=diagram`, { cache: 'no-store' })
                  .then(res => res.json())
                  .then(data => setDiagramData(data.aif || data));
              }
            })
            .catch(err => console.error('Failed to refresh diagram:', err))
        );

        // Available commands
        refreshPromises.push(
          fetch(`/api/dialogue/moves?deliberationId=${deliberationId}&targetId=${selectedNodeId}&targetType=claim`, { cache: 'no-store' })
            .then(res => res.json())
            .then(data => setCommandActions(data.items || []))
            .catch(err => console.error('Failed to refresh commands:', err))
        );
      }

      // Wait for all refreshes to complete
      await Promise.allSettled(refreshPromises);

      // Trigger SWR revalidation for any cached dialogue endpoints
      await swrMutate(
        (key: any) => typeof key === 'string' && (
          key.includes('/api/dialogue/') ||
          key.includes('/api/claims/') ||
          key.includes('/api/arguments/')
        ),
        undefined,
        { revalidate: true }
      );

      // If the action was a CLOSE or major state change, recompute viewpoints
      // if (action.kind === 'CLOSE' || action.kind === 'RETRACT') {
      //   await compute(sel?.rule);
      // }

    } catch (error) {
      console.error('Command execution failed:', error);

      // Show user-friendly error message
      const errorMessage = error instanceof Error
        ? error.message
        : 'An unexpected error occurred';

      alert(`Failed to execute ${action.label}: ${errorMessage}`);

    } finally {
      setIsLoading(false);
    }
  }

  // Progressive disclosure state hooks
  const diagnosticsState = usePersisted(`dd:diagnostics:${deliberationId}`, false);
  const worksState = usePersisted(`dd:works:${deliberationId}`, false);
  const aifArgsState = usePersisted(`dd:aifargs:${deliberationId}`, false);
  const schemeComposerState = usePersisted(`dd:scheme:${deliberationId}`, false);

  // const compute = async (
  //   forcedRule?: "utilitarian" | "harmonic" | "maxcov",
  //   forcedK?: number
  // ) => {
  //   delibActions.setPending(true);
  //   try {
  //     const res = await fetch(
  //       `/api/deliberations/${deliberationId}/viewpoints/select`,
  //       {
  //         method: "POST",
  //         headers: { "Content-Type": "application/json" },
  //         body: JSON.stringify({
  //           rule: forcedRule ?? delibState.rule,
  //           k: forcedK ?? sel?.k ?? 3,
  //         }),
  //         cache: "no-store",
  //       }
  //     );
  //     if (!res.ok) {
  //       console.error("Viewpoints select failed", res.status);
  //       return;
  //     }
  //     const data = await res.json().catch(() => null);
  //     if (data?.selection) setSel(data.selection);
  //   } finally {
  //     delibActions.setPending(false);
  //   }
  // };

  useEffect(() => {
    fetch(
      `/api/content-status?targetType=deliberation&targetId=${deliberationId}`
    )
      .then((r) => r.json())
      .then((d) => delibActions.setStatus(d.status))
      .catch(() => { });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deliberationId]); // Only re-fetch when deliberationId changes

  // useEffect(() => { compute(); }, [deliberationId]);

  const ftch = (u: string) => fetch(u, { cache: 'no-store' }).then(r => r.json());

  // Fetch claim data directly (not top argument)
  const { data: claimData, error: claimError, isLoading: claimLoading } = useSWR(
    selectedNodeId ? `/api/claims/${encodeURIComponent(selectedNodeId)}` : null,
    ftch,
    {
      revalidateOnFocus: false,
      dedupingInterval: 2000,
    }
  );

  // Fetch diagram only if we have a claim
  const { data: diag, error: diagError, isLoading: diagLoading } = useSWR(
    claimData?.topArgumentId ? `/api/arguments/${encodeURIComponent(claimData.topArgumentId)}?view=diagram` : null,
    ftch,
    {
      revalidateOnFocus: false,
      dedupingInterval: 2000,
    }
  );

  // Debug logging
  useEffect(() => {
    console.log('Claim Data:', {
      selectedNodeId,
      loading: claimLoading,
      error: claimError,
      hasData: !!claimData,
      claimData,
    });
  }, [selectedNodeId, claimLoading, claimError, claimData]);


  const { data: topArg } = useSWR(
    hudTarget?.type === 'claim' ? `/api/claims/${encodeURIComponent(hudTarget.id)}/top-argument` : null,
    ftch
  );

//   const { data: diag } = useSWR(
//     topArg?.top?.id ? `/api/arguments/${encodeURIComponent(topArg.top.id)}?view=diagram` : null,
//     ftch
//   );

  useEffect(() => {
    const onSelect = (e: any) => {
      const { id, locusPath } = e?.detail || {};
      if (!id) return;
      handleClaimSelect(id, locusPath ?? null);
    };
    window.addEventListener('mesh:select-node', onSelect as any);
    return () => window.removeEventListener('mesh:select-node', onSelect as any);
  }, []);

  const targetRef = hudTarget
    ? { deliberationId, targetType: 'claim' as const, targetId: hudTarget.id, locusPath: hudTarget.locusPath }
    : null;

  const { data: legalMoves, error: legalMovesError, isLoading: legalMovesLoading } = useSWR(
    targetRef
      ? `/api/dialogue/legal-moves?deliberationId=${encodeURIComponent(deliberationId)}&targetType=claim&targetId=${encodeURIComponent(hudTarget!.id)}${hudTarget?.locusPath ? `&locusPath=${encodeURIComponent(hudTarget!.locusPath!)}` : ''}`
      : null,
    fetcher,
    { revalidateOnFocus: false }
  );


//   const cardActions = targetRef ? legalMovesToCommandCard(legalMoves?.moves ?? [], targetRef, true) : [];


  // ✅ Adapt the moves to CommandCardAction format using the NEWER movesToActions adapter
  const cardActions = useMemo(() => {
    if (!targetRef || !legalMoves?.moves) return [];
    return movesToActions(legalMoves.moves, targetRef);
  }, [targetRef, legalMoves]);

  // Count badges for toggle buttons - USE cardActions instead of commandActions
  const leftBadgeCount = useMemo(() => {
    let count = 0;
    if (selectedClaim?.id) count++;
    if (cardActions.length > 0) count++;
    return count;
  }, [selectedClaim, cardActions]);

  const rightBadgeCount = useMemo(() => {
    let count = 0;
    if (selectedArgumentForActions) count++; // Argument selected for actions
    if (diag?.aif) count++;
    if (cardActions.length > 0) count++;
    return count;
  }, [selectedArgumentForActions, diag, cardActions]);


  useEffect(() => {
    const onRefresh = () => {
      swrMutate((key: any) => typeof key === 'string' && key.startsWith('/api/dialogue/'), undefined, { revalidate: true });
    };
    window.addEventListener('mesh:dialogue:refresh', onRefresh);
    return () => window.removeEventListener('mesh:dialogue:refresh', onRefresh);
  }, []);

  // AI-EPI Pt. 4 §6 — `mesh:deepdive:setTab` channel. Lets sibling
  // components (DeliberationStateCard drawer, FrontierLane CTAs, the
  // embedded widget) seek into a specific tab without a prop drill.
  useEffect(() => {
    const onSetTab = (e: Event) => {
      const detail = (e as CustomEvent).detail as { tab?: string } | undefined;
      if (detail?.tab && typeof detail.tab === "string") {
        delibActions.setTab(detail.tab as any);
      }
    };
    window.addEventListener("mesh:deepdive:setTab", onSetTab as EventListener);
    return () => window.removeEventListener("mesh:deepdive:setTab", onSetTab as EventListener);
  }, [delibActions]);

  function handleReplyTo(id: string, preview?: string) {
    delibActions.setReplyTarget({ id, preview });
    requestAnimationFrame(() => {
      scrollIntoViewById("delib-composer-anchor", 80);
      window.dispatchEvent(new CustomEvent("mesh:composer:focus", { detail: { deliberationId } }));
    });
  }

//   // Count badges for toggle buttons
//   const leftBadgeCount = useMemo(() => {
//     let count = 0;
//     if (selectedClaim?.id) count++;
//     if (commandActions.length > 0) count++;
//     return count;
//   }, [selectedClaim, commandActions]);

//   const rightBadgeCount = useMemo(() => {
//     let count = 0;
//     if (diag?.aif) count++;
//     if (cardActions.length > 0) count++;
//     return count;
//   }, [diag, cardActions]);

  // Main content
  const inner = (
    <ConfidenceProvider>
      {/* Header section when content is ready */}
      <div className="w-full">
        <DeliberationTitle deliberationId={deliberationId} hostName={hostName} />
      </div>

      {/* Deliberation Settings Modal (visibility + moderators) */}
      <DeliberationSettingsModal
        deliberationId={deliberationId}
        currentUserId={currentUserId}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      />

      {/* Floating Toggle Buttons */}
      <SheetToggleButton
        side="left"
        open={sheets.left}
        onClick={sheetActions.toggleLeft}
        icon={
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        }
        label="Explorer"
        badge={leftBadgeCount}
      />

      <SheetToggleButton
        side="right"
        open={sheets.right}
        onClick={sheetActions.toggleRight}
        icon={
         
          <svg xmlns="http://www.w3.org/2000/svg"  viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-gamepad-directional-icon lucide-gamepad-directional"><path d="M11.146 15.854a1.207 1.207 0 0 1 1.708 0l1.56 1.56A2 2 0 0 1 15 18.828V21a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-2.172a2 2 0 0 1 .586-1.414z"/><path d="M18.828 15a2 2 0 0 1-1.414-.586l-1.56-1.56a1.207 1.207 0 0 1 0-1.708l1.56-1.56A2 2 0 0 1 18.828 9H21a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1z"/><path d="M6.586 14.414A2 2 0 0 1 5.172 15H3a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h2.172a2 2 0 0 1 1.414.586l1.56 1.56a1.207 1.207 0 0 1 0 1.708z"/><path d="M9 3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2.172a2 2 0 0 1-.586 1.414l-1.56 1.56a1.207 1.207 0 0 1-1.708 0l-1.56-1.56A2 2 0 0 1 9 5.172z"/></svg>
        }
        label="Actions"
        badge={rightBadgeCount}
      />

      <SheetToggleButton
        side="right"
        open={sheets.terms}
        onClick={sheetActions.toggleTerms}
        offsetTop="top-40"
        icon={
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        }
        label="Dictionary"
      />

      {/* Left Floating Sheet - Graph Explorer */}
      <FloatingSheet
        open={sheets.left}
        onOpenChange={sheetActions.setLeft}
        side="left"
        width={1000}
        title="Graph Explorer"
        subtitle="Navigate argument structure"
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
        }
      >
        {/* Tab Selector */}
        <div className="flex mt-0 gap-2 mb-4 ">
          <button
            onClick={() => setLeftSheetTab('arguments')}
            className={clsx(
              'flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              leftSheetTab === 'arguments'
                ? 'bg-indigo-100 text-indigo-700 shadow-sm'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            )}
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Arguments
            </div>
          </button>
          <button
            onClick={() => setLeftSheetTab('claims')}
            className={clsx(
              'flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              leftSheetTab === 'claims'
                ? 'bg-indigo-100 text-indigo-700 shadow-sm'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            )}
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Claims
            </div>
          </button>
          <button
            onClick={() => setLeftSheetTab('commitments')}
            className={clsx(
              'flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              leftSheetTab === 'commitments'
                ? 'bg-indigo-100 text-indigo-700 shadow-sm'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            )}
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Commitments
            </div>
          </button>
          <button
            onClick={() => setLeftSheetTab('analytics')}
            className={clsx(
              'flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              leftSheetTab === 'analytics'
                ? 'bg-indigo-100 text-indigo-700 shadow-sm'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            )}
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Analytics
            </div>
          </button>
        </div>

        {/* Tab Content */}
        {leftSheetTab === 'commitments' ? (
          <CommitmentsTabContent deliberationId={deliberationId} onClaimClick={handleClaimSelect} />
        ) : leftSheetTab === 'analytics' ? (
          <CommitmentAnalyticsDashboard 
            deliberationId={deliberationId}
            className="px-4 py-3"
          />
        ) : leftSheetTab === 'arguments' ? (
          <>
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-2">
                Argument Flow Map (AIF)
              </h3>
              <p className="text-xs text-slate-500 mb-3">
                Interactive visualization of the structured argument network
              </p>
               {/* Loading State */}
              {minimapLoading ? (
                <div className="h-[320px] rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-2"></div>
                    <div className="text-sm text-slate-600">Loading argument map...</div>
                  </div>
                </div>
              ) : minimapError ? (
                <div className="h-[320px] rounded-lg border border-red-200 bg-red-50 flex items-center justify-center">
                  <div className="text-center p-4">
                    <svg className="w-12 h-12 text-red-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div className="text-sm text-red-900 font-medium mb-1">Failed to load</div>
                    <div className="text-xs text-red-700">{String(minimapError)}</div>
                  </div>
                </div>
              ) : (!minimapNodes || minimapNodes.length === 0) ? (
                <div className="h-[320px] rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center">
                  <div className="text-center p-4">
                    <svg className="w-12 h-12 text-slate-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                    <div className="text-sm text-slate-600 font-medium mb-1">No arguments yet</div>
                    <div className="text-xs text-slate-500">Start the debate to see the argument map</div>
                  </div>
                </div>
              ) : (
                // <AFMinimap
                //   nodes={minimapNodes}
                //   edges={minimapEdges}
                //   selectedId={selectedNodeId}
                //   onSelectNode={(id, locusPath) => handleClaimSelect(id, locusPath)}
                //   width={432}
                //   height={320}
                // />
                <div className="min-h-[600px]">
                  <DialogueAwareGraphPanel
                    deliberationId={deliberationId}
                    initialShowDialogue={true}
                    highlightMoveId={delibState.highlightedDialogueMoveId}
                    className="w-full"
                    renderGraph={(nodes, edges) => {
                      const aifGraph = {
                        nodes: nodes.map(n => ({
                          id: n.id,
                          kind: (n.nodeKind === 'I' ? 'I' : 
                                 n.nodeKind === 'RA' ? 'RA' : 
                                 n.nodeKind === 'CA' ? 'CA' : 
                                 n.nodeKind === 'PA' ? 'PA' : 'I') as 'I' | 'RA' | 'CA' | 'PA',
                          label: n.text || n.id,
                          schemeKey:  null,
                          schemeName: null,
                          cqStatus: null,
                          dialogueMoveId: n.dialogueMove?.id || null,
                          locutionType: n.dialogueMetadata?.locution || null,
                          isImported: false,
                          importedFrom: null,
                          toulminDepth: null
                        })),
                        edges: edges.map(e => {
                          // Map edgeType to AIF role based on source/target node types
                          let role: 'premise' | 'conclusion' | 'conflictingElement' | 'conflictedElement' | 'preferredElement' | 'dispreferredElement' | 'has-presumption' | 'has-exception' = 'premise';
                          
                          if (e.edgeType === 'inference') {
                            // I → RA = premise, RA → I = conclusion
                            if (e.source.startsWith('I:') && e.target.startsWith('RA:')) {
                              role = 'premise';
                            } else if (e.source.startsWith('RA:') && e.target.startsWith('I:')) {
                              role = 'conclusion';
                            }
                          } else if (e.edgeType === 'conflict') {
                            // Attacker → CA = conflictingElement, CA → Target = conflictedElement
                            if (e.target.startsWith('CA:')) {
                              role = 'conflictingElement';
                            } else if (e.source.startsWith('CA:')) {
                              role = 'conflictedElement';
                            }
                          } else if (e.edgeType === 'supports') {
                            // Support edges shown as preferredElement (purple dashed)
                            role = 'preferredElement';
                          }
                          
                          return {
                            id: e.id || `${e.source}-${e.target}`,
                            from: e.source,
                            to: e.target,
                            role: role
                          };
                        })
                      };
                      
                      return (
                        <div className="h-[600px] bg-white rounded-lg border border-slate-200">
                          <AifDiagramViewerDagre
                            initialGraph={aifGraph}
                            layoutPreset="compact"
                            deliberationId={deliberationId}
                            onNodeClick={(nodeId) => {
                              console.log('Dialogue node clicked:', nodeId);
                            }}
                            className="w-full h-full"
                          />
                        </div>
                      );
                    }}
                  />
                </div>
              )}
            </div>

              {/* Command Card (if claim selected) */}
              {/* Dialogical Actions */}
     

          </>
        ) : (
          <>
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-2">
                Claim Graph (CEG)
              </h3>
              <p className="text-xs text-slate-500 mb-3">
                Dialectical structure with grounded semantics
              </p>
                           <div className="rounded-lg overflow-hidden">
                <CegMiniMap
                  deliberationId={deliberationId}
                  selectedClaimId={selectedClaim?.id}
                  onSelectClaim={handleClaimSelect}
                  width={800}
                  height={320}
                  
                  viewMode="graph"
                />
              </div>

            </div>
          </>
        )}

          {/* Selected Claim Info */}
        {/* Selected Claim Info - FIXED VERSION */}
          {selectedClaim?.id && (
          <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
              Selected Claim
            </h3>
            
            {claimLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
                <span>Loading claim...</span>
              </div>
            ) : claimError ? (
              <div className="text-sm text-red-600">
                Error: {String(claimError)}
              </div>
            ) : claimData ? (
              <>
                {/* Claim Text */}
                <div className="text-sm text-slate-700 mb-3 leading-relaxed">
                  {claimData.text}
                </div>

                {/* Claim Metadata */}
                <div className="space-y-2 text-xs">
                  {/* Status Badge */}
                  {claimData.label && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500">Status:</span>
                      <span className={clsx(
                        'px-2 py-0.5 rounded-full font-medium',
                        claimData.label === 'IN' && 'bg-green-100 text-green-700',
                        claimData.label === 'OUT' && 'bg-red-100 text-red-700',
                        claimData.label === 'UNDEC' && 'bg-gray-100 text-gray-700'
                      )}>
                        {claimData.label}
                      </span>
                    </div>
                  )}

                  {/* Confidence */}
                  {claimData.confidence != null && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500">Confidence:</span>
                      <div className="flex items-center gap-1">
                        <div className="w-20 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-indigo-500 rounded-full"
                            style={{ width: `${claimData.confidence * 100}%` }}
                          />
                        </div>
                        <span className="text-slate-700 font-medium">
                          {(claimData.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Stats */}
                  <div className="flex items-center gap-3 pt-2 border-t border-slate-200">
                    {claimData._count?.supports != null && (
                      <div className="flex items-center gap-1">
                        <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-slate-600">{claimData._count.supports} support</span>
                      </div>
                    )}
                    {claimData._count?.rebuttals != null && (
                      <div className="flex items-center gap-1">
                        <svg className="w-3 h-3 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        <span className="text-slate-600">{claimData._count.rebuttals} attack</span>
                      </div>
                    )}
                  </div>

                  {/* ID */}
                  <div className="flex items-center gap-2 pt-2">
                    <span className="text-slate-400">ID:</span>
                    <code className="text-[10px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                      {selectedClaim.id.slice(0, 12)}...
                    </code>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-sm text-slate-500">
                No claim selected
              </div>
            )}
          </div>
        )}
      </FloatingSheet>

      {/* Right Floating Sheet - Actions & Diagram (Conditional) */}
      {selectedArgumentForActions ? (
        <ArgumentActionsSheet
          open={sheets.right}
          onOpenChange={sheetActions.setRight}
          deliberationId={deliberationId}
          authorId={authorId || ""}
          currentUserId={currentUserId}
          selectedArgument={selectedArgumentForActions}
          onRefresh={() => {
            // Increment refresh counter to force AIFArgumentsListPro revalidation
            delibActions.triggerRefresh();
          }}
        />
      ) : (
        <FloatingSheet
          open={sheets.right}
          onOpenChange={sheetActions.setRight}
          side="right"
          width={650}
          title="Actions & Diagram"
          subtitle={hudTarget ? 'Available moves' : 'Select a claim'}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          }
        >
        {/* Dialogical Actions */}
        <div className="mb-6 w-full">
          <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
            Dialogical Actions
          </h3>
          {hudTarget ? (
            <div className="space-y-3">
              {/* Selected Target Info */}
              <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-200">
                <div className="text-xs font-medium text-indigo-900 mb-1">Selected Target</div>
                <div className="text-xs text-indigo-700">
                  {hudTarget.type === "claim" ? "Claim" : "Argument"}: {hudTarget.id.slice(0, 12)}...
                </div>
              </div>
              
              {/* Dialogue Actions Button */}
              <DialogueActionsButton
                deliberationId={deliberationId}
                targetType={hudTarget.type as any}
                targetId={hudTarget.id}
                locusPath="0"
                label="Open Dialogue Actions"
                variant="default"
                className="w-full justify-center"
                onMovePerformed={() => {
                  // Refresh the graph and moves
                  swrMutate(`/api/dialogue/legal-moves?deliberationId=${deliberationId}&targetType=${hudTarget.type}&targetId=${hudTarget.id}&locus=0`);
                  window.dispatchEvent(new CustomEvent("dialogue:moves:refresh", { detail: { deliberationId } }));
                }}
              />
              
              {/* Legacy CommandCard - Keep for comparison */}
              <details className="group">
                <summary className="cursor-pointer text-xs text-slate-600 hover:text-slate-900 font-medium">
                  Show Legacy Grid View
                </summary>
                <div className="mt-3">
                  {cardActions.length > 0 ? (
                    <CommandCard
                      actions={cardActions}
                      onPerform={performCommand}
                    />
                  ) : (
                    <div className="text-xs text-slate-500 text-center py-4">
                      No actions available
                    </div>
                  )}
                </div>
              </details>
            </div>
          ) : (
            <div className="rounded-xl border-2 border-dashed border-slate-200 p-8 text-center">
              <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
              </svg>
              <div className="text-sm text-slate-600 font-medium mb-1">
                No claim selected
              </div>
              <div className="text-xs text-slate-500">
                Click a claim in the graph or debate to see available actions
              </div>
            </div>
          )}
        </div>

        {/* Diagram Viewer */}
         {/* Diagram Viewer - UPDATED */}
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            AIF Structure Diagram
          </h3>
          
          {claimLoading ? (
            <div className="h-[500px] rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-2"></div>
                <div className="text-sm text-slate-600">Loading claim...</div>
              </div>
            </div>
          ) : claimError ? (
            <div className="h-[500px] rounded-xl border border-red-200 bg-red-50 flex items-center justify-center">
              <div className="text-center p-4">
                <svg className="w-12 h-12 text-red-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="text-sm text-red-900 font-medium mb-1">Failed to load</div>
                <div className="text-xs text-red-700">{String(claimError)}</div>
              </div>
            </div>
          ) : !claimData?.topArgumentId ? (
            <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-8 text-center">
              <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <div className="text-sm text-slate-600 font-medium mb-1">
                No structured argument
              </div>
              <div className="text-xs text-slate-500">
                This claim doesn&apos;t have an AIF diagram yet
              </div>
            </div>
          ) : diagLoading ? (
            <div className="h-[500px] rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-2"></div>
                <div className="text-sm text-slate-600">Loading diagram...</div>
              </div>
            </div>
          ) : diagError ? (
            <div className="h-[500px] rounded-xl border border-red-200 bg-red-50 flex items-center justify-center">
              <div className="text-center p-4">
                <svg className="w-12 h-12 text-red-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="text-sm text-red-900 font-medium mb-1">Failed to load diagram</div>
                <div className="text-xs text-red-700">{String(diagError)}</div>
              </div>
            </div>
          ) : (diag?.diagram?.aif ?? diag?.aif) ? (
            <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm">
              <DiagramViewer
                graph={diag?.diagram?.aif ?? diag?.aif}
                selectedNodeId={selectedClaim?.id}
                onNodeClick={handleNodeClick}
                height={500}
              />

              {/* Diagram Legend */}
              <div className="bg-slate-50 px-4 py-3 border-t border-slate-200">
                <div className="flex flex-wrap gap-3 text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-0.5 bg-slate-500" />
                    <span className="text-slate-600">Premise</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-0.5 bg-emerald-600" />
                    <span className="text-slate-600">Conclusion</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-0.5 bg-red-500" />
                    <span className="text-slate-600">Conflict</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-0.5 bg-violet-500 border-dashed border-t-2" />
                    <span className="text-slate-600">Preference</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border-2 border-dashed border-slate-200 p-8 text-center">
              <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <div className="text-xs text-slate-500">
                Select a claim to view its argument diagram
              </div>
            </div>
          )}
        </div>
        </FloatingSheet>
      )}

      {/* Terms Glossary Sheet */}
      <FloatingSheet
        open={sheets.terms}
        onOpenChange={sheetActions.setTerms}
        side="right"
        width={1000}
        title="Deliberation Dictionary"
        
        variant="glass-dark"
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        }
      >
        <DefinitionSheet deliberationId={deliberationId} />
      </FloatingSheet>

      {/* Main Content - Full Width, No Columns */}
      <div className="w-full px-4 pt-1 pb-6 max-w-7xl mx-auto space-y-4">
        {/* Sticky Header */}
        <StickyHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {delibState.status && <StatusChip status={delibState.status} />}

              {/* <ChipBar>
                <label className="text-xs text-neutral-600 flex items-center gap-1">
                  Rule:
                  <select
                    className="text-xs menuv2--lite rounded px-2 py-0.5"
                    value={delibState.rule}
                    onChange={(e) => {
                      delibActions.setRule(e.target.value as any);
                      compute(e.target.value as any);
                    }}
                  >
                    <option value="utilitarian">Utilitarian</option>
                    <option value="harmonic">Harmonic</option>
                    <option value="maxcov">MaxCov</option>
                  </select>
                </label>
              </ChipBar> */}

              {/* <ChipBar>
                <label className="text-xs text-neutral-600 flex items-center gap-1">
                  Confidence:
                  <select
                    className="text-xs menuv2--lite rounded px-2 py-0.5"
                    value={delibState.confMode}
                    onChange={(e) => delibActions.setConfMode(e.target.value as any)}
                  >
                    <option value="product">Product</option>
                    <option value="min">Min</option>
                  </select>
                </label>
              </ChipBar> */}

              {/* Phase 3: DS Mode Toggle */}
            
                {/* <button
                  onClick={delibActions.toggleDsMode}
                  className={`
                    text-xs px-3 py-.5 rounded-md menuv2--lite transition-all duration-200
                    ${delibState.dsMode 
                      ? 'bg-indigo-100 border-indigo-300 text-indigo-700 hover:bg-indigo-200' 
                      : 'bg-slate-100 border-slate-300 text-slate-600 hover:bg-slate-200'
                    }
                  `}
                  title="Toggle Dempster-Shafer interval mode"
                >
                  DS Mode: {delibState.dsMode ? 'ON' : 'OFF'}
                </button> */}
             
             
                {/* <button
                  onClick={delibActions.toggleDelibSettings}
                  className={`
                    text-xs px-3 py-.5 rounded-md menuv2--lite transition-all duration-200
                    ${delibState.delibSettingsOpen 
                      ? 'bg-indigo-100 border-indigo-300 text-indigo-700 hover:bg-indigo-200' 
                      : 'bg-slate-100 border-slate-300 text-slate-600 hover:bg-slate-200'
                    }
                  `}
                  title="Toggle Deliberation Settings Panel"
                >
                  Settings: {delibState.delibSettingsOpen ? 'HIDE' : 'SHOW'}
                </button> */}
             
            </div>

            <div className="flex gap-3">
              <Link href="/admin/schemes" target="_blank">
                <button
                 
                  className="flex  px-4 py-.5 items-center btnv2--ghost  bg-white rounded-full  h-8 text-xs text-slate-800 "
                  title="Manage Argumentation Schemes"
                >

                <span className="flex items-center">Configure Argument Schemes</span>
              </button>
            </Link>
            
            {/* Dialogue Timeline Button - Week 4 Task 4.3 */}
            <Link href={`/deliberation/${deliberationId}/dialoguetimeline`} target="_blank" rel="noopener noreferrer">
              <button
                className="flex  px-4 py-.5 items-center btnv2--ghost  bg-white rounded-full  h-8 text-xs text-slate-800 "
                title="Open Dialogue Timeline in new tab"
              >
                {/* <MessageSquare className="w-4 h-4" /> */}
                <span>Dialogue Timeline</span>
              </button>
            </Link>

            {/* Link to Agora*/}
            <Link href={`/agora`} target="_blank" rel="noopener noreferrer">
              <button
                className="flex  px-4 py-.5 items-center btnv2--ghost  bg-white rounded-full  h-8 text-xs text-slate-800 "
                title="Open Agora in new tab"
              >
                {/* <MessageSquare className="w-4 h-4" /> */}
                <span>Agora</span>
              </button>
            </Link>

            {/* Deliberation Settings (visibility + moderators) */}
            <button
              onClick={() => setSettingsOpen(true)}
              className="flex px-3 py-.5 items-center gap-1.5 btnv2--ghost bg-white rounded-full h-8 text-xs text-slate-800"
              title="Deliberation settings"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Settings</span>
            </button>

            {/* <DiscusHelpPage /> */}
            {delibState.pending && <div className="text-xs text-neutral-500">Computing…</div>}
          </div>
        </div>
      </StickyHeader>

        {/* AI-EPI Pt. 4 §6 — Deliberation-scope honesty floor card. */}
        <div className="w-full mb-3">
          <DeliberationStateCard
            deliberationId={deliberationId}
            onSeekTab={(tab) => delibActions.setTab(tab as any)}
          />
        </div>

        {/* Main Tabs */}
        <Tabs value={delibState.tab} onValueChange={(v) => delibActions.setTab(v as any)}>
                  <div className="flex w-full items-center justify-center mx-auto">

          <TabsList className="w-full  items-center justify-center flex flex-1 mb-2">
            <TabsTrigger value="debate">Debate</TabsTrigger>
            <TabsTrigger value="frontier">Frontier</TabsTrigger>
            <TabsTrigger value="arguments">Arguments</TabsTrigger>
            {/* Dialogue tab removed - Week 4 Task 4.3: Access via "Dialogue Timeline" button in header */}
            <TabsTrigger value="chains">Chains</TabsTrigger>
            <TabsTrigger value="ludics">Ludics</TabsTrigger>
            <TabsTrigger value="admin">Admin</TabsTrigger>
            <TabsTrigger value="sources">Sources</TabsTrigger>
            <TabsTrigger value="thesis">Thesis</TabsTrigger>
            {/* ASPIC moved to Arguments → ASPIC nested tab (Week 2 Task 2.5) */}
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="cross">Cross</TabsTrigger>
            <TabsTrigger value="pathways">Pathways</TabsTrigger>
          </TabsList>
          </div>

          {/* DEBATE TAB */}
          <TabsContent value="debate" >
            <DebateTab
              deliberationId={deliberationId}
              currentUserId={currentUserId}
              delibSettingsOpen={delibState.delibSettingsOpen}
              selectedClaimId={selectedClaim?.id}
              onClaimClick={handleClaimSelect}
              onTabChange={delibActions.setTab}
            />
          </TabsContent>

          {/* MODELS TAB */}
          <TabsContent value="arguments">
            <ArgumentsTab
              deliberationId={deliberationId}
              authorId={authorId || ""}
              refreshCounter={delibState.refreshCounter}
              dsMode={delibState.dsMode}
              onArgumentClick={(argument) => {
                setSelectedArgumentForActions(argument);
              }}
              onViewDialogueMove={(moveId, delibId) => {
                delibActions.setHighlightedDialogueMoveId(moveId);
                delibActions.setTab("dialogue");
              }}
              onVisibleTextsChanged={(texts) => {
                // Event dispatch is handled inside ArgumentsTab
              }}
              onTabChange={delibActions.setTab}
              setHighlightedDialogueMoveId={delibActions.setHighlightedDialogueMoveId}
            />
          </TabsContent>

          {/* CHAINS TAB - Task 1.7: Argument chains */}
          <TabsContent value="chains" className="w-full min-w-0 space-y-4 mt-4">
            <ChainsTab
              deliberationId={deliberationId}
              currentUserId={currentUserId}
              onTabChange={delibActions.setTab}
            />
          </TabsContent>

          {/* FRONTIER TAB — AI-EPI Pt. 4 §6. Each card prefills the composer
              with a structured `mesh:openComposer` event. */}
          <TabsContent value="frontier" className="w-full min-w-0 space-y-4 mt-4">
            <FrontierLane deliberationId={deliberationId} />
          </TabsContent>

          {/* DIALOGUE TAB - Phase 3: Dialogue Visualization */}
          {/* DIALOGUE TAB - REMOVED Week 4 Task 4.3
           * Dialogue Timeline now accessible via header button → opens left sheet
           * Graph visualization removed (not essential for current workflow)
           * See "Dialogue Timeline" button in StickyHeader above
           */}
          {/* <TabsContent value="dialogue" className="w-full min-w-0 space-y-4 mt-4">
            <SectionCard title="Dialogue Visualization" className="w-full" padded={true}>
              <div className="space-y-4">
                <p className="text-sm text-slate-600">
                  Explore the dialogue structure and argumentation moves in this deliberation.
                  Toggle dialogue layers, filter by move types, and see how arguments were created through dialogue.
                </p>
                <div className="flex w-full h-fit items-center justify-center px-3 py-2 border rounded-lg panel-edge">
                
                  <a
                    className="flex px-8 py-4 w-fit items-center text-base tracking-wide  text-center  rounded-full cardv2 bg-indigo-100/50"
                    href={`/deliberation/${deliberationId}/dialoguetimeline`} target="_blank" rel="noopener noreferrer"
                  >
                    <GalleryVerticalEnd className="w-5 h-5 mr-3 text-indigo-700" />
                    Dialogue Timeline 
                  </a>
                </div>
                <div className="min-h-[600px]">
                  <DialogueAwareGraphPanel
                    deliberationId={deliberationId}
                    initialShowDialogue={true}
                    highlightMoveId={delibState.highlightedDialogueMoveId}
                    className="w-full"
                    renderGraph={(nodes, edges) => {
                      const aifGraph = {
                        nodes: nodes.map(n => ({
                          id: n.id,
                          kind: (n.nodeKind === 'I' ? 'I' : 
                                 n.nodeKind === 'RA' ? 'RA' : 
                                 n.nodeKind === 'CA' ? 'CA' : 
                                 n.nodeKind === 'PA' ? 'PA' : 'I') as 'I' | 'RA' | 'CA' | 'PA',
                          label: n.text || n.id,
                          schemeKey: null,
                          schemeName: null,
                          cqStatus: null,
                          dialogueMoveId: n.dialogueMove?.id || null,
                          locutionType: n.dialogueMetadata?.locution || null,
                          isImported: false,
                          importedFrom: null,
                          toulminDepth: null
                        })),
                        edges: edges.map(e => {
                          // Map edgeType to AIF role based on source/target node types
                          let role: 'premise' | 'conclusion' | 'conflictingElement' | 'conflictedElement' | 'preferredElement' | 'dispreferredElement' | 'has-presumption' | 'has-exception' = 'premise';
                          
                          if (e.edgeType === 'inference') {
                            // I → RA = premise, RA → I = conclusion
                            if (e.source.startsWith('I:') && e.target.startsWith('RA:')) {
                              role = 'premise';
                            } else if (e.source.startsWith('RA:') && e.target.startsWith('I:')) {
                              role = 'conclusion';
                            }
                          } else if (e.edgeType === 'conflict') {
                            // Attacker → CA = conflictingElement, CA → Target = conflictedElement
                            if (e.target.startsWith('CA:')) {
                              role = 'conflictingElement';
                            } else if (e.source.startsWith('CA:')) {
                              role = 'conflictedElement';
                            }
                          } else if (e.edgeType === 'supports') {
                            // Support edges shown as preferredElement (purple dashed)
                            role = 'preferredElement';
                          }
                          
                          return {
                            id: e.id || `${e.source}-${e.target}`,
                            from: e.source,
                            to: e.target,
                            role: role
                          };
                        })
                      };
                      
                      return (
                        <div className="h-[600px] bg-white rounded-lg border border-slate-200">
                          <AifDiagramViewerDagre
                            initialGraph={aifGraph}
                            layoutPreset="standard"
                            deliberationId={deliberationId}
                            onNodeClick={(nodeId) => {
                              console.log('Dialogue node clicked:', nodeId);
                            }}
                            className="w-full h-full"
                          />
                        </div>
                      );
                    }}
                  />
                </div>
              </div>
            </SectionCard>
          </TabsContent> */}

          {/* LUDICS TAB */}
          <TabsContent value="ludics" className="w-full min-w-0 space-y-4">
            {/* Always show LudicsPanel so users can access the Compile button */}
            <LudicsPanel
              deliberationId={deliberationId}
              proDesignId={proId}
              oppDesignId={oppId}
            />
            
            {/* Only show Behaviour Inspector when designs are ready */}
            {ludicsReady && (
              <SectionCard title="Behaviour Inspector">
                <BehaviourInspectorCard deliberationId={deliberationId} />
              </SectionCard>
            )}
          </TabsContent>

          {/* CARDS TAB
          <TabsContent value="cards" className="space-y-4">
            <SectionCard
              title="Cards"
              action={
                <div className="flex gap-2">
                  <button
                    className={clsx("px-3 py-1 text-xs rounded", delibState.cardFilter === 'all' ? "bg-slate-200" : "bg-slate-100")}
                    onClick={() => delibActions.setCardFilter('all')}
                  >
                    All
                  </button>
                  <button
                    className={clsx("px-3 py-1 text-xs rounded", delibState.cardFilter === 'mine' ? "bg-slate-200" : "bg-slate-100")}
                    onClick={() => delibActions.setCardFilter('mine')}
                  >
                    Mine
                  </button>
                  <button
                    className={clsx("px-3 py-1 text-xs rounded", delibState.cardFilter === 'published' ? "bg-slate-200" : "bg-slate-100")}
                    onClick={() => delibActions.setCardFilter('published')}
                  >
                    Published
                  </button>
                </div>
              }
            >
              {delibState.cardFilter === 'all' && (
                <CardListVirtuoso
                  deliberationId={deliberationId}
                  filters={{
                    status: 'published',
                    authorId,
                    since: '2025-08-01T00:00:00Z',
                    sort: 'createdAt:desc',
                  }}
                />
              )}
              {delibState.cardFilter === 'mine' && (
                <CardListVirtuoso
                  deliberationId={deliberationId}
                  filters={{
                    authorId,
                    sort: 'createdAt:desc',
                  }}
                />
              )}
              {delibState.cardFilter === 'published' && (
                <CardListVirtuoso
                  deliberationId={deliberationId}
                  filters={{
                    status: 'published',
                    sort: 'createdAt:desc',
                  }}
                />
              )}
            </SectionCard>

            <SectionCard title="Create Card">
              <CardComposerTab deliberationId={deliberationId} />
            </SectionCard>
          </TabsContent> */}

          {/* ISSUES TAB */}
          <TabsContent value="admin" className="w-full min-w-0 h-screen space-y-4">
            
            {/* Discourse Dashboard */}
            <SectionCard title="Discourse Dashboard">
              <div className="text-sm text-neutral-600 mb-3">
                Track your contributions, engagements, and actions taken on your work. 
                Respond to challenges and attacks directly from this dashboard.
              </div>
              <DiscourseDashboard 
                deliberationId={deliberationId} 
                userId={currentUserId || authorId || ""} 
              />
            </SectionCard>

            <SectionCard
              title="Issues & Objections"
              action={
                <button
                  className="px-3 py-2 btnv2 text-xs bg-slate-100 hover:bg-slate-200 rounded-lg"
                  onClick={() => {
                    setIssueTargetId(null);
                    setComposerOpen(true);
                  }}
                >
                  New Issue
                </button>
              }
            >
              <div className="text-sm text-neutral-600 mb-3">
                Track formal objections and disputes about contributions
              </div>
       {/* <button
  className="w-full px-4 py-3 text-left border rounded-lg  hover:bg-slate-50"
  onClick={() => setIssuesOpen(true)}
>
  <div className="font-medium text-sm">View All Issues</div>
  <div className="text-xs text-neutral-500 mt-1">
    See objections, ambiguities, and formal challenges
  </div>
</button> */}
<div className="flex w-full">
<IssuesList
    deliberationId={deliberationId}
    currentUserId={currentUserId}
  />
  </div>
{/* 
       <IssuesDrawer
  deliberationId={deliberationId}
  open={issuesOpen}
  onOpenChange={setIssuesOpen}
  argumentId={issueTargetId ?? undefined}
/> */}

<IssueComposer
  deliberationId={deliberationId}
  initialArgumentId={issueTargetId ?? undefined}
 open={composerOpen}
 onOpenChange={setComposerOpen}
  onCreated={() => {
   setComposerOpen(false);
    window.dispatchEvent(new CustomEvent('issues:refresh', { detail: { deliberationId } }));
  }}
/>
            </SectionCard>
            <div className="p-6 bg-gradient-to-br from-sky-50 to-cyan-50 rounded-xl border-2 border-sky-200 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-sky-500/20 to-cyan-500/20">
                  <MessageSquare className="w-6 h-6 text-sky-700" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-sky-900 mb-2">
                    Critical Question Review Dashboard
                  </h3>
                  <p className="text-sm text-sky-700 leading-relaxed mb-4">
                    Review and moderate community responses to critical questions across all claims and arguments in this deliberation.
                  </p>
                  
                  <div className="bg-white/80 rounded-lg p-4 border border-sky-300">
                    <h4 className="text-sm font-semibold text-sky-900 mb-2">How to Review Responses:</h4>
                    <ul className="text-sm text-sky-700 space-y-2">
                      <li className="flex items-start gap-2">
                        <span className="text-sky-500 font-bold">1.</span>
                        <span>Navigate to the <strong>Debate tab</strong> to see all claims and arguments</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-sky-500 font-bold">2.</span>
                        <span>Click on a <strong>claim card</strong> to expand its critical questions</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-sky-500 font-bold">3.</span>
                        <span>For arguments, click the <strong>Critical Questions button</strong> to view scheme-specific questions</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-sky-500 font-bold">4.</span>
                        <span>Each CQ shows buttons to <strong>View Responses</strong> where you can approve/reject as a moderator</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-sky-500 font-bold">5.</span>
                        <span>Use the <strong>Activity Timeline</strong> to track all actions taken on responses</span>
                      </li>
                    </ul>
                  </div>

                  <div className="mt-4 p-3 bg-indigo-100 rounded-lg border border-indigo-300">
                    <p className="text-xs text-indigo-800 leading-relaxed">
                      💡 <strong>Tip:</strong> Moderators see Approve/Reject buttons in the response lists. 
                      Regular users can view responses, vote, and endorse them.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Future: Add deliberation-wide pending responses aggregator here */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center">
              <p className="text-sm text-slate-600">
                Deliberation-wide response aggregation coming soon. 
                For now, review responses within individual claims and arguments in the Debate tab.
              </p>
            </div>
             <SectionCard title="Create Assumption">
              <CreateAssumptionForm deliberationId={deliberationId} />
            </SectionCard>
            
            <SectionCard title="Active Assumptions">
              <ActiveAssumptionsPanel deliberationId={deliberationId} />
            </SectionCard>
            
          </TabsContent>

          {/* Sources TAB */}
          <TabsContent value="sources" className="w-full min-w-0 mt-4 space-y-4">
            {/* Browse Citations - Phase 2.4 */}
            <SectionCard
              title="Browse Citations"
              action={
                <div className="text-xs text-neutral-500">
                  Filter and search all citations by intent, source type, or content
                </div>
              }
            >
              <DeliberationEvidencePanel deliberationId={deliberationId} />
            </SectionCard>

            {/* Aggregated Sources View */}
            <SectionCard
              title="Source Quality Ratings"
              action={
                <div className="text-xs text-neutral-500">
                  Community-evaluated sources used across arguments and claims
                </div>
              }
            >
              <div className="text-sm text-neutral-600 mb-4">
                All sources referenced in this deliberation. Rate sources to help the community evaluate evidence quality.
              </div>
              <EvidenceList deliberationId={deliberationId} />
            </SectionCard>
          </TabsContent>

          {/* THESIS TAB */}
          <TabsContent value="thesis" className="w-full min-w-0 mt-4 space-y-4">
            <SectionCard
              title="Thesis Documents"
              action={
                <a
                  className="px-3 py-2  text-xs  rounded-full cardv2 bg-indigo-100/50"
                  href={`/deliberations/${deliberationId}/thesis/new`} target="_blank" rel="noopener noreferrer"
                >
                  Create Thesis
                </a>
               
              }
            >
              <div className="text-sm text-neutral-600 mb-3">
                Build structured legal-style arguments that compose claims and arguments into cohesive theses
              </div>
              <ThesisListView
                deliberationId={deliberationId}
                onEdit={(id) => {
                  setSelectedThesisId(id);
                  setThesisComposerOpen(true);
                }}
                onView={(id) => {
                  setViewedThesisId(id);
                  setThesisViewerOpen(true);
                }}
              />
            </SectionCard>

            {/* Thesis Composer Modal */}
            {thesisComposerOpen && (
              <ThesisComposer
                deliberationId={deliberationId}
                authorId={authorId || ''}
                thesisId={selectedThesisId || undefined}
                onClose={() => {
                  setThesisComposerOpen(false);
                  setSelectedThesisId(null);
                  // Refresh thesis list
                  swrMutate(`/api/thesis?deliberationId=${deliberationId}`);
                }}
              />
            )}

            {/* Thesis Viewer Modal */}
            {thesisViewerOpen && viewedThesisId && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto m-4">
                  <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center">
                    <h2 className="text-lg font-semibold">Thesis View</h2>
                    <button
                      onClick={() => {
                        setThesisViewerOpen(false);
                        setViewedThesisId(null);
                      }}
                      className="px-3 py-1 text-sm rounded hover:bg-slate-100"
                    >
                      Close
                    </button>
                  </div>
                  <div className="p-6">
                    <ThesisRenderer thesisId={viewedThesisId} />
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ASPIC TAB  */}
          {/* ASPIC TAB - Migrated to Arguments → ASPIC nested tab (Week 2 Task 2.5) */}
          {/* <TabsContent value="aspic" className="w-full min-w-0 mt-4 space-y-4">
            <AspicTheoryPanel deliberationId={deliberationId} />
          </TabsContent> */}

          {/* HOM-SETS TAB - Phase 3 Integration */}
          <TabsContent value="analytics" className="w-full min-w-0 mt-4 space-y-4">
            <AnalyticsTab 
              deliberationId={deliberationId}
              currentUserId={authorId}
            />
          </TabsContent>

          {/* CROSS-DELIBERATION TAB - Phase 3.3 */}
          <TabsContent value="cross" className="w-full min-w-0 mt-4 space-y-4">
            <CrossDeliberationTab
              deliberationId={deliberationId}
              currentUserId={currentUserId}
            />
          </TabsContent>

          <TabsContent value="pathways" className="w-full min-w-0 mt-4 space-y-4">
            <DeliberationPathwaysTab deliberationId={deliberationId} />
          </TabsContent>
        </Tabs>
      </div>
    </ConfidenceProvider>
  );

  // Show main content immediately - ludics designs only needed for Ludics tab
  return containerClassName
    ? <div className={clsx(containerClassName)}>{inner}</div>
    : inner;
}