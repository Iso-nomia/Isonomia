/**
 * ClusterBrowser Component
 * 
 * Main component for browsing argument schemes by semantic cluster.
 * Shows cluster grid initially, then scheme list when cluster selected.
 * 
 * Week 6, Task 6.2: Cluster Grid UI
 */

"use client";

import { useState } from "react";
import useSWR from "swr";
import { ClusterGrid } from "./ClusterGrid";
import { ClusterSchemeList } from "./ClusterSchemeList";
import type { ArgumentScheme } from "@prisma/client";
import {
  semanticClusters,
  getSchemesForCluster,
  getClusterCounts,
  getClusterOrder,
} from "@/lib/schemes/semantic-clusters";

interface ClusterBrowserProps {
  onSchemeSelect: (scheme: ArgumentScheme) => void;
  initialCluster?: string;
  compactMode?: boolean;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function ClusterBrowser({
  onSchemeSelect,
  initialCluster,
  compactMode = false,
}: ClusterBrowserProps) {
  const [selectedCluster, setSelectedCluster] = useState<string | null>(
    initialCluster || null
  );
  const [hoveredCluster, setHoveredCluster] = useState<string | null>(null);

  // Fetch all schemes
  const { data: schemes, isLoading } = useSWR<ArgumentScheme[]>(
    "/api/schemes/all",
    fetcher
  );

  // Calculate cluster counts
  const clusterCounts = schemes ? getClusterCounts(schemes) : undefined;

  // Get clusters in display order
  const orderedClusters = getClusterOrder().map(
    (id) => semanticClusters[id]
  );

  // If no cluster selected, show grid
  if (!selectedCluster) {
    return (
      <ClusterGrid
        clusters={orderedClusters}
        clusterCounts={clusterCounts}
        onClusterSelect={setSelectedCluster}
        onClusterHover={setHoveredCluster}
        hoveredCluster={hoveredCluster}
        compactMode={compactMode}
      />
    );
  }

  // Show schemes in selected cluster
  const cluster = semanticClusters[selectedCluster];
  const clusterSchemes = schemes
    ? getSchemesForCluster(selectedCluster, schemes)
    : [];

  return (
    <ClusterSchemeList
      cluster={cluster}
      schemes={clusterSchemes}
      onSchemeSelect={onSchemeSelect}
      onBack={() => setSelectedCluster(null)}
      compact={compactMode}
    />
  );
}
