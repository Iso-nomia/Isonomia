// packages/ludics-core/ve/pathCheck.ts
export type Act = { pol: 'pos'|'neg'|'daimon'; locus: string }; // e.g., '0.3.1'

// parent address: '0.3.1' -> '0.3'
const parent = (x: string) => x.includes('.') ? x.slice(0, x.lastIndexOf('.')) : '';

export function dualPath(p: Act[]): Act[] {
  if (!p.length) return [];
  const last = p[p.length - 1];
  if (last.pol === 'daimon') return p.slice(0, -1);       // ∼(w·z) = w
  return [...p, { pol: 'daimon', locus: p[p.length-1]?.locus ?? '0' }]; // ∼w = w·z
}

export function isPath(p: Act[]): { ok: boolean; reason?: string } {
  if (!p.length) return { ok: true };
  // (1) alternation & daimon-at-end
  for (let i = 1; i < p.length; i++) {
    if (p[i-1].pol === 'daimon') return { ok:false, reason:'daimon not last' };
    if (p[i].pol === p[i-1].pol)  return { ok:false, reason:'non-alternating' };
  }
  // (2) linearity: no locus reused
  const seen = new Set<string>();
  for (const a of p) {
    if (a.pol !== 'daimon') {
      if (seen.has(a.locus)) return { ok:false, reason:'linearity' };
      seen.add(a.locus);
    }
  }
  // (3) negative-jump via views (Def. 2.3)
  // For any positive κ+ at locus u.v, there must be a chain back to its justifier κ− at u.
  function negJumpOK(idx: number): boolean {
    const pos = p[idx]; if (pos.pol !== 'pos') return true;
    const wantNeg = parent(pos.locus); if (!wantNeg) return true; // initial positive
    // walk left and build the "view": every time we see a neg, the *next* pos in view must justify it
    // A simple sufficient check: there exists j<idx with p[j].pol='neg' and p[j].locus===wantNeg,
    // and between j..idx we can thread a chain of pairs (α− justified by next α+ who is its child).
    let j = -1;
    for (let k = idx-1; k >= 0; k--) if (p[k].pol==='neg' && p[k].locus===wantNeg) { j = k; break; }
    if (j < 0) return false;
    // thread a justification chain from j to idx
    let need = pos.locus;
    for (let k = idx-1; k >= j; k--) {
      if (p[k].pol==='neg' && need.startsWith(p[k].locus) && parent(need)===p[k].locus) {
        // the next pos in the chain must be exactly at 'need'
        const kp = k+1;
        if (kp>idx || p[kp].pol!=='pos' || p[kp].locus!==need) return false;
        need = p[k].locus; // climb up one level
      }
    }
    return need===wantNeg;
  }
  for (let i = 0; i < p.length; i++) if (p[i].pol==='pos' && !negJumpOK(i)) return { ok:false, reason:'negative-jump' };
  return { ok: true };
}
