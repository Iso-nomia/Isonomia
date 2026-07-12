// packages/aif-core/src/validate.ts
export function validateAif(nodes:any[], edges:any[]) {
  const typeById = Object.fromEntries(nodes.map(n => [n['@id'], n['@type']]));
  const outgoing = edges.reduce((m,e) => (m[e.from] ??= []).push(e), {} as Record<string,any[]>);
  const incoming = edges.reduce((m,e) => (m[e.to]   ??= []).push(e), {} as Record<string,any[]>);

  // 1) No I→I edges directly (Condition 2)
  for (const e of edges) {
    if (typeById[e.from] === 'aif:InformationNode' && typeById[e.to] === 'aif:InformationNode') {
      throw new Error('Invalid I→I edge; must be mediated by S-node (RA/CA/PA)');
    }
  }
  // 2) RA role cardinalities (Condition 4)
  for (const n of nodes.filter(n => n['@type']==='aif:RA')) {
    const prem = (incoming[n['@id']]||[]).filter((e: any) => e['@type']==='aif:Premise').length;
    const concl= (outgoing[n['@id']]||[]).filter((e: any) => e['@type']==='aif:Conclusion').length;
    if (!(prem>=1 && concl===1)) throw new Error(`RA ${n['@id']} violates premise/conclusion cardinality`);
  }
  // 3) CA role cardinalities (Condition 6)
  for (const n of nodes.filter(n => n['@type']==='aif:CA')) {
    const left = (incoming[n['@id']]||[]).filter((e: any) => e['@type']==='aif:ConflictingElement').length;
    const right= (outgoing[n['@id']]||[]).filter((e: any) => e['@type']==='aif:ConflictedElement').length;
    if (!(left===1 && right===1)) throw new Error(`CA ${n['@id']} violates conflicting/conflicted cardinality`);
  }
  // 4) PA role cardinalities (Condition 5)
  for (const n of nodes.filter(n => n['@type']==='aif:PA')) {
    const left = (incoming[n['@id']]||[]).filter((e: any) => e['@type']==='aif:PreferredElement').length;
    const right= (outgoing[n['@id']]||[]).filter((e: any) => e['@type']==='aif:DispreferredElement').length;
    if (!(left===1 && right===1)) throw new Error(`PA ${n['@id']} violates preferred/dispreferred cardinality`);
  }

  return { ok:true };
}
