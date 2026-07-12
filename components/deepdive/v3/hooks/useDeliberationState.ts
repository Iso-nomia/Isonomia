import { useState, useCallback, useMemo } from "react";

/**
 * Tab type definition
 */
export type DeliberationTab =
  | "debate"
  | "arguments"
  | "dialogue"
  | "ludics"
  | "admin"
  | "sources"
  | "thesis"
  | "analytics"
  | "chains" // Task 1.7: Argument chains tab
  | "cross"
  | "pathways"; // Scope A — institutional pathways tab

/**
 * Confidence calculation mode
 */
export type ConfidenceMode = "product" | "min";

/**
 * Aggregation rule for viewpoint selection
 */
export type AggregationRule = "utilitarian" | "harmonic" | "maxcov";

/**
 * Card filter type
 */
export type CardFilter = "all" | "mine" | "published";

/**
 * Reply target information
 */
export type ReplyTarget = {
  id: string;
  preview?: string;
} | null;

/**
 * Main state type for deliberation panel
 */
export type DeliberationState = {
  // Tab navigation
  tab: DeliberationTab;
  
  // Configuration
  confMode: ConfidenceMode;
  rule: AggregationRule;
  dsMode: boolean; // Dempster-Shafer mode
  cardFilter: CardFilter;
  
  // UI state
  pending: boolean;
  status: string | null;
  highlightedDialogueMoveId: string | null;
  replyTarget: ReplyTarget;
  delibSettingsOpen: boolean;
  
  // Refresh control
  refreshCounter: number;
};

/**
 * Actions for deliberation state
 */
export type DeliberationStateActions = {
  // Tab navigation
  setTab: (tab: DeliberationTab) => void;
  
  // Configuration
  setConfMode: (mode: ConfidenceMode) => void;
  setRule: (rule: AggregationRule) => void;
  setDsMode: (enabled: boolean) => void;
  toggleDsMode: () => void;
  setCardFilter: (filter: CardFilter) => void;
  
  // UI state
  setPending: (pending: boolean) => void;
  setStatus: (status: string | null) => void;
  clearStatus: () => void;
  setHighlightedDialogueMoveId: (id: string | null) => void;
  setReplyTarget: (target: ReplyTarget) => void;
  clearReplyTarget: () => void;
  setDelibSettingsOpen: (open: boolean) => void;
  toggleDelibSettings: () => void;
  
  // Refresh control
  triggerRefresh: () => void;
  
  // Bulk actions
  resetToDefaults: () => void;
};

/**
 * Options for deliberation state hook
 */
export type DeliberationStateOptions = {
  /** Initial tab to display */
  initialTab?: DeliberationTab;
  /** Initial configuration values */
  initialConfig?: {
    confMode?: ConfidenceMode;
    rule?: AggregationRule;
    dsMode?: boolean;
    cardFilter?: CardFilter;
  };
};

/**
 * Custom hook for managing deliberation panel state
 * 
 * Consolidates multiple useState hooks into a single state management solution
 * with organized actions for different concerns (navigation, config, UI).
 * 
 * @example
 * ```tsx
 * const { state, actions } = useDeliberationState({
 *   initialTab: 'debate',
 *   initialConfig: {
 *     confMode: 'product',
 *     rule: 'utilitarian'
 *   }
 * });
 * 
 * // Tab navigation
 * <TabsTrigger 
 *   value="arguments" 
 *   onClick={() => actions.setTab('arguments')}
 * />
 * 
 * // Configuration
 * <Select value={state.confMode} onValueChange={actions.setConfMode}>
 *   <SelectItem value="product">Product</SelectItem>
 *   <SelectItem value="min">Minimum</SelectItem>
 * </Select>
 * 
 * // UI state
 * {state.pending && <Spinner />}
 * {state.status && <Toast>{state.status}</Toast>}
 * ```
 */
export function useDeliberationState(
  options: DeliberationStateOptions = {}
): { state: DeliberationState; actions: DeliberationStateActions } {
  const {
    initialTab = "debate",
    initialConfig = {},
  } = options;

  const [state, setState] = useState<DeliberationState>({
    // Tab navigation
    tab: initialTab,
    
    // Configuration
    confMode: initialConfig.confMode ?? "product",
    rule: initialConfig.rule ?? "utilitarian",
    dsMode: initialConfig.dsMode ?? false,
    cardFilter: initialConfig.cardFilter ?? "all",
    
    // UI state
    pending: false,
    status: null,
    highlightedDialogueMoveId: null,
    replyTarget: null,
    delibSettingsOpen: false,
    
    // Refresh control
    refreshCounter: 0,
  });

  // Tab navigation actions
  const setTab = useCallback((tab: DeliberationTab) => {
    setState((prev) => ({ ...prev, tab }));
  }, []);

  // Configuration actions
  const setConfMode = useCallback((confMode: ConfidenceMode) => {
    setState((prev) => ({ ...prev, confMode }));
  }, []);

  const setRule = useCallback((rule: AggregationRule) => {
    setState((prev) => ({ ...prev, rule }));
  }, []);

  const setDsMode = useCallback((dsMode: boolean) => {
    setState((prev) => ({ ...prev, dsMode }));
  }, []);

  const toggleDsMode = useCallback(() => {
    setState((prev) => ({ ...prev, dsMode: !prev.dsMode }));
  }, []);

  const setCardFilter = useCallback((cardFilter: CardFilter) => {
    setState((prev) => ({ ...prev, cardFilter }));
  }, []);

  // UI state actions
  const setPending = useCallback((pending: boolean) => {
    setState((prev) => ({ ...prev, pending }));
  }, []);

  const setStatus = useCallback((status: string | null) => {
    setState((prev) => ({ ...prev, status }));
  }, []);

  const clearStatus = useCallback(() => {
    setState((prev) => ({ ...prev, status: null }));
  }, []);

  const setHighlightedDialogueMoveId = useCallback((id: string | null) => {
    setState((prev) => ({ ...prev, highlightedDialogueMoveId: id }));
  }, []);

  const setReplyTarget = useCallback((replyTarget: ReplyTarget) => {
    setState((prev) => ({ ...prev, replyTarget }));
  }, []);

  const clearReplyTarget = useCallback(() => {
    setState((prev) => ({ ...prev, replyTarget: null }));
  }, []);

  const setDelibSettingsOpen = useCallback((delibSettingsOpen: boolean) => {
    setState((prev) => ({ ...prev, delibSettingsOpen }));
  }, []);

  const toggleDelibSettings = useCallback(() => {
    setState((prev) => ({ ...prev, delibSettingsOpen: !prev.delibSettingsOpen }));
  }, []);

  // Refresh control actions
  const triggerRefresh = useCallback(() => {
    setState((prev) => ({ ...prev, refreshCounter: prev.refreshCounter + 1 }));
  }, []);

  // Bulk actions
  const resetToDefaults = useCallback(() => {
    setState({
      tab: initialTab,
      confMode: initialConfig.confMode ?? "product",
      rule: initialConfig.rule ?? "utilitarian",
      dsMode: initialConfig.dsMode ?? false,
      cardFilter: initialConfig.cardFilter ?? "all",
      pending: false,
      status: null,
      highlightedDialogueMoveId: null,
      replyTarget: null,
      delibSettingsOpen: false,
      refreshCounter: 0,
    });
  }, [initialTab, initialConfig]);

  const actions: DeliberationStateActions = useMemo(() => ({
    setTab,
    setConfMode,
    setRule,
    setDsMode,
    toggleDsMode,
    setCardFilter,
    setPending,
    setStatus,
    clearStatus,
    setHighlightedDialogueMoveId,
    setReplyTarget,
    clearReplyTarget,
    setDelibSettingsOpen,
    toggleDelibSettings,
    triggerRefresh,
    resetToDefaults,
  }), [
    setTab,
    setConfMode,
    setRule,
    setDsMode,
    toggleDsMode,
    setCardFilter,
    setPending,
    setStatus,
    clearStatus,
    setHighlightedDialogueMoveId,
    setReplyTarget,
    clearReplyTarget,
    setDelibSettingsOpen,
    toggleDelibSettings,
    triggerRefresh,
    resetToDefaults,
  ]);

  return { state, actions };
}
