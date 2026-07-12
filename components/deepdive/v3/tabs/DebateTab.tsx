/**
 * DebateTab Component
 * 
 * Main debate/discussion tab with nested tabs structure:
 * - Propositions: Composer and list
 * - Claims: MiniMap, Dialogue Inspector, Settings Panel
 * 
 * Part of DeepDivePanel V3 migration - Week 4, Task 4.4
 * Uses SheetAwareTabProps (needs delibState for settings panel)
 */

"use client";

import * as React from "react";
import { BaseTabProps } from "./types";
import { SectionCard } from "../../shared/SectionCard";
import { NestedTabs } from "@/components/deepdive/shared/NestedTabs";
import { MessageSquare, Map, Settings, Network, MessagesSquare } from "lucide-react";
import { PropositionComposerPro } from "@/components/propositions/PropositionComposerPro";
import PropositionsList from "@/components/propositions/PropositionsList";
import ClaimMiniMap from "@/components/claims/ClaimMiniMap";
import { DialogueInspector } from "@/components/dialogue/DialogueInspector";
import { DeliberationSettingsPanel } from "@/components/deliberations/DeliberationSettingsPanel";
import DebateSheetReader from "@/components/agora/DebateSheetReader";
import { ThreadedDiscussionTab } from "./ThreadedDiscussionTab";
import type { DeliberationTab } from "../hooks/useDeliberationState";

/**
 * Props for DebateTab
 * Extends BaseTabProps with additional requirements for debate functionality
 */
export interface DebateTabProps extends BaseTabProps {
  /** Whether the deliberation settings panel should be shown */
  delibSettingsOpen: boolean;
  
  /** Currently selected claim ID (if any) */
  selectedClaimId?: string;
  
  /** Callback when a claim is clicked in the minimap */
  onClaimClick: (id: string, locusPath?: string | null) => void;
  
  /** Callback to switch main panel tabs (debate/arguments/ludics/analytics) */
  onTabChange?: (tab: DeliberationTab) => void;
}

/**
 * DebateTab Component
 * 
 * Primary tab for participating in deliberation discussions with nested tab structure:
 * 
 * Subtabs:
 * 1. Discussion - Threaded view of all discussion items (propositions, claims, arguments)
 * 2. Propositions - Create and view propositions
 * 3. Claims - Visualize claims structure, inspect dialogue, manage settings
 * 4. Sheet View - Argument network visualization with confidence scores
 * 
 * @param deliberationId - The ID of the deliberation
 * @param currentUserId - The ID of the current user
 * @param delibSettingsOpen - Whether settings panel should be visible
 * @param selectedClaimId - Currently selected claim (for highlighting)
 * @param onClaimClick - Handler for claim selection
 * @param onTabChange - Handler to switch main panel tabs
 * @param className - Optional additional CSS classes
 */
export function DebateTab({
  deliberationId,
  currentUserId,
  delibSettingsOpen,
  selectedClaimId,
  onClaimClick,
  onTabChange,
  className,
}: DebateTabProps) {
  return (
    <div className="w-full min-w-0   mt-4">
      <NestedTabs
        id={`debate-${deliberationId}`}
        defaultValue="discussion"
        variant="secondary"
        tabs={[
          {
            value: "discussion",
            label: "Discussion",
            icon: <MessagesSquare className="size-3.5" />,
            content: (
              <ThreadedDiscussionTab
                deliberationId={deliberationId}
                currentUserId={currentUserId}
                onTabChange={onTabChange}
              />
            ),
          },
          {
            value: "propositions",
            label: "Propositions",
            icon: <MessageSquare className="size-3.5" />,
            content: (
              <div className="space-y-5">
                <SectionCard title="Compose Proposition">
                  <PropositionComposerPro deliberationId={deliberationId} />
                </SectionCard>
                
                <SectionCard>
                  <PropositionsList deliberationId={deliberationId} />
                </SectionCard>
              </div>
            ),
          },
          {
            value: "claims",
            label: "Claims",
            icon: <Map className="size-3.5" />,
            content: (
              <div className="space-y-5">
                {delibSettingsOpen && (
                  <SectionCard>
                    <DeliberationSettingsPanel deliberationId={deliberationId} />
                  </SectionCard>
                )}
                
                <SectionCard>
                  <ClaimMiniMap
                    deliberationId={deliberationId}
                    selectedClaimId={selectedClaimId}
                    onClaimClick={onClaimClick}
                    currentUserId={currentUserId}
                  />
                </SectionCard>

                <SectionCard>
                  <DialogueInspector
                    deliberationId={deliberationId}
                    initialTargetType="claim"
                    initialLocusPath="0"
                  />
                </SectionCard>
              </div>
            ),
          },
          {
            value: "sheet",
            label: "Sheets",
            icon: <Network className="size-3.5" />,
            content: (
              <div className="space-y-5 mt-2  ">
                <DebateSheetReader deliberationId={deliberationId} />
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
