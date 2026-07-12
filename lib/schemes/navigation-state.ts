/**
 * Unified Navigation State Management
 * 
 * Zustand store managing state across all navigation modes in SchemeNavigator.
 * Provides state persistence, mode switching, and shared context.
 * 
 * Week 8, Task 8.1: Integration Architecture
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ArgumentScheme } from "@prisma/client";

/**
 * Navigation modes available in SchemeNavigator
 */
export type NavigationMode = "tree" | "cluster" | "conditions" | "search";

/**
 * Shared state across all navigation modes
 */
export interface NavigationState {
  // Current mode
  currentMode: NavigationMode;
  
  // Selected scheme (shared across all modes)
  selectedScheme: ArgumentScheme | null;
  
  // Recently viewed schemes
  recentSchemes: string[]; // scheme keys
  
  // User favorites
  favoriteSchemeKeys: string[];
  
  // Mode-specific state
  treeState: TreeNavigationState;
  clusterState: ClusterNavigationState;
  conditionsState: ConditionsNavigationState;
  searchState: SearchNavigationState;
}

/**
 * State specific to Dichotomic Tree mode
 */
export interface TreeNavigationState {
  // Current wizard step (0 = purpose, 1 = source, 2 = results)
  currentStep: number;
  
  // Selected purpose
  purpose: "action" | "state_of_affairs" | null;
  
  // Selected source
  source: "internal" | "external" | null;
  
  // Wizard history for back navigation
  history: Array<{
    step: number;
    purpose: string | null;
    source: string | null;
  }>;
}

/**
 * State specific to Cluster Browser mode
 */
export interface ClusterNavigationState {
  // Currently selected cluster
  selectedCluster: string | null;
  
  // Breadcrumb trail
  breadcrumbs: Array<{ label: string; clusterId: string | null }>;
  
  // View mode (grid or list)
  viewMode: "grid" | "list";
}

/**
 * State specific to Identification Conditions mode
 */
export interface ConditionsNavigationState {
  // Selected condition IDs
  selectedConditions: string[];
  
  // Expanded categories
  expandedCategories: string[];
  
  // Sort preference
  sortBy: "score" | "name";
  
  // Quality filter
  qualityFilter: "all" | "perfect" | "strong" | "moderate" | "weak";
  
  // Show tutorial on first visit
  showTutorial: boolean;
}

/**
 * State specific to Search mode
 */
export interface SearchNavigationState {
  // Current search query
  query: string;
  
  // Search filters
  filters: {
    purpose?: "action" | "state_of_affairs";
    source?: "internal" | "external";
    cluster?: string;
  };
  
  // Recent searches
  recentSearches: string[];
}

/**
 * Actions for the navigation store
 */
export interface NavigationActions {
  // Mode switching
  setMode: (mode: NavigationMode) => void;
  
  // Scheme selection
  selectScheme: (scheme: ArgumentScheme | null) => void;
  addToRecents: (schemeKey: string) => void;
  
  // Favorites
  toggleFavorite: (schemeKey: string) => void;
  isFavorite: (schemeKey: string) => boolean;
  
  // Tree actions
  setTreeStep: (step: number) => void;
  setTreePurpose: (purpose: "action" | "state_of_affairs" | null) => void;
  setTreeSource: (source: "internal" | "external" | null) => void;
  resetTree: () => void;
  goBackInTree: () => void;
  
  // Cluster actions
  setSelectedCluster: (clusterId: string | null) => void;
  setClusterViewMode: (mode: "grid" | "list") => void;
  addClusterBreadcrumb: (label: string, clusterId: string | null) => void;
  clearClusterBreadcrumbs: () => void;
  
  // Conditions actions
  toggleCondition: (conditionId: string) => void;
  clearConditions: () => void;
  setConditionsSortBy: (sortBy: "score" | "name") => void;
  setConditionsQualityFilter: (filter: "all" | "perfect" | "strong" | "moderate" | "weak") => void;
  toggleCategory: (categoryId: string) => void;
  setShowTutorial: (show: boolean) => void;
  
  // Search actions
  setSearchQuery: (query: string) => void;
  setSearchFilters: (filters: Partial<SearchNavigationState["filters"]>) => void;
  addRecentSearch: (query: string) => void;
  clearSearchFilters: () => void;
  
  // Global actions
  resetAll: () => void;
}

/**
 * Initial state for the navigation store
 */
const initialState: NavigationState = {
  currentMode: "tree",
  selectedScheme: null,
  recentSchemes: [],
  favoriteSchemeKeys: [],
  
  treeState: {
    currentStep: 0,
    purpose: null,
    source: null,
    history: [],
  },
  
  clusterState: {
    selectedCluster: null,
    breadcrumbs: [],
    viewMode: "grid",
  },
  
  conditionsState: {
    selectedConditions: [],
    expandedCategories: ["source_type", "reasoning_type"],
    sortBy: "score",
    qualityFilter: "all",
    showTutorial: false,
  },
  
  searchState: {
    query: "",
    filters: {},
    recentSearches: [],
  },
};

/**
 * Zustand store for unified navigation state
 * Persists user preferences and recent activity
 */
export const useNavigationStore = create<NavigationState & NavigationActions>()(
  persist(
    (set, get) => ({
      ...initialState,
      
      // Mode switching
      setMode: (mode) => set({ currentMode: mode }),
      
      // Scheme selection
      selectScheme: (scheme) => {
        set({ selectedScheme: scheme });
        if (scheme) {
          get().addToRecents(scheme.key);
        }
      },
      
      addToRecents: (schemeKey) => {
        set((state) => {
          const filtered = state.recentSchemes.filter((k) => k !== schemeKey);
          return {
            recentSchemes: [schemeKey, ...filtered].slice(0, 10), // Keep last 10
          };
        });
      },
      
      // Favorites
      toggleFavorite: (schemeKey) => {
        set((state) => {
          const isFav = state.favoriteSchemeKeys.includes(schemeKey);
          return {
            favoriteSchemeKeys: isFav
              ? state.favoriteSchemeKeys.filter((k) => k !== schemeKey)
              : [...state.favoriteSchemeKeys, schemeKey],
          };
        });
      },
      
      isFavorite: (schemeKey) => {
        return get().favoriteSchemeKeys.includes(schemeKey);
      },
      
      // Tree actions
      setTreeStep: (step) => {
        set((state) => ({
          treeState: {
            ...state.treeState,
            currentStep: step,
            history: [
              ...state.treeState.history,
              {
                step: state.treeState.currentStep,
                purpose: state.treeState.purpose,
                source: state.treeState.source,
              },
            ],
          },
        }));
      },
      
      setTreePurpose: (purpose) => {
        set((state) => ({
          treeState: { ...state.treeState, purpose },
        }));
      },
      
      setTreeSource: (source) => {
        set((state) => ({
          treeState: { ...state.treeState, source },
        }));
      },
      
      resetTree: () => {
        set((state) => ({
          treeState: {
            ...initialState.treeState,
          },
        }));
      },
      
      goBackInTree: () => {
        set((state) => {
          const history = [...state.treeState.history];
          const previous = history.pop();
          if (previous) {
            return {
              treeState: {
                ...state.treeState,
                currentStep: previous.step,
                purpose: previous.purpose as any,
                source: previous.source as any,
                history,
              },
            };
          }
          return state;
        });
      },
      
      // Cluster actions
      setSelectedCluster: (clusterId) => {
        set((state) => ({
          clusterState: { ...state.clusterState, selectedCluster: clusterId },
        }));
      },
      
      setClusterViewMode: (mode) => {
        set((state) => ({
          clusterState: { ...state.clusterState, viewMode: mode },
        }));
      },
      
      addClusterBreadcrumb: (label, clusterId) => {
        set((state) => ({
          clusterState: {
            ...state.clusterState,
            breadcrumbs: [...state.clusterState.breadcrumbs, { label, clusterId }],
          },
        }));
      },
      
      clearClusterBreadcrumbs: () => {
        set((state) => ({
          clusterState: { ...state.clusterState, breadcrumbs: [] },
        }));
      },
      
      // Conditions actions
      toggleCondition: (conditionId) => {
        set((state) => {
          const selected = state.conditionsState.selectedConditions;
          const isSelected = selected.includes(conditionId);
          return {
            conditionsState: {
              ...state.conditionsState,
              selectedConditions: isSelected
                ? selected.filter((id) => id !== conditionId)
                : [...selected, conditionId],
            },
          };
        });
      },
      
      clearConditions: () => {
        set((state) => ({
          conditionsState: {
            ...state.conditionsState,
            selectedConditions: [],
          },
        }));
      },
      
      setConditionsSortBy: (sortBy) => {
        set((state) => ({
          conditionsState: { ...state.conditionsState, sortBy },
        }));
      },
      
      setConditionsQualityFilter: (filter) => {
        set((state) => ({
          conditionsState: { ...state.conditionsState, qualityFilter: filter },
        }));
      },
      
      toggleCategory: (categoryId) => {
        set((state) => {
          const expanded = state.conditionsState.expandedCategories;
          const isExpanded = expanded.includes(categoryId);
          return {
            conditionsState: {
              ...state.conditionsState,
              expandedCategories: isExpanded
                ? expanded.filter((id) => id !== categoryId)
                : [...expanded, categoryId],
            },
          };
        });
      },
      
      setShowTutorial: (show) => {
        set((state) => ({
          conditionsState: { ...state.conditionsState, showTutorial: show },
        }));
      },
      
      // Search actions
      setSearchQuery: (query) => {
        set((state) => ({
          searchState: { ...state.searchState, query },
        }));
      },
      
      setSearchFilters: (filters) => {
        set((state) => ({
          searchState: {
            ...state.searchState,
            filters: { ...state.searchState.filters, ...filters },
          },
        }));
      },
      
      addRecentSearch: (query) => {
        if (!query.trim()) return;
        set((state) => {
          const filtered = state.searchState.recentSearches.filter((q) => q !== query);
          return {
            searchState: {
              ...state.searchState,
              recentSearches: [query, ...filtered].slice(0, 5), // Keep last 5
            },
          };
        });
      },
      
      clearSearchFilters: () => {
        set((state) => ({
          searchState: { ...state.searchState, filters: {} },
        }));
      },
      
      // Global actions
      resetAll: () => {
        set({
          ...initialState,
          // Preserve favorites and recents
          favoriteSchemeKeys: get().favoriteSchemeKeys,
          recentSchemes: get().recentSchemes,
        });
      },
    }),
    {
      name: "scheme-navigation-storage",
      partialize: (state) => ({
        currentMode: state.currentMode,
        favoriteSchemeKeys: state.favoriteSchemeKeys,
        recentSchemes: state.recentSchemes,
        conditionsState: {
          sortBy: state.conditionsState.sortBy,
          qualityFilter: state.conditionsState.qualityFilter,
          expandedCategories: state.conditionsState.expandedCategories,
        },
        clusterState: {
          viewMode: state.clusterState.viewMode,
        },
        searchState: {
          recentSearches: state.searchState.recentSearches,
        },
      }),
    }
  )
);

/**
 * Hook to get current mode
 */
export const useCurrentMode = () => useNavigationStore((state) => state.currentMode);

/**
 * Hook to get selected scheme
 */
export const useSelectedScheme = () => useNavigationStore((state) => state.selectedScheme);

/**
 * Hook to get mode-specific state
 */
export const useTreeState = () => useNavigationStore((state) => state.treeState);
export const useClusterState = () => useNavigationStore((state) => state.clusterState);
export const useConditionsState = () => useNavigationStore((state) => state.conditionsState);
export const useSearchState = () => useNavigationStore((state) => state.searchState);
