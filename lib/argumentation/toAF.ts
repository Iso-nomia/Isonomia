// Example adapter (put wherever you gather items)
import type { AFNode, AFEdge } from '@/lib/argumentation';

export function toAFFromArguments(items: Array<{ id:string; text:string; edgesOut?: Array<{ to: string; type: 'support'|'rebut'|'undercut' }> }>) {
  const nodes: AFNode[] = items.map(a => ({ id: a.id, text: a.text, label: a.text.slice(0, 80) }));
  const edges: AFEdge[] = [];
  for (const a of items) {
    for (const e of (a.edgesOut || [])) {
      // only include edges whose target is within the current slice
      if (items.find(x => x.id === e.to)) edges.push({ from: a.id, to: e.to, type: e.type });
    }
  }
  return { nodes, edges };
}
