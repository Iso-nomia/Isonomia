// // lib/export/aif.ts
// export type NodeId = string;
// export type EdgeKind = 'supports'|'rebuts'|'undercuts'|'attacks';

// export type ClaimNode = {
//   id: NodeId;
//   text: string;
//   type?: 'claim';
//   label?: 'IN'|'OUT'|'UNDEC';
//   approvals?: number;
// };

// export type ClaimEdge = {
//   id?: string;
//   source: NodeId;
//   target: NodeId;
//   type: 'supports' | 'rebuts';
//   attackType?: 'SUPPORTS'|'REBUTS'|'UNDERCUTS'|'UNDERMINES';
//   targetScope?: 'premise'|'inference'|'conclusion'|null;
// };

// export type AifINode = { nodeID: string; text: string; type: 'I' };
// export type AifSNode = { nodeID: string; scheme: 'RA'|'CA'; type: 'S'; text?: string };
// export type AifEdge = { fromID: string; toID: string };
// export type AifGraph = { nodes: (AifINode|AifSNode)[]; edges: AifEdge[] };

// let sid = 0;
// const sId = () => `S${++sid}`;

// /** Mesh (claims) -> AIF (RA/CA S-nodes) */
// export function toAif(nodes: ClaimNode[], edges: ClaimEdge[]): AifGraph {
//   sid = 0;
//   const mapI: Record<string, AifINode> = {};
//   nodes.forEach(n => { mapI[n.id] = { nodeID: n.id, text: n.text, type: 'I' }; });

//   const outNodes: (AifINode|AifSNode)[] = Object.values(mapI);
//   const outEdges: AifEdge[] = [];

//   for (const e of edges) {
//     const isAttack = e.type === 'rebuts' || e.attackType === 'REBUTS' || e.attackType === 'UNDERCUTS' || e.attackType === 'UNDERMINES';
//     const scheme: 'RA'|'CA' = isAttack ? 'CA' : 'RA';
//     const s: AifSNode = { nodeID: sId(), scheme, type: 'S' };
//     outNodes.push(s);
//     outEdges.push({ fromID: e.source, toID: s.nodeID });
//     outEdges.push({ fromID: s.nodeID, toID: e.target });
//   }

//   return { nodes: outNodes, edges: outEdges };
// }

// /** AIF -> Mesh (claims, edges). All S:RA -> supports; S:CA -> rebuts (attack). */
// export function fromAif(aif: AifGraph): { nodes: ClaimNode[]; edges: ClaimEdge[] } {
//   const claimNodes: ClaimNode[] = [];
//   const sNodes: AifSNode[] = [];
//   for (const n of aif.nodes) {
//     if ((n as any).type === 'S') sNodes.push(n as AifSNode);
//     else {
//       const I = n as AifINode;
//       claimNodes.push({ id: I.nodeID, text: I.text, type: 'claim' });
//     }
//   }

//   const edges: ClaimEdge[] = [];
//   for (const s of sNodes) {
//     const ins = aif.edges.filter(e => e.toID === s.nodeID);
//     const outs = aif.edges.filter(e => e.fromID === s.nodeID);
//     const type = s.scheme === 'RA' ? 'supports' : 'rebuts';
//     for (const i of ins) for (const o of outs) {
//       edges.push({
//         source: i.fromID,
//         target: o.toID,
//         type,
//         attackType: type === 'supports' ? 'SUPPORTS' : 'REBUTS',
//         targetScope: type === 'rebuts' ? 'conclusion' : null,
//       });
//     }
//   }

//   return { nodes: claimNodes, edges };
// }
export { exportDeliberationAsAifJSONLD } from '@/packages/aif-core/src/export';
