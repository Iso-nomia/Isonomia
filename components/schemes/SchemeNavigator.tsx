/**
 * Unified Scheme Navigator
 * 
 * Main component integrating all navigation modes (Wizard, Clusters, Conditions, Search)
 * into a single tab-based interface with shared state and context.
 * 
 * Week 8, Task 8.2: Tab-Based Interface
 * Updated in Task 8.3: Added user preferences (header, recents, favorites, settings)
 * Updated in Task 8.4: Added search functionality
 */

"use client";

import React, { Suspense, lazy, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { GitBranch, Grid3x3, Filter, Search } from "lucide-react";
import { useNavigationStore, type NavigationMode } from "@/lib/schemes/navigation-state";
import { SchemeNavigationProvider } from "./SchemeNavigationContext";
import NavigationHeader from "./NavigationHeader";
import RecentSchemesPanel from "./RecentSchemesPanel";
import FavoritesPanel from "./FavoritesPanel";
import SettingsPanel from "./SettingsPanel";
import SchemeDetailPanel from "./SchemeDetailPanel";
import SchemeSearch from "./SchemeSearch";
import type { ArgumentScheme } from "@prisma/client";

// Lazy load navigation mode components for better performance
const DichotomicTreeWizard = lazy(() => import("./DichotomicTreeWizard"));
const ClusterBrowser = lazy(() => import("./ClusterBrowser").then(m => ({ default: m.ClusterBrowser })));
const IdentificationConditionsFilter = lazy(() => import("./IdentificationConditionsFilter").then(m => ({ default: m.IdentificationConditionsFilter })));

/**
 * Loading fallback for lazy-loaded tabs
 */
function TabLoadingFallback() {
  return (
    <Card className="p-12 text-center">
      <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
      <p className="text-slate-400">Loading navigation mode...</p>
    </Card>
  );
}

/**
 * Unified SchemeNavigator with all navigation modes
 */
export default function SchemeNavigator() {
  const { currentMode, setMode, selectedScheme, recentSchemes, favoriteSchemeKeys, selectScheme } = useNavigationStore();
  
  // Panel visibility state
  const [showRecents, setShowRecents] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  const handleModeChange = (value: string) => {
    setMode(value as NavigationMode);
  };
  
  const handleSchemeSelect = (scheme: ArgumentScheme) => {
    selectScheme(scheme);
    // Close panels when a scheme is selected
    setShowRecents(false);
    setShowFavorites(false);
  };
  
  return (
    <SchemeNavigationProvider>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <div className="max-w-7xl mx-auto px-3 py-6">
          {/* Header */}
          <div className="mb-4">
            <h1 className="text-3xl font-bold mb-2">Scheme Navigator</h1>
            <p className="text-slate-700">
              Find the perfect argumentation scheme using different navigation approaches
            </p>
          </div>
          
          {/* Navigation Header with Utilities */}
          <NavigationHeader
            onShowRecents={() => setShowRecents(true)}
            onShowFavorites={() => setShowFavorites(true)}
            onShowSettings={() => setShowSettings(true)}
            recentCount={recentSchemes.length}
            favoriteCount={favoriteSchemeKeys.length}
          />
          
          {/* Floating Panels */}
          {showRecents && (
            <div className="fixed top-20 left-4 w-96 z-40 animate-in slide-in-from-right">
              <RecentSchemesPanel
                onClose={() => setShowRecents(false)}
                onSchemeSelect={handleSchemeSelect}
              />
            </div>
          )}
          
          {showFavorites && (
            <div className="fixed top-20 right-4 w-96 z-40 animate-in slide-in-from-right">
              <FavoritesPanel
                onClose={() => setShowFavorites(false)}
                onSchemeSelect={handleSchemeSelect}
              />
            </div>
          )}
          
          {showSettings && (
            <div className="fixed top-10 right-4 w-96 z-40 animate-in slide-in-from-right">
              <SettingsPanel onClose={() => setShowSettings(false)} />
            </div>
          )}
          
          {/* Tabbed Navigation */}
          <Tabs value={currentMode} onValueChange={handleModeChange} className="space-y-6">
            <TabsList className="grid w-full grid-cols-4 lg:grid-cols-4">
              <TabsTrigger value="tree" className="flex items-center gap-2">
                <GitBranch className="w-4 h-4" />
                <span className="hidden sm:inline">Wizard</span>
              </TabsTrigger>
              <TabsTrigger value="cluster" className="flex items-center gap-2">
                <Grid3x3 className="w-4 h-4" />
                <span className="hidden sm:inline">Clusters</span>
              </TabsTrigger>
              <TabsTrigger value="conditions" className="flex items-center gap-2">
                <Filter className="w-4 h-4" />
                <span className="hidden sm:inline">Conditions</span>
              </TabsTrigger>
              <TabsTrigger value="search" className="flex items-center gap-2">
                <Search className="w-4 h-4" />
                <span className="hidden sm:inline">Search</span>
              </TabsTrigger>
            </TabsList>
            
            {/* Wizard Tab */}
            <TabsContent value="tree" className="space-y-6 ">
              <Card className="px-3 py-2 cardv2 panel-edge-blue">
                <p className="text-sm">
                  <strong>Dichotomic Tree Wizard:</strong> Answer 2-3 questions to narrow down
                  to the most relevant schemes for your argument.
                </p>
              </Card>
              
              <Suspense fallback={<TabLoadingFallback />}>
                <DichotomicTreeWizard
                  onSchemeSelect={(scheme) => {
                    useNavigationStore.getState().selectScheme(scheme);
                  }}
                />
              </Suspense>
            </TabsContent>
            
            {/* Cluster Browser Tab */}
            <TabsContent value="cluster" className="space-y-6">
              <Card className="px-3 py-2 cardv2 panel-edge-blue">
                <p className="text-sm">
                  <strong>Cluster Browser:</strong> Browse schemes organized by semantic domain
                  (authority, causality, decision-making, etc.).
                </p>
              </Card>
              
              <Suspense fallback={<TabLoadingFallback />}>
                <ClusterBrowser
                  onSchemeSelect={(scheme: ArgumentScheme) => {
                    useNavigationStore.getState().selectScheme(scheme);
                  }}
                />
              </Suspense>
            </TabsContent>
            
            {/* Identification Conditions Tab */}
            <TabsContent value="conditions" className="space-y-6">
              <Card className="px-3 py-2 cardv2 panel-edge-blue">
                <p className="text-sm">
                  <strong>Identification Conditions:</strong> Select observable patterns in your
                  argument to filter schemes by identification conditions.
                </p>
              </Card>
              
              <Suspense fallback={<TabLoadingFallback />}>
                <IdentificationConditionsFilter
                  onSchemeSelect={(scheme: ArgumentScheme) => {
                    useNavigationStore.getState().selectScheme(scheme);
                  }}
                />
              </Suspense>
            </TabsContent>
            
            {/* Search Tab */}
            <TabsContent value="search" className="space-y-6">
              <Card className="px-3 py-2 cardv2 panel-edge-blue">
                <p className="text-sm">
                  <strong>Search:</strong> Search schemes by name, description, or keywords to
                  quickly find what you need.
                </p>
              </Card>
              
              <SchemeSearch onSchemeSelect={handleSchemeSelect} />
            </TabsContent>
          </Tabs>
          
          {/* Selected Scheme Detail Panel (if scheme selected) */}
          {selectedScheme && (
            <SchemeDetailPanel
              scheme={selectedScheme}
              onClose={() => selectScheme(null)}
              onSchemeSelect={handleSchemeSelect}
            />
          )}
        </div>
      </div>
    </SchemeNavigationProvider>
  );
}
