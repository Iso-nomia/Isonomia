/**
 * ClusterGrid Component
 * 
 * Displays all semantic clusters in a responsive grid layout
 * with hover interactions and example text.
 * 
 * Week 6, Task 6.2: Cluster Grid UI
 */

"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ClusterCard } from "./ClusterCard";
import type { SemanticCluster } from "@/lib/schemes/semantic-clusters";

interface ClusterGridProps {
  clusters: SemanticCluster[];
  clusterCounts?: Record<string, number>;
  onClusterSelect: (clusterId: string) => void;
  onClusterHover?: (clusterId: string | null) => void;
  hoveredCluster?: string | null;
  compactMode?: boolean;
}

export function ClusterGrid({
  clusters,
  clusterCounts,
  onClusterSelect,
  onClusterHover,
  hoveredCluster,
  compactMode = false,
}: ClusterGridProps) {
  const [localHover, setLocalHover] = useState<string | null>(null);
  const activeHover = hoveredCluster || localHover;

  const handleHover = (clusterId: string | null) => {
    setLocalHover(clusterId);
    onClusterHover?.(clusterId);
  };

  const hoveredClusterData = activeHover
    ? clusters.find((c) => c.id === activeHover)
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Browse by Topic</h2>
        <p className="text-muted-foreground">
          Select a category to see related argumentation schemes
        </p>
      </div>

      {/* Cluster grid */}
      <div
        className={cn(
          "grid gap-4",
          compactMode
            ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
            : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
        )}
      >
        {clusters.map((cluster) => (
          <ClusterCard
            key={cluster.id}
            cluster={cluster}
            schemeCount={clusterCounts?.[cluster.id]}
            onClick={() => onClusterSelect(cluster.id)}
            onHover={() => handleHover(cluster.id)}
            isHovered={activeHover === cluster.id}
            compact={compactMode}
          />
        ))}
      </div>

      {/* Help text - shows details for hovered cluster */}
      {hoveredClusterData && !compactMode && (
        <Card className="bg-muted/50 p-6 animate-in fade-in duration-200">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{hoveredClusterData.icon}</span>
              <div>
                <p className="font-bold text-lg">{hoveredClusterData.name}</p>
                <p className="text-sm text-muted-foreground">
                  {hoveredClusterData.description}
                </p>
              </div>
            </div>

            <div className="border-t pt-3">
              <p className="text-sm font-medium mb-2">When to use:</p>
              <p className="text-sm text-muted-foreground">
                {hoveredClusterData.typicalUse}
              </p>
            </div>

            <div className="border-t pt-3">
              <p className="text-sm font-medium mb-2">Example arguments:</p>
              <ul className="space-y-1">
                {hoveredClusterData.examples.map((example, idx) => (
                  <li
                    key={idx}
                    className="text-sm text-muted-foreground pl-4 border-l-2"
                  >
                    &ldquo;{example}&rdquo;
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      {/* Quick stats */}
      {clusterCounts && !compactMode && (
        <div className="text-center text-sm text-muted-foreground">
          {clusters.length} categories covering{" "}
          {Object.values(clusterCounts).reduce((a, b) => a + b, 0)} schemes
        </div>
      )}
    </div>
  );
}
