"use client";

import { useState, useCallback, useEffect } from "react";
import { NetGraph } from "./NetGraph";
import { ComposedCQPanel } from "@/components/cqs/ComposedCQPanel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PanelLeftClose, PanelRightClose } from "lucide-react";
import { cn } from "@/lib/utils";

interface NetGraphWithCQsProps {
  net: any;
  dependencyGraph: any;
  explicitnessAnalysis: any;
  layout?: "hierarchical" | "force" | "circular" | "tree";
  argumentId?: string; // Optional: use this instead of net.id for CQ fetching
}

export function NetGraphWithCQs({
  net,
  dependencyGraph,
  explicitnessAnalysis,
  layout = "hierarchical",
  argumentId,
}: NetGraphWithCQsProps) {
  const [selectedSchemes, setSelectedSchemes] = useState<Set<string>>(new Set());
  const [highlightedDependencies, setHighlightedDependencies] = useState<
    Array<{ source: string; target: string }>
  >([]);
  const [showCQPanel, setShowCQPanel] = useState(true);

  // Handle scheme selection from CQ
  const handleSchemeSelect = useCallback((schemeId: string) => {
    setSelectedSchemes(new Set([schemeId]));
    
    // Scroll to scheme in visualization if possible
    const schemeElement = document.getElementById(`scheme-${schemeId}`);
    if (schemeElement) {
      schemeElement.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);

  // Handle dependency highlighting from CQ
  const handleDependencyHighlight = useCallback(
    (sourceId: string, targetId: string) => {
      setHighlightedDependencies([{ source: sourceId, target: targetId }]);
      setSelectedSchemes(new Set([sourceId, targetId]));
    },
    []
  );

  // Handle node click in visualization
  const handleNodeClick = useCallback((schemeId: string) => {
    setSelectedSchemes(new Set([schemeId]));
    setHighlightedDependencies([]);
  }, []);

  // Handle edge click in visualization
  const handleEdgeClick = useCallback((sourceId: string, targetId: string) => {
    setHighlightedDependencies([{ source: sourceId, target: targetId }]);
    setSelectedSchemes(new Set([sourceId, targetId]));
  }, []);

  // Create enhanced net data with highlighting
  const enhancedNet = {
    ...net,
    schemes: net.schemes.map((scheme: any) => ({
      ...scheme,
      _highlighted: selectedSchemes.has(scheme.schemeId),
      _dimmed: selectedSchemes.size > 0 && !selectedSchemes.has(scheme.schemeId),
    })),
  };

  const enhancedDependencyGraph = {
    ...dependencyGraph,
    edges: dependencyGraph.edges.map((edge: any) => {
      const isHighlighted = highlightedDependencies.some(
        (h) => h.source === edge.sourceSchemeId && h.target === edge.targetSchemeId
      );
      return {
        ...edge,
        _highlighted: isHighlighted,
        _dimmed:
          highlightedDependencies.length > 0 && !isHighlighted,
      };
    }),
  };

  return (
    <div className="flex gap-4 h-[calc(100vh-200px)]">
      {/* Visualization Panel */}
      <div
        className={cn(
          "transition-all duration-300",
          showCQPanel ? "flex-1" : "w-full"
        )}
      >
        <Card className="h-full p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Argument Net</h3>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowCQPanel(!showCQPanel)}
            >
              {showCQPanel ? (
                <>
                  <PanelRightClose className="w-4 h-4 mr-2" />
                  Hide Questions
                </>
              ) : (
                <>
                  <PanelLeftClose className="w-4 h-4 mr-2" />
                  Show Questions
                </>
              )}
            </Button>
          </div>
          <div className="h-[calc(100%-60px)]">
            <NetGraph
              net={enhancedNet}
              dependencyGraph={enhancedDependencyGraph}
              explicitnessAnalysis={explicitnessAnalysis}
              layout={layout}
              onNodeClick={handleNodeClick}
              onEdgeClick={handleEdgeClick}
            />
          </div>
        </Card>
      </div>

      {/* CQ Panel */}
      {showCQPanel && (
        <div className="w-[450px] overflow-y-auto">
          <ComposedCQPanel
            netId={argumentId || (net.id?.startsWith('net-') ? net.rootArgumentId : net.id)}
            onSchemeSelect={handleSchemeSelect}
            onDependencyHighlight={handleDependencyHighlight}
          />
        </div>
      )}
    </div>
  );
}
