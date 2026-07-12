// packages/ludics-core/ve.ts
// Visitable-Events (VE) sets: saturation checks + MALL constructors
// ----------------------------------------------------------------------------

export type Pol = 'pos' | 'neg' | 'daimon';
export type Act = { pol: Pol; locus: string; key?: string }; // key = address/ramification label
export type Path = Act[];                    // legal, alternating, address-respecting
export type VE = { base: string; paths: Path[] }; // all paths share same base (ξ, polarity)

// --- basic helpers -----------------------------------------------------------

export const isDaimon = (a: Act) => a.pol === 'daimon';
export const endsPositive = (p: Path) => p.length > 0 && p[p.length - 1].pol === 'pos';
export const endsNegative = (p: Path) => p.length > 0 && p[p.length - 1].pol === 'neg';

export function positiveEndedPrefixes(p: Path): Path[] {
  const out: Path[] = [];
  for (let i = 1; i <= p.length; i++) {
    const pref = p.slice(0, i);
    if (endsPositive(pref)) out.push(pref);
  }
  return out;
}

// coherent if pairwise coherent by your path geometry (import when available)
export function coheres(a: Path, b: Path): boolean {
  // TODO: import from ./paths; keeping a permissive placeholder:
  //  - same base, no address clashes on siblings, alternating polarity consistent.
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i].locus !== b[i].locus || a[i].pol !== b[i].pol) break;
  }
  return true;
}

export function eqPath(a: Path, b: Path) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i], y = b[i];
    if (x.pol !== y.pol || x.locus !== y.locus || x.key !== y.key) return false;
  }
  return true;
}
const keyOf = (p: Path) => p.map(a => `${a.pol}@${a.locus}/${a.key ?? ''}`).join(' ');

// --- closure conditions (Def. 3.4) ------------------------------------------
// Prefix-closure on positive-ended prefixes; Daimon-closure: pκ+ ∈ S ⇒ pz ∈ S.  [3.2]
export function isPrefixClosed(S: Path[]): boolean {
  const K = new Set(S.map(keyOf));
  for (const p of S) {
    for (const pref of positiveEndedPrefixes(p)) {
      if (!K.has(keyOf(pref))) return false;
    }
  }
  return true;
}
export function isDaimonClosed(S: Path[]): boolean {
  const K = new Set(S.map(keyOf));
  for (const p of S) {
    if (endsPositive(p)) {
      const z: Path = [...p.slice(0, -1), { pol: 'daimon', locus: p[p.length - 1].locus }];
      if (!K.has(keyOf(z))) return false;
    }
  }
  return true;
}

// --- maximal cliques over S (pairwise coherence) -----------------------------

// Bron–Kerbosch over a simple compatibility graph of paths
export function maximalCliques(S: Path[]): Path[][] {
  const n = S.length;
  const adj: boolean[][] = Array.from({ length: n }, () => Array(n).fill(false));
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    if (coheres(S[i], S[j])) adj[i][j] = adj[j][i] = true;
  }
  const cliques: number[][] = [];
  const R: number[] = [], P = new Set<number>(Array.from({ length: n }, (_, i) => i)), X = new Set<number>();
  function BK(R: number[], P: Set<number>, X: Set<number>) {
    if (P.size === 0 && X.size === 0) { cliques.push([...R]); return; }
    const Pu = [...P];
    const u = Pu.length ? Pu[0] : null;
    const N_u = new Set<number>();
    if (u !== null) for (let v = 0; v < n; v++) if (adj[u][v]) N_u.add(v);
    const candidates = [...P].filter(v => !N_u.has(v));
    for (const v of candidates) {
      const Nv = new Set<number>(); for (let w = 0; w < n; w++) if (adj[v][w]) Nv.add(w);
      BK([...R, v], new Set([...P].filter(x => Nv.has(x))), new Set([...X].filter(x => Nv.has(x))));
      P.delete(v); X.add(v);
    }
  }
  BK(R, P, X);
  return cliques.map(Idxs => Idxs.map(i => S[i]));
}

// --- positively saturated clique (Def. 3.1) ----------------------------------
// “For all m∈C, n κ− κ+ ∈ C: if m κ− z ∈ S then m κ− κ+ ∈ S; thus in a maximal C, it must lie in C.”
export function isPosSatClique(S: Path[], C: Path[]): boolean {
  const K = new Set(S.map(keyOf));
  for (const m of C) {
    // consider all n in C that end with (neg, pos)
    for (const n of C) {
      if (n.length >= 2 && endsPositive(n) && n[n.length - 2].pol === 'neg') {
        const kMinus = n[n.length - 2], kPlus = n[n.length - 1];
        // build m κ− z and m κ− κ+
        const m_kminus_z: Path = [...m, { pol: 'neg', locus: kMinus.locus, key: kMinus.key }, { pol: 'daimon', locus: kMinus.locus }];
        const m_kminus_kplus: Path = [...m, { pol: 'neg', locus: kMinus.locus, key: kMinus.key }, { pol: 'pos', locus: kPlus.locus, key: kPlus.key }];
        if (K.has(keyOf(m_kminus_z)) && !K.has(keyOf(m_kminus_kplus))) return false;
      }
    }
  }
  return true;
}

// --- standard clique Cp (Prop. 3.7) ------------------------------------------
// Cp = {q∈S | view(q) ⊑ view(p)} ∪ {w κ− z ∈ S | view(w) ⊑ view(p), view(w κ−) ⊄ view(p)}
// We approximate view(.) with the raw prefix relation on actions at the same base.
function isPrefixOf(a: Path, b: Path) {
  if (a.length > b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i], y = b[i];
    if (x.pol !== y.pol || x.locus !== y.locus || x.key !== y.key) return false;
  }
  return true;
}
export function standardCliqueCp(S: Path[], p: Path): Path[] {
  const part1 = S.filter(q => isPrefixOf(q, p));
  const part2 = S.filter(q => isDaimon(q[q.length - 1] ?? { pol: 'pos', locus: '' }) && q.length >= 2)
    .filter(q => {
      const w = q.slice(0, q.length - 1);                  // w κ− z with trailing z removed
      const wkminus = w;                                   // w κ−
      const wNoTail = w.slice(0, w.length - 1);
      return isPrefixOf(wNoTail, p) && !isPrefixOf(wkminus, p);
    });
  const uniq = new Map<string, Path>();
  [...part1, ...part2].forEach(x => uniq.set(keyOf(x), x));
  return [...uniq.values()];
}

// --- positive/negative saturation & ludicability -----------------------------
// S is positively saturated iff each p ∈ S lies in some positively saturated maximal clique (Prop. 3.7)
export function isPositivelySaturated(S: Path[]): boolean {
  if (!isPrefixClosed(S) || !isDaimonClosed(S)) return false; // precondition (Def. 3.4)
  for (const p of S) {
    const Cp = standardCliqueCp(S, p);
    if (Cp.length === 0 || !isPosSatClique(S, Cp)) return false;
  }
  return true;
}

// Negative saturation (paper intuition): for any negative-ended r = m κ− where,
// for every positively saturated maximal clique C, either r is continued inside C
// or interaction exits C on a positive action, then r z must belong to S.  [3.2, 3.3]
export function isNegativelySaturated(S: Path[]): boolean {
  // materialize all positively saturated maximal cliques once
  const Cs = maximalCliques(S).filter(C => isPosSatClique(S, C));
  const K = new Set(S.map(keyOf));
  // enumerate candidate r = m κ− obtained from tails of S where m ∈ S (legal)
// AFTER
const negCandidates: Path[] = [];
for (const p of S) {
  for (let i = 0; i < p.length; i++) {
    if (p[i].pol === 'neg') {
      negCandidates.push(p.slice(0, i + 1));
    }
  }
}
for (const r of negCandidates) {
  const rz: Path = [...r, { pol: 'daimon', locus: r[r.length - 1].locus }];
    // check the "either continue or exit on positive" condition w.r.t. every pos-sat clique
    let conditionHoldsEverywhere = true;
    for (const C of Cs) {
      const continuedInsideC = C.some(q => isPrefixOf(r, q));
      if (continuedInsideC) continue;
      // exit on a positive: some q = m κ+ ∈ C shares m = r without the final κ−
      const m = r.slice(0, r.length - 1);
      const exitsOnPositive = C.some(q =>
        q.length >= 1 &&
        endsPositive(q) &&
        isPrefixOf(m, q.slice(0, q.length - 1)) // same m before κ+
      );
      if (!exitsOnPositive) { conditionHoldsEverywhere = false; break; }
    }
    if (conditionHoldsEverywhere && !K.has(keyOf(rz))) return false; // must contain r z
  }
  return true;
}

export function isPreLudicable(S: Path[]): boolean {
  return isPrefixClosed(S) && isDaimonClosed(S) && isPositivelySaturated(S) && isNegativelySaturated(S);
}

// dualize (switch polarity; z is self-dual) — used for ~S in Def. 3.10
export function dualPath(p: Path): Path {
  return p.map(a => a.pol === 'daimon'
    ? a
    : { ...a, pol: a.pol === 'pos' ? 'neg' : 'pos' });
}
export function isLudicable(S: Path[]): boolean {
  if (!isPreLudicable(S)) return false;
  const Sd = S.map(dualPath);
  return isPreLudicable(Sd);
}

// --- MALL constructors at the VE layer --------------------------------------
// faithful to §4.1; for duals we use de Morgan via dual(•).  [4.1]

function closure(S: Path[]) { return Array.from(new Map(S.map(p => [keyOf(p), p])).values()); }

function disjointAddresses(p: Path, q: Path) {
  const A = new Set(p.map(a => `${a.locus}:${a.key ?? ''}`));
  for (const b of q) if (A.has(`${b.locus}:${b.key ?? ''}`)) return false;
  return true;
}

// ⊕ : additive sum — at behaviours level L_k G_k = (⋃ G_k)⊥⊥  [4.1]
export function vePlus(A: VE, B: VE): VE {
  const paths = closure([...A.paths, ...B.paths]);
  return { base: A.base, paths };
}
// & : dual of ⊕  — A & B = (A ⊕ B)⊥  ⊥  (de Morgan)
export function veWith(A: VE, B: VE): VE {
  const d = (p: Path) => dualPath(p);
  const D = vePlus({ base: A.base, paths: A.paths.map(d) }, { base: B.base, paths: B.paths.map(d) });
  return { base: A.base, paths: D.paths.map(d) };
}

// ⊗ : multiplicative tensor over alien behaviours (disjoint ramifications) [4.1]
export function veTensor(A: VE, B: VE): VE {
  const out: Path[] = [];
  for (const p of A.paths) for (const q of B.paths) {
    if (!disjointAddresses(p, q)) continue; // alien condition
    // simple interleaving/shuffle preserving order-per-side (conservative)
    // (you can refine with focused shuffles once stepper constraints are exposed)
    out.push(...interleavePosNegPreserving(p, q));
  }
  return { base: A.base, paths: closure(out) };
}

// ⅋ : dual of ⊗ — A ⅋ B = (A ⊗ B)⊥  ⊥
export function vePar(A: VE, B: VE): VE {
  const d = (p: Path) => dualPath(p);
  const T = veTensor({ base: A.base, paths: A.paths.map(d) }, { base: B.base, paths: B.paths.map(d) });
  return { base: A.base, paths: T.paths.map(d) };
}

// ´ : shift from negative to positive (polarization flip) [4.1]
export function veShiftPos(Gneg: VE): VE {
  // in practice: seed a (+, ξ, {i}) frame then close; at VE layer we flip leading polarity
  return { base: Gneg.base, paths: Gneg.paths.map(dualPath) };
}
// ˆ : dual shift  (ˆ A) = (´ A)⊥  [4.1]
export function veShiftNeg(Gpos: VE): VE {
  return { base: Gpos.base, paths: Gpos.paths.map(dualPath) };
}

// interleave two paths preserving per-side order (very small shuffle kernel)
function interleavePosNegPreserving(p: Path, q: Path): Path[] {
  const out: Path[] = [];
  function go(i: number, j: number, acc: Path) {
    if (i === p.length && j === q.length) { out.push(acc); return; }
    if (i < p.length) go(i + 1, j, [...acc, p[i]]);
    if (j < q.length) go(i, j + 1, [...acc, q[j]]);
  }
  go(0, 0, []);
  return out;
}

// --- canonization for room snapshots ----------------------------------------
export function fingerprintVE(G: VE): string {
  // canonical: sorted keys of standard clique for each maximal path
  const max = maximalPaths(G.paths);
  const fps = max.map(p => standardCliqueCp(G.paths, p).map(keyOf).sort().join('||'));
  fps.sort();
  return hash(fps.join('###'));
}
function maximalPaths(S: Path[]) {
  return S.filter(p => !S.some(q => p !== q && isPrefixOf(p, q)));
}
function hash(s: string) {
  let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16);
}
