/**
 * AnalyticsTab Component
 * 
 * Displays categorical hom-set confidence analysis for arguments in the deliberation.
 * Wraps the HomSetsTab component to provide analytics visualization.
 * 
 * Part of DeepDivePanel V3 migration - Week 4, Task 4.2
 * Uses BaseTabProps (simplest interface - no state management needed)
 */

import * as React from "react";
import useSWR from "swr";
import { BaseTabProps } from "./types";
import { SectionCard } from "../../shared/SectionCard";
import { HomSetComparisonChart } from "@/components/agora/HomSetComparisonChart";

/**
 * Fetcher function for SWR
 */
const fetcher = (url: string) => fetch(url).then((res) => res.json());

/**
 * HomSetsTab - Internal component for hom-set confidence visualization
 * 
 * Fetches arguments with AIF data and computes categorical hom-set confidence
 * metrics based on edge counts. Uses categorical join operations (product mode)
 * to aggregate confidence across attack relationships.
 */
function HomSetsTab({ deliberationId }: { deliberationId: string }) {
  const { data, error, isLoading } = useSWR(
    `/api/deliberations/${deliberationId}/arguments/aif?limit=50`,
    fetcher,
    { revalidateOnFocus: false }
  );

  // Transform arguments to include hom-set confidence metrics
  const argumentsWithHomSets = React.useMemo(() => {
    if (!data?.items) return [];

    return data.items
      .filter((arg: any) => arg.aif?.conclusion?.id)
      .map((arg: any) => {
        // Categorical hom-set confidence: aggregate edge strengths via join operation
        // Based on evidential closed category semantics (Ambler 1996)
        
        // Collect edge counts (proxies for confidence in absence of explicit scores)
        const incomingCount = (arg.aif?.attacks?.REBUTS || 0) + 
                              (arg.aif?.attacks?.UNDERCUTS || 0) + 
                              (arg.aif?.attacks?.UNDERMINES || 0);
        const outgoingCount = arg.aif?.outgoingAttacks || 0; // If available
        const totalEdges = incomingCount + outgoingCount;
        
        // Compute hom-set confidence based on mode (default to 'product' if not specified)
        // In future: use actual ArgumentEdge.confidence scores when available
        let homSetConfidence = 0;
        
        if (totalEdges > 0) {
          // Default edge confidence (can be refined when ArgumentEdge.confidence is added)
          const defaultEdgeConfidence = 0.7;
          
          // Categorical join operation based on confidence mode:
          // - 'min': Weakest-link (best single edge) - max of individual confidences
          // - 'product': Independent accrual (noisy-OR) - 1 - ∏(1 - cᵢ)
          // - 'ds': Dempster-Shafer (simplified as max for now)
          
          // For now, use simplified heuristic based on edge count
          // Product mode (noisy-OR): confidence increases with more edges
          homSetConfidence = 1 - Math.pow(1 - defaultEdgeConfidence, totalEdges);
          
          // Min mode would use: Math.max(...edgeConfidences) ≈ defaultEdgeConfidence
          // (single edge = defaultEdgeConfidence, multiple = same)
        }
        
        return {
          id: arg.id,
          title: arg.aif?.conclusion?.text || arg.text || "Untitled Argument",
          homSetConfidence,
          incomingCount,
          outgoingCount,
        };
      })
      .slice(0, 20); // Limit to top 20 for performance
  }, [data]);

  return (
    <SectionCard title="Categorical Analysis" isLoading={isLoading}>
      <p className="text-sm text-slate-600 mb-4">
        Comparative hom-set confidence analysis across arguments in this deliberation.
      </p>
      
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          Failed to load argument data: {error.message || "Unknown error"}
        </div>
      )}
      
      {!isLoading && !error && argumentsWithHomSets.length === 0 && (
        <div className="p-6 bg-slate-50 rounded-lg border border-slate-200 text-center">
          <p className="text-sm text-slate-500">
            No arguments with hom-set data available yet.
          </p>
        </div>
      )}
      
      {!isLoading && !error && argumentsWithHomSets.length > 0 && (
        <HomSetComparisonChart
          arguments={argumentsWithHomSets}
          onArgumentClick={(id) => {
            // Scroll to argument in debate tab
            window.location.hash = `arg-${id}`;
            const el = document.getElementById(`arg-${id}`);
            if (el) {
              el.scrollIntoView({ behavior: "smooth", block: "center" });
            }
          }}
        />
      )}
    </SectionCard>
  );
}

/**
 * AnalyticsTab Component
 * 
 * Main analytics tab for the deliberation panel. Currently displays
 * categorical hom-set confidence analysis via HomSetsTab.
 * 
 * @param deliberationId - The ID of the deliberation to analyze
 * @param currentUserId - The ID of the current user (not used currently)
 * @param className - Optional additional CSS classes
 */
export function AnalyticsTab({ 
  deliberationId, 
  currentUserId, 
  className 
}: BaseTabProps) {
  return (
    <div className={className}>
      <HomSetsTab deliberationId={deliberationId} />
    </div>
  );
}
