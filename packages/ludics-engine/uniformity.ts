type Pair = { posActId?: string; negActId?: string; locusPath: string; ts: number };
type TracePair = { locusPath: string; polarity: 'P'|'O'|'♦' }[];
export type ShadowStep = { polarity: 'P'|'O'|'♦'; locusPath: string };



// α-equiv across σ·i : rename the *child index/name segment* under base
export function alphaEquivalent(a: ShadowStep[], b: ShadowStep[], base: string): boolean {
    const ren = new Map<string,string>();
    function canon(path: string, map: Map<string,string>) {
      if (!path.startsWith(base + '.')) return path;
      const segs = path.split('.');
      // [base, child, ...rest] -> map child to canonical
      if (segs.length >= base.split('.').length + 1) {
        const child = segs[base.split('.').length];
        if (!map.has(child)) map.set(child, `•`);
        segs[base.split('.').length] = map.get(child)!;
        return segs.join('.');
      }
      return path;
    }
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i].polarity !== b[i].polarity) return false;
      const pa = canon(a[i].locusPath, ren);
      const pb = canon(b[i].locusPath, ren);
      if (pa !== pb) return false;
    }
    return true;
  }
// export function normalizeTrace(pairs: { posActId: string; negActId: string; ts: number }[], byId: Map<string, any>) {
//   // Project to a locusPath-only shadow and stabilize child indices by first-seen order.
//   const out: Pair[] = [];
//   const ren: Record<string, number> = {};   // childSuffix -> 0/1/2 by first-seen
//   let next = 0;

//   const pathOf = (id?: string) => (id && byId.get(id)?.locus?.path) ?? '0';
//   for (const p of pairs) {
//     const L = pathOf(p.posActId) || pathOf(p.negActId);
//     const comps = L.split('.');
//     const base = comps.slice(0, -1).join('.');
//     const tail = comps[comps.length - 1] ?? '';
//     const k = Number(tail);
//     let norm = L;
//     if (Number.isInteger(k)) {
//       if (!(tail in ren)) ren[tail] = next++;
//       const nk = ren[tail];
//       norm = base ? `${base}.${nk}` : String(nk);
//     }
//     out.push({ locusPath: norm, posActId: p.posActId, negActId: p.negActId, ts: p.ts });
//   }
//   return out;
// }

export function normalizeTrace(pairs: {posActId:string;negActId:string}[], byId: Map<string, any>): ShadowStep[] {
    const out: ShadowStep[] = [];
    for (const pr of pairs) {
      const p = byId.get(pr.posActId); const n = byId.get(pr.negActId);
      if (p?.locus?.path) out.push({ polarity:'P', locusPath: p.locus.path });
      if (n?.locus?.path) out.push({ polarity:'O', locusPath: n.locus.path });
    }
    return out;
  }
  

// export function alphaEquivalent(a: Pair[], b: Pair[]) {
//   if (a.length !== b.length) return false;
//   for (let i = 0; i < a.length; i++) {
//     if (a[i].locusPath !== b[i].locusPath) return false;
//   }
//   return true;
// }
