import { grounded, preferred } from '@/lib/argumentation';
import { projectToAF } from './af';

type ProjectArgs = Parameters<typeof projectToAF>;

export function computeAcceptance(nodes: ProjectArgs[0], edges: ProjectArgs[1], mode: 'grounded'|'preferred'|'hybrid') {
  const { ids, attacks } = projectToAF(nodes, edges);
  const labels: Record<string, 'undecided'|'skeptical-accepted'|'credulous-accepted'|'rejected'> = {};
  if (mode === 'grounded' || mode === 'hybrid') {
    const inSet = grounded(ids, attacks);
    const outSet = new Set<string>();
    for (const [x, y] of attacks) if (inSet.has(x)) outSet.add(y);
    for (const id of ids) labels[id] = inSet.has(id) ? 'skeptical-accepted'
                         : outSet.has(id) ? 'rejected'
                         : 'undecided';
  }
  if (mode === 'preferred' || mode === 'hybrid') {
    const exts = preferred(ids, attacks);
    for (const id of ids) {
      if (labels[id] === 'undecided' && exts.some(ext => ext.has(id))) labels[id] = 'credulous-accepted';
    }
  }
  return labels;
}
