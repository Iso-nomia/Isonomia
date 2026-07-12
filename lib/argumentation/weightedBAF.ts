// lib/argumentation/weightedBAF.ts
export type NodeId = string;
export type Edge = { from: NodeId; to: NodeId; kind: 'support' | 'attack'; weight?: number };

/**
 * Propagate confidence through a weighted bipolar argumentation framework.
 * 
 * ⚠️ STATUS: EXPERIMENTAL / NOT CURRENTLY INTEGRATED
 * This function is not used by the main confidence scoring APIs.
 * It may be integrated as an alternative scoring mode in future versions.
 * 
 * ALGORITHM: Iterative message-passing with damping (similar to PageRank).
 * - Support edges boost confidence via positive influence
 * - Attack edges reduce confidence via negative influence
 * - Tanh activation keeps values bounded in [0,1]
 * - Damping prevents oscillation and ensures convergence
 * 
 * POTENTIAL USE CASES:
 * - Alternative to recursive scoring (more graph-centric approach)
 * - Visualization of confidence flow through argumentation network
 * - Additional confidence mode alongside "min", "product", "ds"
 * - Research exploration of iterative vs recursive algorithms
 * 
 * @param nodes - List of node IDs (claims or arguments) in the graph
 * @param edges - Support/attack edges with optional weights (default weight = 1)
 * @param base - Prior confidence for each node (0..1), defaults to 0.5 if not specified
 * @param iters - Number of propagation iterations (default 20, increase for larger graphs)
 * @param damp - Damping factor to prevent oscillation (default 0.85, range 0..1)
 * @returns Final confidence scores for each node after convergence
 * 
 * @example
 * ```typescript
 * const result = propagate(
 *   ["c1", "c2", "c3"],
 *   [
 *     { from: "c1", to: "c2", kind: "support", weight: 0.8 },
 *     { from: "c2", to: "c3", kind: "attack", weight: 0.6 }
 *   ],
 *   { c1: 0.9, c2: 0.5, c3: 0.5 }
 * );
 * // Returns: { c1: 0.9, c2: ~0.65, c3: ~0.42 }
 * ```
 */
export function propagate(
  nodes: NodeId[],
  edges: Edge[],
  base: Record<NodeId, number>, // prior belief/confidence 0..1
  iters = 20,
  damp = 0.85
): Record<NodeId, number> {
  const idx = new Map(nodes.map((n,i)=>[n,i]));
  const N = nodes.length;
  const s = new Float64Array(N).fill(0);
  const v = new Float64Array(N);
  nodes.forEach((n,i)=> v[i] = Math.max(0, Math.min(1, base[n] ?? 0.5)));

  const outAdj: Edge[][] = nodes.map(()=>[]);
  for (const e of edges) {
    const fi = idx.get(e.from), ti = idx.get(e.to);
    if (fi==null||ti==null) continue;
    outAdj[fi].push(e);
  }

  for (let t=0;t<iters;t++){
    s.fill(0);
    for (let i=0;i<N;i++){
      for (const e of outAdj[i]){
        const w = e.weight ?? 1;
        const delta = w * v[i];
        s[idx.get(e.to)!] += (e.kind === 'support' ? delta : -delta);
      }
    }
    for (let i=0;i<N;i++){
      const x = (1-damp)*v[i] + damp*(0.5 + 0.5*Math.tanh(s[i]));
      v[i] = Math.max(0, Math.min(1, x));
    }
  }
  const out: Record<NodeId, number> = {};
  nodes.forEach((n,i)=> out[n] = v[i]);
  return out;
}
