/**
 * useDebateModals Hook
 * 
 * Manages modal state for DebateSheetReader component.
 * Handles preview modal, actions sheet, and expand popout state.
 * 
 * Part of Phase 2: Component Structure Refactor
 */

import { useState, useCallback } from "react";

export interface SelectedArgument {
  id: string;
  text?: string;
  conclusionText?: string;
  conclusionClaimId?: string;
  schemeKey?: string;
  schemeId?: string;
  schemeName?: string;
  premises?: Array<{ id: string; text: string; isImplicit?: boolean }>;
}

export interface UseDebateModalsReturn {
  // Preview Modal (AIF Neighborhood)
  previewModal: {
    isOpen: boolean;
    nodeId: string | null;
    argumentId: string | null;
  };
  openPreview: (nodeId: string, argumentId?: string) => void;
  closePreview: () => void;

  // Actions Sheet Modal
  actionsSheet: {
    isOpen: boolean;
    selectedArgument: SelectedArgument | null;
  };
  openActionsSheet: (argument: SelectedArgument) => void;
  closeActionsSheet: () => void;

  // Expand Popout Modal
  expandModal: {
    isOpen: boolean;
    nodeId: string | null;
  };
  openExpand: (nodeId: string) => void;
  closeExpand: () => void;

  // Contributing Arguments Modal
  contributingModal: {
    isOpen: boolean;
    claimId: string | null;
  };
  openContributing: (claimId: string) => void;
  closeContributing: () => void;

  // Close all modals
  closeAll: () => void;
}

/**
 * Custom hook for managing debate sheet modals
 * 
 * @example
 * ```tsx
 * const {
 *   previewModal,
 *   openPreview,
 *   actionsSheet,
 *   openActionsSheet,
 *   closeAll,
 * } = useDebateModals();
 * ```
 */
export function useDebateModals(): UseDebateModalsReturn {
  // Preview modal state
  const [previewNodeId, setPreviewNodeId] = useState<string | null>(null);
  const [previewArgumentId, setPreviewArgumentId] = useState<string | null>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  // Actions sheet state
  const [actionsSheetOpen, setActionsSheetOpen] = useState(false);
  const [selectedArgumentForActions, setSelectedArgumentForActions] = useState<SelectedArgument | null>(null);

  // Expand modal state
  const [expandNodeId, setExpandNodeId] = useState<string | null>(null);

  // Contributing arguments modal state
  const [contributingClaimId, setContributingClaimId] = useState<string | null>(null);

  // Preview modal handlers
  const openPreview = useCallback((nodeId: string, argumentId?: string) => {
    setPreviewNodeId(nodeId);
    setPreviewArgumentId(argumentId ?? null);
    setPreviewModalOpen(true);
  }, []);

  const closePreview = useCallback(() => {
    setPreviewModalOpen(false);
    // Keep IDs for a moment to allow smooth close animation
    setTimeout(() => {
      setPreviewNodeId(null);
      setPreviewArgumentId(null);
    }, 150);
  }, []);

  // Actions sheet handlers
  const openActionsSheet = useCallback((argument: SelectedArgument) => {
    setSelectedArgumentForActions(argument);
    setActionsSheetOpen(true);
  }, []);

  const closeActionsSheet = useCallback(() => {
    setActionsSheetOpen(false);
    setTimeout(() => {
      setSelectedArgumentForActions(null);
    }, 150);
  }, []);

  // Expand modal handlers
  const openExpand = useCallback((nodeId: string) => {
    setExpandNodeId(nodeId);
  }, []);

  const closeExpand = useCallback(() => {
    setExpandNodeId(null);
  }, []);

  // Contributing arguments modal handlers
  const openContributing = useCallback((claimId: string) => {
    setContributingClaimId(claimId);
  }, []);

  const closeContributing = useCallback(() => {
    setContributingClaimId(null);
  }, []);

  // Close all modals
  const closeAll = useCallback(() => {
    closePreview();
    closeActionsSheet();
    closeExpand();
    closeContributing();
  }, [closePreview, closeActionsSheet, closeExpand, closeContributing]);

  return {
    previewModal: {
      isOpen: previewModalOpen,
      nodeId: previewNodeId,
      argumentId: previewArgumentId,
    },
    openPreview,
    closePreview,

    actionsSheet: {
      isOpen: actionsSheetOpen,
      selectedArgument: selectedArgumentForActions,
    },
    openActionsSheet,
    closeActionsSheet,

    expandModal: {
      isOpen: expandNodeId !== null,
      nodeId: expandNodeId,
    },
    openExpand,
    closeExpand,

    contributingModal: {
      isOpen: contributingClaimId !== null,
      claimId: contributingClaimId,
    },
    openContributing,
    closeContributing,

    closeAll,
  };
}
