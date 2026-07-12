// lib/practical/compute.ts
export function mcdaResult(criteria: {id:string, weight:number}[], options:{id:string}[], scores: Record<string, Record<string, number>>) {
    const totals: Record<string, number> = {};
    for (const o of options) {
      totals[o.id] = 0;
      for (const c of criteria) {
        const s = scores[o.id]?.[c.id] ?? 0;
        totals[o.id] += c.weight * s;
      }
    }
    const bestOptionId = Object.entries(totals).sort((a,b)=>b[1]-a[1])[0]?.[0] ?? null;
    return { bestOptionId, totals };
  }
  
  export function sensitivity(
    criteria: {id:string, weight:number}[],
    options:{id:string}[],
    scores: Record<string, Record<string, number>>,
    epsilon = 0.1 // ±10% per criterion
  ){
    const base = mcdaResult(criteria, options, scores);
    if (!base.bestOptionId) return { stable:false, flips:[] as {criterionId:string, dir:'+'|'-'}[] };
  
    const flips: {criterionId:string, dir:'+'|'-'}[] = [];
    for (const c of criteria) {
      for (const dir of ['+','-'] as const) {
        const mutated = criteria.map(k => k.id===c.id
          ? { ...k, weight: Math.max(0, k.weight * (dir==='+' ? (1+epsilon) : (1-epsilon))) }
          : k
        );
        const r = mcdaResult(mutated, options, scores);
        if (r.bestOptionId && r.bestOptionId !== base.bestOptionId) {
          flips.push({ criterionId: c.id, dir });
        }
      }
    }
    return { stable: flips.length === 0, flips };
  }
  