"use client";

import React, { useState, useEffect } from "react";
import { NestedTabs } from "@/components/deepdive/shared/NestedTabs";
import { List, Network, GitFork, Shield, Plus, Workflow, PlusCircle } from "lucide-react";
import { SectionCard } from "@/components/deepdive/shared";
import AIFArgumentsListPro from "@/components/arguments/AIFArgumentsListPro";
import { SchemesSection } from "../sections/SchemesSection";
import { NetworksSection } from "../sections/NetworksSection";
import { AspicTheoryPanel } from "@/components/aspic/AspicTheoryPanel";
import { ConflictResolutionPanel } from "@/components/aspic/ConflictResolutionPanel";
import { ArgumentNetAnalyzer } from "@/components/argumentation/ArgumentNetAnalyzer";
import { AttackSuggestions } from "@/components/argumentation/AttackSuggestions";
import { AttackArgumentWizard } from "@/components/argumentation/AttackArgumentWizard";
import { AIFArgumentWithSchemeComposer } from "@/components/arguments/AIFArgumentWithSchemeComposer";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { AttackSuggestion } from "@/app/server/services/ArgumentGenerationService";
import { getUserFromCookies } from "@/lib/server/getUser";
import { NetsTab } from "@/components/nets/NetsTab";
import type { DeliberationTab } from "../hooks/useDeliberationState";

interface ArgumentsTabProps {
  deliberationId: string;
  authorId: string;
  refreshCounter: number;
  dsMode?: boolean;
  onArgumentClick?: (argument: any) => void;
  onViewDialogueMove?: (moveId: string, delibId: string) => void;
  onVisibleTextsChanged?: (texts: string[]) => void;
  onTabChange?: (tab: DeliberationTab) => void;
  setHighlightedDialogueMoveId?: (id: string | null) => void;
}

/**
 * ArgumentsTab - Refactored with nested tabs structure
 * 
 * Structure:
 * - List: All arguments (existing AIFArgumentsListPro)
 * - Create: Build new arguments (AIFArgumentWithSchemeComposer integration)
 * - Schemes: Browse detected schemes (Phase 1 integration)
 * - Networks: Explore multi-scheme nets (Phase 4 integration)
 * - ASPIC: ASPIC theory analysis (migrated from parent tab)
 * 
 * Week 5 Enhancement:
 * - ArgumentNetAnalyzer integration for multi-scheme net analysis
 * Week 6 Enhancement:
 * - AttackArgumentWizard integration for CQ-based attacks
 * - AIFArgumentWithSchemeComposer for general argument creation (simplified from ArgumentConstructor)
 */
export function ArgumentsTab({
  deliberationId,
  authorId,
  refreshCounter,
  dsMode,
  onArgumentClick,
  onViewDialogueMove,
  onVisibleTextsChanged,
  onTabChange,
  setHighlightedDialogueMoveId,
}: ArgumentsTabProps) {
  // Week 6 Task 6.1: Fetch current user ID for attack generation
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  useEffect(() => {
    getUserFromCookies()
      .then((u) => {
        const userId = u?.userId != null ? String(u.userId) : null;
        console.log("[ArgumentsTab] Fetched current user:", { userId, rawUser: u });
        setCurrentUserId(userId);
      })
      .catch((err) => {
        console.error("[ArgumentsTab] Failed to fetch current user:", err);
        setCurrentUserId(null);
      });
  }, []);

  // Week 5 Task 5.1: ArgumentNetAnalyzer state
  const [netAnalyzerOpen, setNetAnalyzerOpen] = useState(false);
  const [selectedArgumentId, setSelectedArgumentId] = useState<string | null>(null);

  // Week 6 Task 6.1: Attack generation state
  const [attackTargetId, setAttackTargetId] = useState<string | null>(null); // This will be the argumentId
  const [attackTargetClaimId, setAttackTargetClaimId] = useState<string | null>(null); // Conclusion claimId
  const [selectedAttack, setSelectedAttack] = useState<AttackSuggestion | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [attackRefreshKey, setAttackRefreshKey] = useState(0);

  return (
    <>
      <NestedTabs
        id={`arguments-${deliberationId}`}
        defaultValue="list"
        variant="secondary"
        tabs={[
          {
            value: "list",
            label: "All Arguments",
            icon: <List className="size-3.5" />,
            content: (
              <SectionCard 
                title="Arguments List (Argument Interchange Format)" 
                className="w-full" 
                padded={true}
              >
                <AIFArgumentsListPro
                  key={refreshCounter}
                  deliberationId={deliberationId}
                  onVisibleTextsChanged={(texts) => {
                    onVisibleTextsChanged?.(texts);
                    if (typeof window !== "undefined") {
                      window.dispatchEvent(
                        new CustomEvent("mesh:texts:visible", {
                          detail: { deliberationId, texts },
                        })
                      );
                    }
                  }}
                  dsMode={dsMode}
                  onArgumentClick={(argument) => {
                    onArgumentClick?.(argument);
                  }}
                  onViewDialogueMove={(moveId, delibId) => {
                    setHighlightedDialogueMoveId?.(moveId);
                    onTabChange?.("dialogue");
                  }}
                  onAnalyzeArgument={(argId) => {
                    // Week 5 Task 5.1: Open ArgumentNetAnalyzer for this argument
                    setSelectedArgumentId(argId);
                    setNetAnalyzerOpen(true);
                  }}
                  onGenerateAttack={(argId, claimId) => {
                    // Week 6 Task 6.1: Open attack generation for this argument
                    setAttackTargetId(argId);
                    setAttackTargetClaimId(claimId);
                  }}
                />
                <span className="block mt-2 text-xs text-neutral-500">
                  Note: This list shows all structured arguments in the deliberation&apos;s AIF database. 
                  Some arguments may not yet be linked to claims in the debate.
                </span>
              </SectionCard>
            ),
          },
          {
            value: "create",
            label: "Create Argument",
            icon: <PlusCircle className="size-3.5" />,
            content: (
              <SectionCard 
                title="Build New Argument" 
                className="w-full" 
                padded={true}
              >
                <div className="mb-4 text-sm text-muted-foreground">
                  Construct a new argument using argumentation schemes. Your argument will be validated against
                  critical questions and integrated with AIF, ASPIC+, and dialogue systems.
                </div>
                {(authorId || currentUserId) ? (
                  <AIFArgumentWithSchemeComposer
                    deliberationId={deliberationId}
                    authorId={(authorId || currentUserId)!}
                    conclusionClaim={null}
                    onCreated={(argumentId) => {
                      console.log("[ArgumentsTab] Argument created:", argumentId);
                      // Refresh arguments list and switch to list tab
                      setAttackRefreshKey((prev) => prev + 1);
                      // TODO: Switch to list tab and scroll to new argument
                    }}
                  />
                ) : (
                  <div className="p-6 text-center text-muted-foreground">
                    Loading user session...
                  </div>
                )}
              </SectionCard>
            ),
          },
          {
            value: "schemes",
            label: "Schemes",
            icon: <Network className="size-3.5" />,
            // TODO: Add badge with scheme count
            content: <SchemesSection deliberationId={deliberationId} />,
          },
          {
            value: "networks",
            label: "Networks",
            icon: <GitFork className="size-3.5" />,
            // TODO: Add badge with net count
            content: <NetworksSection deliberationId={deliberationId} />,
          },
          {
            value: "create-net",
            label: "Create Argument Net",
            icon: <Workflow className="size-3.5" />,
            content: (
              <SectionCard 
                title="Argument Nets" 
                className="w-full" 
                padded={false}
              >
                <NetsTab deliberationId={deliberationId} />
              </SectionCard>
            ),
          },
          {
            value: "aspic",
            label: "ASPIC",
            icon: <Shield className="size-3.5" />,
            content: (
              <div className="space-y-6">
                <ConflictResolutionPanel 
                  deliberationId={deliberationId}
                  onResolved={() => {
                    // Refresh ASPIC theory after conflicts resolved
                    setAttackRefreshKey((prev) => prev + 1);
                  }}
                />
                <AspicTheoryPanel 
                  deliberationId={deliberationId}
                  key={attackRefreshKey}
                />
              </div>
            ),
          },
        ]}
      />

      {/* Week 5 Task 5.1: ArgumentNetAnalyzer Dialog */}
      <Dialog open={netAnalyzerOpen} onOpenChange={setNetAnalyzerOpen}>
        <DialogContent className="max-w-[80vw] bg-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Argument Analysis</DialogTitle>
          </DialogHeader>
          {selectedArgumentId && (
            <ArgumentNetAnalyzer
              argumentId={selectedArgumentId}
              deliberationId={deliberationId}
              currentUserId={authorId}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Week 6 Task 6.1: Attack Suggestions Dialog */}
      <Dialog 
        open={!!attackTargetId && !wizardOpen} 
        onOpenChange={(open) => {
          if (!open) {
            setAttackTargetId(null);
            setAttackTargetClaimId(null);
          }
        }}
      >
        <DialogContent className="max-w-4xl bg-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Generate Strategic Attack</DialogTitle>
          </DialogHeader>
          {attackTargetId && attackTargetClaimId && currentUserId && (
            <AttackSuggestions
              targetClaimId={attackTargetClaimId}
              targetArgumentId={attackTargetId}
              userId={currentUserId}
              onAttackSelect={(suggestion) => {
                console.log("[ArgumentsTab] Attack selected:", { suggestion, authorId });
                setSelectedAttack(suggestion);
                setWizardOpen(true);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Week 6 Task 6.1: Attack Construction Wizard Dialog */}
      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        <DialogContent className="max-w-6xl bg-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Construct Attack</DialogTitle>
          </DialogHeader>
          {attackTargetId && attackTargetClaimId && selectedAttack && currentUserId && (
            <AttackArgumentWizard
              suggestion={selectedAttack}
              targetArgumentId={attackTargetId}
              targetClaimId={attackTargetClaimId}
              deliberationId={deliberationId}
              currentUserId={currentUserId}
              onComplete={(attackClaimId) => {
                console.log("[ArgumentsTab] Attack completed, claim ID:", attackClaimId);
                // Refresh arguments list
                setAttackRefreshKey((prev) => prev + 1);
                setWizardOpen(false);
                setAttackTargetId(null);
                setAttackTargetClaimId(null);
                setSelectedAttack(null);
              }}
              onCancel={() => {
                setWizardOpen(false);
                setSelectedAttack(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
