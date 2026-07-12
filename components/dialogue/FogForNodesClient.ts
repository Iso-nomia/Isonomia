export function computeFogForNodes(
  nodeIds: string[],
  moves: Array<{ kind:'WHY'|'GROUNDS'|'CONCEDE'|'RETRACT'|'CLOSE'; targetId:string; fromId?:string; toId?:string; }>
): Record<string, boolean> {
  const explored = new Set<string>();
  moves.forEach(m => {
    if (m.kind === 'WHY' || m.kind === 'GROUNDS') {
      if (m.targetId) explored.add(m.targetId);
      if (m.fromId) explored.add(m.fromId);
      if (m.toId) explored.add(m.toId);
    }
  });
  return Object.fromEntries(nodeIds.map(id => [id, !explored.has(id)]));
}
