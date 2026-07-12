// lib/argumentation/vaf.ts
// Lightweight VAF overlay: down/up-weight attacks depending on value preferences.
// Pair this with your weightedBAF propagation to get value-aware acceptability.

export type NodeId = string;
export type ValueKey = 'economic'|'security'|'fairness'|'morality'|'capacity';

export type VafNode = {
  id: NodeId;
  text?: string;
  values?: Partial<Record<ValueKey, number>>; // salience per value, e.g., {security: 1, fairness: 0.3}
};

export type EdgeKind = 'support' | 'attack';
export type VafEdge = { from: NodeId; to: NodeId; kind: EdgeKind; weight?: number };

export type PreferenceOrder = ValueKey[]; // e.g., ['security','fairness','economic','morality','capacity']

/**
 * Compute a preference score for a node given a value ordering.
 * Higher means more aligned with earlier (preferred) values.
 */
export function preferenceScore(node: VafNode, order: PreferenceOrder): number {
  if (!node.values) return 0;
  const pos = new Map(order.map((k, i) => [k, order.length - i])); // earlier => bigger
  let s = 0, w = 0;
  for (const [k, v] of Object.entries(node.values) as [ValueKey, number][]) {
    if (!Number.isFinite(v)) continue;
    const p = pos.get(k) ?? 0;
    s += v * p;
    w += Math.abs(v);
  }
  return w ? s / w : 0;
}

/**
 * Adjust edge weights according to VAF intuition:
 * - An attack is stronger if attacker aligns with preferred values more than target.
 * - If target aligns more, the attack weakens (down to a floor).
 * Supports can be left unchanged or lightly boosted when aligned.
 */
export function reweightEdgesByValues(
  nodes: VafNode[],
  edges: VafEdge[],
  order: PreferenceOrder,
  { attackAmp = 0.35, attackFloor = 0.15, supportBoost = 0.1 } = {}
): VafEdge[] {
  const byId = new Map(nodes.map(n => [n.id, n]));
  const pref = new Map(nodes.map(n => [n.id, preferenceScore(n, order)]));

  return edges.map(e => {
    const a = pref.get(e.from) ?? 0;
    const b = pref.get(e.to) ?? 0;
    if (e.kind === 'attack') {
      const delta = a - b; // >0 attacker more aligned than target
      const factor = delta > 0 ? (1 + Math.min(attackAmp, delta * attackAmp)) : Math.max(attackFloor, 1 + delta * attackAmp);
      return { ...e, weight: Math.max(0, (e.weight ?? 1) * factor) };
    } else {
      // small positive nudge for aligned support
      const factor = 1 + Math.max(0, a) * supportBoost * 0.1;
      return { ...e, weight: Math.max(0, (e.weight ?? 1) * factor) };
    }
  });
}
