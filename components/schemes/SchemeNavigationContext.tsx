/**
 * Scheme Navigation Context
 * 
 * React context providing shared navigation logic and callbacks
 * across all navigation modes.
 * 
 * Week 8, Task 8.1: Integration Architecture
 */

"use client";

import React, { createContext, useContext, useCallback } from "react";
import type { ArgumentScheme } from "@prisma/client";
import { useNavigationStore, type NavigationMode } from "@/lib/schemes/navigation-state";
import { useRouter } from "next/navigation";

/**
 * Context value for scheme navigation
 */
interface SchemeNavigationContextValue {
  // Navigation
  currentMode: NavigationMode;
  setMode: (mode: NavigationMode) => void;
  
  // Scheme selection
  selectedScheme: ArgumentScheme | null;
  onSchemeSelect: (scheme: ArgumentScheme) => void;
  onSchemeClose: () => void;
  
  // Recents and favorites
  recentSchemes: string[];
  favoriteSchemeKeys: string[];
  isFavorite: (schemeKey: string) => boolean;
  toggleFavorite: (schemeKey: string) => void;
}

const SchemeNavigationContext = createContext<SchemeNavigationContextValue | null>(null);

/**
 * Provider for unified scheme navigation
 */
export function SchemeNavigationProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  
  const {
    currentMode,
    setMode,
    selectedScheme,
    selectScheme,
    recentSchemes,
    favoriteSchemeKeys,
    isFavorite,
    toggleFavorite,
  } = useNavigationStore();
  
  const onSchemeSelect = useCallback(
    (scheme: ArgumentScheme) => {
      selectScheme(scheme);
    },
    [selectScheme]
  );
  
  const onSchemeClose = useCallback(() => {
    selectScheme(null);
  }, [selectScheme]);
  
  const value: SchemeNavigationContextValue = {
    currentMode,
    setMode,
    selectedScheme,
    onSchemeSelect,
    onSchemeClose,
    recentSchemes,
    favoriteSchemeKeys,
    isFavorite,
    toggleFavorite,
  };
  
  return (
    <SchemeNavigationContext.Provider value={value}>
      {children}
    </SchemeNavigationContext.Provider>
  );
}

/**
 * Hook to use scheme navigation context
 */
export function useSchemeNavigation() {
  const context = useContext(SchemeNavigationContext);
  if (!context) {
    throw new Error("useSchemeNavigation must be used within SchemeNavigationProvider");
  }
  return context;
}
