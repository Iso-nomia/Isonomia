// components/dialogue/useGraphAF.ts
'use client';
import useSWR from 'swr';
import type { AFNode, AFEdge } from '@/lib/argumentation';

const fetcher = (u: string) => fetch(u, { cache: 'no-store' }).then(r => r.json());

export function useDeliberationAF(deliberationId: string, params = 'semantics=grounded&supportDefense=1') {
  const { data } = useSWR(
    `/api/deliberations/${encodeURIComponent(deliberationId)}/graph?${params}`,
    fetcher
  );
  const nodes: AFNode[] = (data?.nodes || []).map((n: any) => ({ id: n.id, label: n.label, text: n.text }));
  const edges: AFEdge[] = (data?.edges || []).map((e: any) => ({
    from: e.source,
    to: e.target,
    type: (e.type === 'rebuts' || e.attackType === 'REBUTS' || e.attackType === 'UNDERCUTS' || e.attackType === 'UNDERMINES')
      ? 'attack'
      : 'support',
  }));
  return { nodes, edges, raw: data };
}
