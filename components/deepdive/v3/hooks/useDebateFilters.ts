/**
 * useDebateFilters Hook
 * 
 * Manages filtering state and logic for DebateSheetReader component.
 * Provides controlled filter state and filtered arguments list.
 * 
 * Part of Phase 2: Component Structure Refactor
 */

import { useState, useMemo } from "react";

export interface DebateFilters {
  scheme: string | null;
  openCQsOnly: boolean;
  attackedOnly: boolean;
}

export interface ArgumentNode {
  id: string;
  argumentId?: string;
  title?: string;
  claimId?: string;
  diagramId?: string;
  [key: string]: any;
}

export interface UseDebateFiltersProps {
  /** Array of argument nodes to filter */
  nodes: ArgumentNode[];
  /** Lookup map: argumentId -> AIF metadata */
  aifByArgId: Map<string, any>;
}

export interface UseDebateFiltersReturn {
  /** Current filter state */
  filters: DebateFilters;
  /** Filtered array of nodes */
  filteredNodes: ArgumentNode[];
  /** Available scheme keys (for dropdown) */
  availableSchemes: string[];
  /** Set scheme filter */
  setSchemeFilter: (scheme: string | null) => void;
  /** Set open CQs only filter */
  setOpenCQsFilter: (enabled: boolean) => void;
  /** Set attacked only filter */
  setAttackedFilter: (enabled: boolean) => void;
  /** Clear all filters */
  clearFilters: () => void;
  /** Whether any filters are active */
  hasActiveFilters: boolean;
}

/**
 * Custom hook for managing debate sheet filters
 * 
 * @example
 * ```tsx
 * const {
 *   filters,
 *   filteredNodes,
 *   availableSchemes,
 *   setSchemeFilter,
 *   clearFilters,
 * } = useDebateFilters({ nodes, aifByArgId });
 * ```
 */
export function useDebateFilters({
  nodes,
  aifByArgId,
}: UseDebateFiltersProps): UseDebateFiltersReturn {
  const [filterScheme, setFilterScheme] = useState<string | null>(null);
  const [filterOpenCQs, setFilterOpenCQs] = useState(false);
  const [filterAttacked, setFilterAttacked] = useState(false);

  // Extract available schemes from AIF data
  const availableSchemes = useMemo(() => {
    const schemes = new Set<string>();
    
    for (const node of nodes) {
      if (node.argumentId) {
        const aif = aifByArgId.get(node.argumentId);
        if (aif?.scheme?.key) {
          schemes.add(aif.scheme.key);
        }
      }
    }
    
    return Array.from(schemes).sort();
  }, [nodes, aifByArgId]);

  // Apply filters to nodes
  const filteredNodes = useMemo(() => {
    let filtered = [...nodes];

    // Filter by scheme
    if (filterScheme) {
      filtered = filtered.filter((node) => {
        const aif = node.argumentId ? aifByArgId.get(node.argumentId) : null;
        return aif?.scheme?.key === filterScheme;
      });
    }

    // Filter by open CQs
    if (filterOpenCQs) {
      filtered = filtered.filter((node) => {
        const aif = node.argumentId ? aifByArgId.get(node.argumentId) : null;
        return aif?.cq && aif.cq.satisfied < aif.cq.required;
      });
    }

    // Filter by attacked status
    if (filterAttacked) {
      filtered = filtered.filter((node) => {
        const aif = node.argumentId ? aifByArgId.get(node.argumentId) : null;
        const total = aif?.attacks
          ? aif.attacks.REBUTS + aif.attacks.UNDERCUTS + aif.attacks.UNDERMINES
          : 0;
        return total > 0;
      });
    }

    return filtered;
  }, [nodes, filterScheme, filterOpenCQs, filterAttacked, aifByArgId]);

  // Check if any filters are active
  const hasActiveFilters = filterScheme !== null || filterOpenCQs || filterAttacked;

  // Clear all filters
  const clearFilters = () => {
    setFilterScheme(null);
    setFilterOpenCQs(false);
    setFilterAttacked(false);
  };

  return {
    filters: {
      scheme: filterScheme,
      openCQsOnly: filterOpenCQs,
      attackedOnly: filterAttacked,
    },
    filteredNodes,
    availableSchemes,
    setSchemeFilter: setFilterScheme,
    setOpenCQsFilter: setFilterOpenCQs,
    setAttackedFilter: setFilterAttacked,
    clearFilters,
    hasActiveFilters,
  };
}
