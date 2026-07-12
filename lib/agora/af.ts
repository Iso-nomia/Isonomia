// lib/agora/af.ts
import type { SheetDebateNode, SheetDebateEdge } from './types/types';


// Project debate edges into AF attacks
export function projectToAF(nodes: SheetDebateNode[], edges: SheetDebateEdge[]) {
  const ids = nodes.map(n => n.id);
  const attacks: Array<[string, string]> = [];
  for (const e of edges) {
    if (e.kind === 'rebuts' || e.kind === 'objects' || e.kind === 'undercuts') {
      attacks.push([e.fromId, e.toId]);
    }
  }
  return { ids, attacks };
}
