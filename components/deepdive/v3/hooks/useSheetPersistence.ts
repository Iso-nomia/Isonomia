import { useState, useEffect } from "react";

/**
 * Type definition for sheet state
 */
export type SheetState = {
  left: boolean;
  right: boolean;
  terms: boolean;
};

/**
 * Type for sheet actions
 */
export type SheetActions = {
  toggleLeft: () => void;
  toggleRight: () => void;
  toggleTerms: () => void;
  setLeft: (open: boolean) => void;
  setRight: (open: boolean) => void;
  setTerms: (open: boolean) => void;
  closeAll: () => void;
};

/**
 * Options for sheet persistence
 */
export type SheetPersistenceOptions = {
  /** Unique key for localStorage persistence */
  storageKey?: string;
  /** Default values for sheet state */
  defaultState?: Partial<SheetState>;
  /** Whether to persist to localStorage */
  persist?: boolean;
};

/**
 * Custom hook for managing floating sheet state with localStorage persistence
 * 
 * @example
 * ```tsx
 * const { state, actions } = useSheetPersistence({
 *   storageKey: 'deepdive-sheets',
 *   defaultState: { left: true, right: false, terms: false }
 * });
 * 
 * return (
 *   <>
 *     <FloatingSheet open={state.left} onOpenChange={actions.setLeft}>
 *       ...
 *     </FloatingSheet>
 *   </>
 * );
 * ```
 */
export function useSheetPersistence(
  options: SheetPersistenceOptions = {}
): { state: SheetState; actions: SheetActions } {
  const {
    storageKey = "sheet-state",
    defaultState = { left: true, right: false, terms: false },
    persist = true,
  } = options;

  // Initialize state from localStorage or defaults
  const [state, setState] = useState<SheetState>(() => {
    if (!persist || typeof window === "undefined") {
      return { ...defaultState } as SheetState;
    }

    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          left: parsed.left ?? defaultState.left ?? true,
          right: parsed.right ?? defaultState.right ?? false,
          terms: parsed.terms ?? defaultState.terms ?? false,
        };
      }
    } catch (error) {
      console.warn("Failed to parse stored sheet state:", error);
    }

    return { ...defaultState } as SheetState;
  });

  // Persist to localStorage whenever state changes
  useEffect(() => {
    if (persist && typeof window !== "undefined") {
      try {
        localStorage.setItem(storageKey, JSON.stringify(state));
      } catch (error) {
        console.warn("Failed to persist sheet state:", error);
      }
    }
  }, [state, persist, storageKey]);

  // Actions
  const actions: SheetActions = {
    toggleLeft: () => setState((prev) => ({ ...prev, left: !prev.left })),
    toggleRight: () => setState((prev) => ({ ...prev, right: !prev.right })),
    toggleTerms: () => setState((prev) => ({ ...prev, terms: !prev.terms })),
    setLeft: (open: boolean) => setState((prev) => ({ ...prev, left: open })),
    setRight: (open: boolean) => setState((prev) => ({ ...prev, right: open })),
    setTerms: (open: boolean) => setState((prev) => ({ ...prev, terms: open })),
    closeAll: () => setState({ left: false, right: false, terms: false }),
  };

  return { state, actions };
}
