'use client';
import useSWR from 'swr';
import { useMemo, useEffect } from 'react';
import { computeFogForNodes, applyOpenWhyCounts } from './decorate';
import { adaptGraphToMinimap, type GraphResp } from '@/components/dialogue/command-card/adapters';

const fetcher = (u: string) => fetch(u, { cache: 'no-store' }).then(r => r.json());

export function useMinimapData(deliberationId: string, opts?: {
  semantics?: 'grounded' | 'preferred' | null;
  supportDefense?: boolean;
  focus?: string | null;
  radius?: number;
  maxNodes?: number;
}) {
  const params = new URLSearchParams();
  if (opts?.semantics) params.set('semantics', opts.semantics);
  if (opts?.supportDefense) params.set('supportDefense', '1');
  if (opts?.focus) params.set('focus', opts.focus);
  if (opts?.radius != null) params.set('radius', String(opts.radius));
  if (opts?.maxNodes != null) params.set('maxNodes', String(opts.maxNodes));

  const graphKey = `/api/deliberations/${encodeURIComponent(deliberationId)}/graph${params.toString() ? `?${params}` : ''}`;
  const movesKey = `/api/deliberations/${encodeURIComponent(deliberationId)}/moves?limit=500`;
  const dialKey = `/api/deliberations/${encodeURIComponent(deliberationId)}/dialectic?lens=preferred`;

  const { data: g, error: gErr, isLoading: gLoading, mutate: gMutate } = useSWR<GraphResp>(graphKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 2000,
  });
  
  const { data: mv, error: mvErr, isLoading: mvLoading, mutate: mvMutate } = useSWR<{ items: any[] }>(movesKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 2000,
  });
  
  const { data: dia, error: diaErr, isLoading: diaLoading, mutate: diaMutate } = useSWR<{ stats: Record<string, { openWhy: number }> }>(dialKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 2000,
  });

  // Listen for refresh events
  useEffect(() => {
    const handleRefresh = () => {
      console.log('Minimap: refresh event received');
      gMutate();
      mvMutate();
      diaMutate();
    };

    window.addEventListener('mesh:dialogue:refresh', handleRefresh);
    return () => window.removeEventListener('mesh:dialogue:refresh', handleRefresh);
  }, [gMutate, mvMutate, diaMutate]);

  // Combine loading and error states
  const loading = gLoading || mvLoading || diaLoading;
  const error = gErr || mvErr || diaErr;

  const composed = useMemo(() => {
    if (!g) return { nodes: [], edges: [] as any[] };
    
    try {
      const { nodes: baseNodes, edges } = adaptGraphToMinimap(g);

      // Fog based on WHY/GROUNDS
      const fog = computeFogForNodes(
        baseNodes.map(n => n.id),
        (mv?.items ?? []).map(m => ({
          kind: m.kind,
          targetType: m.targetType,
          targetId: m.targetId,
          fromId: m.fromId,
          toId: m.toId
        }))
      );

      // Open WHY counts from dialectic
      const withCounts = applyOpenWhyCounts(
        baseNodes.map(n => ({ ...n, fogged: fog[n.id] ?? true })),
        dia?.stats ?? {}
      );

      console.log('Minimap data composed:', {
        nodes: withCounts.length,
        edges: edges.length,
        loading,
        error: error ? String(error) : null
      });

      return { nodes: withCounts, edges };
    } catch (err) {
      console.error('Error composing minimap data:', err);
      return { nodes: [], edges: [] as any[] };
    }
  }, [g, mv, dia, loading, error]);

  return {
    nodes: composed.nodes,
    edges: composed.edges,
    loading,
    error,
    refresh: () => {
      gMutate();
      mvMutate();
      diaMutate();
    }
  };
}