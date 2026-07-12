// lib/represent/coverSet.ts
// Max-min greedy selection using cosine on TF-IDF-ish hashing (no heavy deps).

function bag(text: string) {
    const toks = (text.toLowerCase().match(/\b[a-z]{3,}\b/g) || []).slice(0, 400);
    const map = new Map<string, number>();
    toks.forEach(t => map.set(t, (map.get(t) || 0) + 1));
    return map;
  }
  function cos(a: Map<string,number>, b: Map<string,number>) {
    let dot=0,na=0,nb=0;
    a.forEach((va,k)=>{ na+=va*va; const vb=b.get(k)||0; dot+=va*vb; });
    b.forEach(vb=> nb+=vb*vb);
    return (dot / (Math.sqrt(na)*Math.sqrt(nb) || 1)) || 0;
  }
  
  export function selectMaxMin<T>(items: T[], getText: (x: T)=>string, k: number): T[] {
    if (items.length <= k) return items;
    const vecs = items.map(it => bag(getText(it)));
    const chosen: number[] = [0];
    const scores = new Float64Array(items.length).fill(0);
    for (let m=1;m<k;m++){
      let best = -1, bestScore = -1;
      for (let i=0;i<items.length;i++){
        if (chosen.includes(i)) continue;
        const dmin = Math.min(...chosen.map(j => 1 - cos(vecs[i], vecs[j])));
        if (dmin > bestScore) { bestScore = dmin; best = i; }
      }
      if (best >= 0) chosen.push(best);
      else break;
    }
    return chosen.map(i => items[i]);
  }
  