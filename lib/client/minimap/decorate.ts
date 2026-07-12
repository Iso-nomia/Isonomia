import type { MinimapNode } from '@/components/dialogue/minimap/types';

export function computeFogForNodes(
  nodeIds: string[],
  moves: Array<{ kind:'WHY'|'GROUNDS'|'CONCEDE'|'RETRACT'|'CLOSE'; targetType:string; targetId:string; fromId?:string; toId?:string; }>
): Record<string, boolean> {
  const explored = new Set<string>();
  for (const m of moves) {
    if (m.kind === 'WHY' || m.kind === 'GROUNDS') {
      if (m.targetType === 'claim' && m.targetId) explored.add(String(m.targetId));
      if (m.fromId) explored.add(String(m.fromId));
      if (m.toId) explored.add(String(m.toId));
    }
  }
  return Object.fromEntries(nodeIds.map(id => [id, !explored.has(id)]));
}

/** Merge dialectic.stats['claim:<id>'].openWhy onto nodes as hasOpenCq. */
export function applyOpenWhyCounts(
  nodes: MinimapNode[],
  stats: Record<string, { openWhy: number }>
): MinimapNode[] {
  return nodes.map(n => {
    const key = `claim:${n.id}`;
    const count = stats?.[key]?.openWhy ?? 0;
    return { ...n, hasOpenCq: count > 0 ? count : undefined };
  });
}
