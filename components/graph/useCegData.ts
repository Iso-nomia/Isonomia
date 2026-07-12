// lib/client/ceg/useCegData.ts
'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import useSWR from 'swr';

export type CegNode = {
  id: string;
  type: 'claim';
  text: string;
  label: 'IN' | 'OUT' | 'UNDEC';
  confidence: number;
  approvals: number;
  
  // Enhanced metrics
  supportStrength: number;
  attackStrength: number;
  netStrength: number;
  inDegree: number;
  outDegree: number;
  centrality: number;
  isControversial: boolean;
  clusterId?: number;
  
  // Legacy fields
  rejections?: number;
  schemeIcon?: string | null;
  authorId?: string;
  createdAt?: string;
};

export type CegEdge = {
  id: string;
  source: string;
  target: string;
  type: 'supports' | 'rebuts' | 'undercuts';
  attackType?: 'SUPPORTS' | 'REBUTS' | 'UNDERCUTS' | 'UNDERMINES';
  targetScope?: 'premise' | 'inference' | 'conclusion' | null;
  confidence: number;
};

export type CegStats = {
  supportWeighted: number;
  counterWeighted: number;
  supportPct: number;
  counterPct: number;
  
  // Semantic counts
  inClaims: number;
  outClaims: number;
  undecClaims: number;
  totalClaims: number;
  
  // Graph metrics
  totalEdges: number;
  clusterCount: number;
  controversialCount: number;
  hubCount: number;
  isolatedCount: number;
  
  // Highlights
  hubs: Array<{ id: string; text: string; centrality: number }>;
  isolated: Array<{ id: string; text: string }>;
  controversial: Array<{ id: string; text: string }>;
  
  timestamp: string;
};

const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then(r => r.json());

export function useCegData(deliberationId: string) {
  const { data: miniData, error: miniError, mutate: mutateMini } = useSWR(
    `/api/deliberations/${deliberationId}/ceg/mini`,
    fetcher,
    { 
      revalidateOnFocus: false,
      refreshInterval: 30000, // Refresh every 30s
    }
  );

  // Extract nodes and edges from the enhanced mini endpoint
  const nodes: CegNode[] = miniData?.nodes ?? [];
  const edges: CegEdge[] = miniData?.edges ?? [];
  
  // Stats are directly in the mini response
  const stats: CegStats | null = miniData ? {
    supportWeighted: miniData.supportWeighted,
    counterWeighted: miniData.counterWeighted,
    supportPct: miniData.supportPct,
    counterPct: miniData.counterPct,
    inClaims: miniData.inClaims,
    outClaims: miniData.outClaims,
    undecClaims: miniData.undecClaims,
    totalClaims: miniData.totalClaims,
    totalEdges: miniData.totalEdges,
    clusterCount: miniData.clusterCount,
    controversialCount: miniData.controversialCount,
    hubCount: miniData.hubCount,
    isolatedCount: miniData.isolatedCount,
    hubs: miniData.hubs ?? [],
    isolated: miniData.isolated ?? [],
    controversial: miniData.controversial ?? [],
    timestamp: miniData.timestamp,
  } : null;

  const loading = !miniData && !miniError;
  const error = miniError;

  // Manual refresh function
  const refresh = useCallback(async () => {
    await mutateMini();
  }, [mutateMini]);

  // Listen for refresh events
  useEffect(() => {
    const handleRefresh = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.deliberationId === deliberationId) {
        refresh();
      }
    };

    window.addEventListener('mesh:ceg:refresh', handleRefresh);
    window.addEventListener('mesh:dialogue:refresh', handleRefresh);
    
    return () => {
      window.removeEventListener('mesh:ceg:refresh', handleRefresh);
      window.removeEventListener('mesh:dialogue:refresh', handleRefresh);
    };
  }, [deliberationId, refresh]);

  return {
    nodes,
    edges,
    stats,
    loading,
    error,
    refresh,
  };
}

// Hook for focused subgraph around a specific node
export function useFocusedCegData(
  deliberationId: string,
  focusNodeId: string | null,
  radius: number = 2
) {
  const { nodes: allNodes, edges: allEdges, loading, error, refresh } = useCegData(deliberationId);

  const { focusedNodes, focusedEdges } = useMemo(() => {
    if (!focusNodeId || allNodes.length === 0) {
      return { focusedNodes: allNodes, focusedEdges: allEdges };
    }

    // BFS to find nodes within radius
    const visited = new Set<string>([focusNodeId]);
    const queue: Array<{ id: string; depth: number }> = [{ id: focusNodeId, depth: 0 }];
    
    const edgeMap = new Map<string, string[]>();
    allEdges.forEach(e => {
      if (!edgeMap.has(e.source)) edgeMap.set(e.source, []);
      if (!edgeMap.has(e.target)) edgeMap.set(e.target, []);
      edgeMap.get(e.source)!.push(e.target);
      edgeMap.get(e.target)!.push(e.source);
    });

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;
      if (depth >= radius) continue;

      const neighbors = edgeMap.get(id) ?? [];
      for (const neighborId of neighbors) {
        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          queue.push({ id: neighborId, depth: depth + 1 });
        }
      }
    }

    const focusedNodes = allNodes.filter(n => visited.has(n.id));
    const focusedEdges = allEdges.filter(
      e => visited.has(e.source) && visited.has(e.target)
    );

    return { focusedNodes, focusedEdges };
  }, [focusNodeId, allNodes, allEdges, radius]);

  return {
    nodes: focusedNodes,
    edges: focusedEdges,
    loading,
    error,
    refresh,
  };
}