// lib/graph/supplyOverlay.ts
export type SupplyEdge = {
    id: string;
    fromWorkId?: string | null;
    toWorkId?: string | null;
    fromClaimId?: string | null;
    toClaimId?: string | null;
  };
  
  export function toCySupplyElements(
    edges: SupplyEdge[],
    nodeIdFor: (kind:'work'|'claim', id:string)=>string = (kind, id) => `${kind}:${id}`
  ) {
    const els: any[] = [];
    for (const e of edges) {
      const src =
        e.fromWorkId ? nodeIdFor('work', e.fromWorkId) :
        e.fromClaimId ? nodeIdFor('claim', e.fromClaimId) : null;
      const tgt =
        e.toWorkId ? nodeIdFor('work', e.toWorkId) :
        e.toClaimId ? nodeIdFor('claim', e.toClaimId) : null;
      if (!src || !tgt) continue;
      els.push({
        group: 'edges',
        data: { id: `supply:${e.id}`, source: src, target: tgt, kind: 'SUPPLIES_PREMISE' },
        classes: 'supply'
      });
    }
    return els;
  }
  
  export const supplyStyle = [
    {
      selector: 'edge.supply',
      style: {
        'line-color': '#16a34a',         // emerald-600
        'target-arrow-color': '#16a34a',
        'target-arrow-shape': 'triangle',
        'line-style': 'dotted',
        'width': 2,
        'curve-style': 'bezier',
        'opacity': 0.9,
      }
    }
  ];
  