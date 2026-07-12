// hooks/useBulkSelection.ts
// Phase 2.4: Hook for managing bulk selection state

import { useState, useCallback, useMemo } from "react";

export interface BulkSelectionState<T extends { id: string }> {
  selectedIds: Set<string>;
  selectedItems: T[];
  selectedCount: number;
  toggle: (id: string) => void;
  select: (id: string) => void;
  deselect: (id: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
  selectMultiple: (ids: string[]) => void;
  isSelected: (id: string) => boolean;
  hasSelection: boolean;
  allSelected: boolean;
  someSelected: boolean;
}

export function useBulkSelection<T extends { id: string }>(
  items: T[]
): BulkSelectionState<T> {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const select = useCallback((id: string) => {
    setSelectedIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const deselect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(items.map((i) => i.id)));
  }, [items]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectMultiple = useCallback((ids: string[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        next.add(id);
      }
      return next;
    });
  }, []);

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds]
  );

  const selectedItems = useMemo(
    () => items.filter((i) => selectedIds.has(i.id)),
    [items, selectedIds]
  );

  const selectedCount = selectedIds.size;
  const hasSelection = selectedCount > 0;
  const allSelected = selectedCount === items.length && items.length > 0;
  const someSelected = hasSelection && !allSelected;

  return {
    selectedIds,
    selectedItems,
    selectedCount,
    toggle,
    select,
    deselect,
    selectAll,
    deselectAll,
    selectMultiple,
    isSelected,
    hasSelection,
    allSelected,
    someSelected,
  };
}
