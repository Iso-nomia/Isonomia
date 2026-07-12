"use client";

import { useState, useCallback, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { NetGraph } from "./NetGraph";
import { EdgeFilterPanel } from "./EdgeFilterPanel";
import { StylingLegend } from "./StylingLegend";
import { LayoutSelector } from "./LayoutSelector";
import {
  Filter,
  Info,
  Search,
  RefreshCw,
} from "lucide-react";

interface NetExplorerProps {
  net: any;
  dependencyGraph: any;
  explicitnessAnalysis: any;
  onSchemeSelect?: (schemeId: string) => void;
}

export function NetExplorer({
  net,
  dependencyGraph,
  explicitnessAnalysis,
  onSchemeSelect,
}: NetExplorerProps) {
  const [layout, setLayout] = useState<"hierarchical" | "force" | "circular" | "tree">(
    "hierarchical"
  );
  const [selectedScheme, setSelectedScheme] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    showPrerequisite: true,
    showSupporting: true,
    showEnabling: true,
    showBackground: true,
    minStrength: 0,
    showOnlyCriticalPath: false,
  });

  // Filter edges based on criteria
  const filteredDependencyGraph = useMemo(() => {
    const filteredEdges = dependencyGraph.edges.filter((edge: any) => {
      // Type filter
      if (edge.type === "prerequisite" && !filters.showPrerequisite) return false;
      if (edge.type === "supporting" && !filters.showSupporting) return false;
      if (edge.type === "enabling" && !filters.showEnabling) return false;
      if (edge.type === "background" && !filters.showBackground) return false;

      // Strength filter
      if (edge.strength < filters.minStrength) return false;

      // Critical path filter
      if (filters.showOnlyCriticalPath) {
        const isOnPath =
          dependencyGraph.criticalPath.includes(edge.sourceSchemeId) &&
          dependencyGraph.criticalPath.includes(edge.targetSchemeId);
        if (!isOnPath) return false;
      }

      return true;
    });

    return {
      ...dependencyGraph,
      edges: filteredEdges,
    };
  }, [dependencyGraph, filters]);

  // Handle node click
  const handleNodeClick = useCallback(
    (schemeId: string) => {
      setSelectedScheme(schemeId);
      if (onSchemeSelect) {
        onSchemeSelect(schemeId);
      }
    },
    [onSchemeSelect]
  );

  // Get selected scheme details
  const selectedSchemeDetails = useMemo(() => {
    if (!selectedScheme) return null;

    const scheme = net.schemes.find((s: any) => s.schemeId === selectedScheme);
    const explicitness = explicitnessAnalysis.schemeExplicitness.find(
      (e: any) => e.schemeId === selectedScheme
    );
    const depNode = dependencyGraph.nodes.find(
      (n: any) => n.schemeId === selectedScheme
    );

    // Find incoming and outgoing dependencies
    const incomingDeps = dependencyGraph.edges.filter(
      (e: any) => e.targetSchemeId === selectedScheme
    );
    const outgoingDeps = dependencyGraph.edges.filter(
      (e: any) => e.sourceSchemeId === selectedScheme
    );

    return {
      scheme,
      explicitness,
      depNode,
      incomingDeps,
      outgoingDeps,
    };
  }, [selectedScheme, net, dependencyGraph, explicitnessAnalysis]);

  // Navigate to connected scheme
  const navigateToScheme = useCallback((schemeId: string) => {
    setSelectedScheme(schemeId);
  }, []);

  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">Net Visualization</h2>
          <Badge variant="outline">
            {net.schemes.length} schemes, {dependencyGraph.edges.length} dependencies
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <LayoutSelector currentLayout={layout} onLayoutChange={setLayout} />
          <Button variant="outline" size="sm" onClick={() => setFilters({
            showPrerequisite: true,
            showSupporting: true,
            showEnabling: true,
            showBackground: true,
            minStrength: 0,
            showOnlyCriticalPath: false,
          })}>
            <RefreshCw className="w-4 h-4 mr-1" />
            Reset
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Graph Visualization */}
        <div className="lg:col-span-3">
          <NetGraph
            net={net}
            dependencyGraph={filteredDependencyGraph}
            explicitnessAnalysis={explicitnessAnalysis}
            layout={layout}
            onNodeClick={handleNodeClick}
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Tabs defaultValue="filters">
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="filters">
                <Filter className="w-4 h-4" />
              </TabsTrigger>
              <TabsTrigger value="details">
                <Info className="w-4 h-4" />
              </TabsTrigger>
              <TabsTrigger value="legend">
                <Search className="w-4 h-4" />
              </TabsTrigger>
            </TabsList>

            {/* Filters Tab */}
            <TabsContent value="filters">
              <EdgeFilterPanel filters={filters} onFilterChange={setFilters} />
            </TabsContent>

            {/* Details Tab */}
            <TabsContent value="details">
              {selectedSchemeDetails ? (
                <Card className="p-4 space-y-3">
                  <h3 className="font-semibold text-sm">
                    {selectedSchemeDetails.scheme.schemeName}
                  </h3>

                  <div className="text-xs space-y-2">
                    <div>
                      <span className="font-medium">Role:</span>{" "}
                      {selectedSchemeDetails.scheme.role}
                    </div>
                    <div>
                      <span className="font-medium">Confidence:</span>{" "}
                      {selectedSchemeDetails.scheme.confidence}%
                    </div>
                    <div>
                      <span className="font-medium">Explicitness:</span>{" "}
                      {selectedSchemeDetails.explicitness?.level || "unknown"}
                    </div>
                    <div>
                      <span className="font-medium">Depth:</span>{" "}
                      {selectedSchemeDetails.depNode?.depth || 0}
                    </div>
                  </div>

                  {/* Conclusion */}
                  <div className="text-xs bg-gray-50 rounded p-2">
                    <span className="font-medium">Conclusion:</span>
                    <p className="text-gray-600 mt-1">
                      {selectedSchemeDetails.scheme.conclusion}
                    </p>
                  </div>

                  {/* Dependencies */}
                  {selectedSchemeDetails.incomingDeps.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium">Depends on:</p>
                      <div className="space-y-1">
                        {selectedSchemeDetails.incomingDeps.map((dep: any) => {
                          const sourceScheme = net.schemes.find(
                            (s: any) => s.schemeId === dep.sourceSchemeId
                          );
                          return (
                            <Button
                              key={dep.id}
                              variant="ghost"
                              size="sm"
                              className="w-full justify-start text-xs h-auto py-1"
                              onClick={() => navigateToScheme(dep.sourceSchemeId)}
                            >
                              {sourceScheme?.schemeName} ({dep.type})
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {selectedSchemeDetails.outgoingDeps.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium">Supports:</p>
                      <div className="space-y-1">
                        {selectedSchemeDetails.outgoingDeps.map((dep: any) => {
                          const targetScheme = net.schemes.find(
                            (s: any) => s.schemeId === dep.targetSchemeId
                          );
                          return (
                            <Button
                              key={dep.id}
                              variant="ghost"
                              size="sm"
                              className="w-full justify-start text-xs h-auto py-1"
                              onClick={() => navigateToScheme(dep.targetSchemeId)}
                            >
                              {targetScheme?.schemeName} ({dep.type})
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </Card>
              ) : (
                <Card className="p-4">
                  <p className="text-sm text-gray-500 text-center">
                    Click a scheme to view details
                  </p>
                </Card>
              )}
            </TabsContent>

            {/* Legend Tab */}
            <TabsContent value="legend">
              <StylingLegend />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
