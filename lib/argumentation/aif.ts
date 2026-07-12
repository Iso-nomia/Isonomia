// lib/export/aif.ts
// Minimal AIF mapping: I-nodes (information) and S-nodes (RA: support, CA: attack).
// This keeps it simple while making Mesh graphs portable.

export type NodeId = string;
export type EdgeKind = 'support'|'attack';

export type MeshNode = { id: NodeId; text: string; type?: 'claim'|'evidence'|'reason'|'counter' };
export type MeshEdge = { id?: string; from: NodeId; to: NodeId; kind: EdgeKind };

export type AifINode = { nodeID: string; text: string; type: 'I' };
export type AifSNode = { nodeID: string; text?: string; scheme: 'RA'|'CA'; type: 'S' };
export type AifEdge = { fromID: string; toID: string };
export type AifGraph = { nodes: (AifINode|AifSNode)[]; edges: AifEdge[] };

let sid = 0;
const sId = () => `S${++sid}`;

/**
 * Convert Mesh nodes/edges to a simple AIF:
 * For each support: I(prem) -> S(RA) -> I(conc)
 * For each attack : I(att)  -> S(CA) -> I(conc)
 */
export function toAif(nodes: MeshNode[], edges: MeshEdge[]): AifGraph {
  sid = 0;
  const iNodes: Record<string, AifINode> = {};
  nodes.forEach(n => iNodes[n.id] = { nodeID: n.id, text: n.text, type: 'I' });

  const outNodes: (AifINode|AifSNode)[] = Object.values(iNodes);
  const outEdges: AifEdge[] = [];

  for (const e of edges) {
    const s: AifSNode = {
      nodeID: sId(),
      scheme: e.kind === 'support' ? 'RA' : 'CA',
      type: 'S',
    };
    outNodes.push(s);
    outEdges.push({ fromID: e.from, toID: s.nodeID });
    outEdges.push({ fromID: s.nodeID, toID: e.to });
  }
  return { nodes: outNodes, edges: outEdges };
}

/**
 * Convert simple AIF back to Mesh form (best-effort).
 */
export function fromAif(aif: AifGraph): { nodes: MeshNode[]; edges: MeshEdge[] } {
  const iNodes: MeshNode[] = [];
  const sNodes: AifSNode[] = [];
  for (const n of aif.nodes) {
    if ((n as any).type === 'S') sNodes.push(n as AifSNode);
    else iNodes.push({ id: (n as AifINode).nodeID, text: (n as AifINode).text, type: 'claim' });
  }

  const edges: MeshEdge[] = [];
  for (const s of sNodes) {
    // find in-edges to S and out-edges from S
    const ins = aif.edges.filter(e => e.toID === s.nodeID);
    const outs = aif.edges.filter(e => e.fromID === s.nodeID);
    for (const i of ins) {
      for (const o of outs) {
        edges.push({ from: i.fromID, to: o.toID, kind: s.scheme === 'RA' ? 'support' : 'attack' });
      }
    }
  }
  return { nodes: iNodes, edges };
}
