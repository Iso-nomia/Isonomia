// packages/ludics-core/paths.ts
export type Pol = 'pos' | 'neg';
export type LocusPath = string; // e.g., "0", "0.1", "0.2.1"

/** PROPER (+/-) or DAIMON (†) action at a locus (optionally with additive openings). */
export type ProperAct = {
  kind: 'proper';
  pol: Pol;
  locus: LocusPath;
  openings?: number[];   // additive ramification (children choices)
  expr?: string;         // display/canonical label
};
export type DaimonAct = { kind: 'daimon'; locus: LocusPath; expr?: '†' };
export type Act = ProperAct | DaimonAct;

export type Path = Act[];

/** Dualize polarity (+ ↔ -). Daimon is self-dual. */
export function dualPath(p: Path): Path {
  return p.map(a => a.kind === 'proper'
    ? { ...a, pol: a.pol === 'pos' ? 'neg' : 'pos' }
    : a);
}

/** Positive-ended prefix(es): Ludics prefix-closure uses positive-ended cutpoints. */
export function positiveEndedPrefixes(p: Path): Path[] {
  const out: Path[] = [];
  for (let i = 0; i < p.length; i++) {
    const a = p[i];
    if (a.kind === 'proper' && a.pol === 'pos') out.push(p.slice(0, i + 1));
    if (a.kind === 'daimon') out.push(p.slice(0, i + 1));
  }
  return out;
}

/** Daimon-ended? */
export function endsWithDaimon(p: Path) {
  const last = p[p.length - 1];
  return Boolean(last && last.kind === 'daimon');
}

/** Alternation constraint (proper acts alternate ±; daimon only terminal). */
export function isAlternating(p: Path): boolean {
  let prev: Pol | null = null;
  for (let i = 0; i < p.length; i++) {
    const a = p[i];
    if (a.kind === 'daimon') return i === p.length - 1; // only terminal
    if (prev && a.pol === prev) return false;
    prev = a.pol;
  }
  return true;
}

/** Linearity (coarse): do not repeat the same (kind, locus, pol) consecutively. */
export function isLinear(p: Path): boolean {
  for (let i = 1; i < p.length; i++) {
    const a = p[i], b = p[i - 1];
    if (a.kind === 'proper' && b.kind === 'proper' &&
        a.locus === b.locus && a.pol === b.pol) {
      return false;
    }
  }
  return true;
}

/** Basic legality: alternation + linearity; positive-ended (or daimon). */
export function isLegalPath(p: Path): boolean {
  if (!p.length) return false;
  if (!isAlternating(p)) return false;
  if (!isLinear(p)) return false;
  const last = p[p.length - 1];
  return last.kind === 'daimon' || (last.kind === 'proper' && last.pol === 'pos');
}

/** Interleaving (shuffle) that preserves per-path order; used for ⊗ on VE candidates. */
export function* shuffle(a: Path, b: Path): Generator<Path> {
  function* rec(i: number, j: number, acc: Act[]): any {
    if (i === a.length && j === b.length) { yield acc; return; }
    if (i < a.length) yield* rec(i + 1, j, [...acc, a[i]]);
    if (j < b.length) yield* rec(i, j + 1, [...acc, b[j]]);
  }
  yield* rec(0, 0, []);
}

/** Utility: stringify for hashing/debugging. */
export function keyOf(p: Path) {
  return p.map(a => a.kind === 'daimon' ? `†@${a.locus}` : `${a.pol[0]}@${a.locus}`).join(' ');
}
