// components/ludics/BehaviourHUD.tsx
'use client';

import * as React from 'react';
import useSWR from 'swr';
import { isPrefixClosed, isDaimonClosed, isPositivelySaturated, isNegativelySaturated, isLudicable, dualPath, type Path, type Act } from '@/packages/ludics-core/ve';
import { isPath } from '@/packages/ludics-core/ve/pathCheck';
const fetcher = (u: string) => fetch(u, { cache: 'no-store' }).then(r => r.json());
import type { MoveKind } from '@/lib/dialogue/types';
type MoveRow = {
  id: string;
  kind: MoveKind;
  payload: { acts?: any[] } | null;
  createdAt: string;
};

function normAct(a: any): Act | null {
  if (!a || typeof a !== 'object') return null;
  const pol = a.polarity ?? a.pol;
  const locus = String(a.locusPath ?? a.locus ?? '0');
  if (pol === 'pos' || pol === 'neg' || pol === 'daimon') return { pol, locus } as Act;
  return null;
}
const pathKey = (p: Path) => p.map(a => `${a.pol}@${a.locus}`).join(' ');
const pathPretty = (p: Path) => p.map(a => a.pol==='daimon' ? `†@${a.locus}` : (a.pol==='pos'?`+@${a.locus}`:`-@${a.locus}`)).join('  ');

// Build S⁺ by adding all negative-ended prefixes of each path in S
function extendWithNegPrefixes(S: Path[]): Path[] {
  const uniq = new Map<string, Path>();
  for (const p of S) uniq.set(pathKey(p), p);
  for (const p of S) {
    for (let i = 0; i < p.length; i++) {
      if (p[i].pol === 'neg') {
        const r = p.slice(0, i + 1);
        uniq.set(pathKey(r), r);
      }
    }
  }
  return [...uniq.values()];
}

// Lightweight legality for sampling shuffles (for the hint badge)
function isAlternatingLegal(p: Path): boolean {
  if (!p.length) return false;
  for (let i = 1; i < p.length; i++) {
    if (p[i-1].pol === 'daimon') return false;
    if (p[i].pol === p[i-1].pol) return false;
  }
  const last = p[p.length - 1]?.pol;
  return last === 'pos' || last === 'daimon';
}
function* sampleInterleavings(a: Path, b: Path, cap = 6): Generator<Path> {
  let count = 0;
  function* rec(i: number, j: number, acc: Path): any {
    if (count >= cap) return;
    if (i === a.length && j === b.length) { count++; yield acc; return; }
    if (i < a.length) yield* rec(i + 1, j, [...acc, a[i]]);
    if (j < b.length) yield* rec(i, j + 1, [...acc, b[j]]);
  }
  yield* rec(0, 0, []);
}

export function BehaviourHUD({ deliberationId }: { deliberationId: string }) {
  const { data, isLoading } = useSWR<{ ok: boolean; items: MoveRow[] }>(
    `/api/dialogue/moves?deliberationId=${encodeURIComponent(deliberationId)}&limit=500&order=asc`,
    fetcher, { refreshInterval: 4000 }
  );

  // Build observed VE S (unique pos/†-ended paths)
  const { S, uniqueCount, samples } = React.useMemo(() => {
    const rows = Array.isArray(data?.items) ? data!.items : [];
    const segs: Act[] = [];
    for (const m of rows) {
      const acts = Array.isArray(m.payload?.acts) ? m.payload!.acts! : [];
      for (const raw of acts) { const a = normAct(raw); if (a) segs.push(a); }
    }
    const paths: Path[] = [];
    let cur: Act[] = [];
    for (const a of segs) {
      cur.push(a);
      if (a.pol === 'daimon' || a.pol === 'pos') { paths.push(cur.slice()); cur = []; }
    }
    if (cur.length) paths.push(cur);

    const uniq = new Map<string, Path>();
    for (const p of paths) uniq.set(pathKey(p), p);
    const keys = [...uniq.keys()];
    const samples = keys.slice(Math.max(0, keys.length - 5)).map(k => uniq.get(k)!).reverse();
    return { S: [...uniq.values()], uniqueCount: uniq.size, samples };
  }, [data]);

  const [shuffleReport, setShuffleReport] = React.useState<{tried:number; reversible:number; legal:number}>({tried:0, reversible:0, legal:0});
  
    async function probeShuffleRegularity(k = 2) {
      // take last k samples as "material chronicles" proxies
      const mats = samples.slice(0, k).map(p => p); // Path[]
      let tried=0, reversible=0, legal=0;
      for (let i=0;i<mats.length;i++    ){
        for (let j=i + 1;j<mats.length;j++    ){
          for (const r of sampleInterleavings(mats[i], mats[j], 8)) {
            tried++    ;
            const rev = dualPath(r);
            const revOk = isPath(rev.map(a => ({ pol: a.pol==='pos'?'pos':a.pol==='neg'?'neg':'daimon', locus: a.locus }))).ok;
            if (revOk) reversible++    ;
            const rOk = isPath(r.map(a => ({ pol: a.pol==='pos'?'pos':a.pol==='neg'?'neg':'daimon', locus: a.locus }))).ok;
            if (revOk && rOk) legal++    ;
          }
        }
      }
      setShuffleReport({ tried, reversible, legal });
  }

  // S⁺ for negative-saturation & full ludicability checks
  const Splus = React.useMemo(() => extendWithNegPrefixes(S), [S]);

  // Safe report (won’t crash if core assumes r∈S)
  const { prefixClosed, daimonClosed, posSat, negSat, negUsedExtended, problems } = React.useMemo(() => {
    const prefixClosed = isPrefixClosed(S);
    const daimonClosed = isDaimonClosed(S);
    const posSat = isPositivelySaturated(S); // fine on S
    let negSat = false, negUsedExtended = false;
    try {
      negSat = isNegativelySaturated(S);
    } catch {
      try {
        negSat = isNegativelySaturated(Splus);
        negUsedExtended = true;
      } catch { negSat = false; }
    }
    const problems: string[] = [];
    if (!prefixClosed) problems.push('Not prefix-closed');
    if (!daimonClosed) problems.push('Not daimon-closed');
    if (!posSat) problems.push('Positive saturation fails');
    if (!negSat) problems.push('Negative saturation fails');
    return { prefixClosed, daimonClosed, posSat, negSat, negUsedExtended, problems };
  }, [S, Splus]);

  // Ludicable? (S OR S⁺, safely)
  const ludicable = React.useMemo(() => {
    try { return isLudicable(S); }
    catch {
      try { return isLudicable(Splus); } catch { return false; }
    }
  }, [S, Splus]);

  // Mall regularity hints (coarse)
  const hints = React.useMemo(() => {
    let shuffleStable = true;
    outer:
    for (let i = 0; i < Math.min(S.length, 12); i++) {
      for (let j = i + 1; j < Math.min(S.length, 12); j++) {
        let k = 0;
        for (const r of sampleInterleavings(S[i], S[j], 6)) {
          if (++k > 6) break;
          if (!isAlternatingLegal(r)) { shuffleStable = false; break outer; }
        }
      }
    }
    const dualStable = S.every(p => isAlternatingLegal(dualPath(p)));
    return { shuffleStable, dualStable };
  }, [S]);

  const [showPaths, setShowPaths] = React.useState(false);
 const [sizeHint, setSizeHint] = React.useState<'unknown'|'Cf'|'C∞'>('unknown');


   React.useEffect(() => {
     // quick proxy: max observed path length & #unique paths
     const maxLen = S.reduce((m,p)=>Math.max(m,p.length),0);
     // crude: if unique paths small and maxLen small -> Cf likely; else C∞ likely (both regular assumed if pills are green)
     if (uniqueCount<=20 && maxLen<=16) setSizeHint('Cf'); else if (uniqueCount>0) setSizeHint('C∞'); else setSizeHint('unknown');
   }, [S, uniqueCount]);


  return (
    <div className="mt-2 rounded border bg-white/90 p-2 text-[12px]">
      <div className="font-medium mb-1">Behaviour (observed VE)</div>
      {isLoading ? <div>Loading…</div> : (
        <>
          <div className="flex gap-3 flex-wrap">
            <Badge ok={prefixClosed} label="Prefix-closed" />
            <Badge ok={daimonClosed} label="Daimon-closed" />
            <Badge ok={posSat} label="Pos-sat" />
            <Badge ok={negSat} label={`Neg-sat${negUsedExtended ? ' (S⁺)' : ''}`} />
            <Badge ok={hints.shuffleStable} label="Shuffle-stable (sample)" />
            <Badge ok={hints.dualStable} label="Dual-legal (sample)" />
           {sizeHint==='Cf'  && <span className="px-1.5 py-0.5 rounded border bg-sky-50">≈ Cf (reg. + ess. finite)</span>}
          {sizeHint==='C∞' && <span className="px-1.5 py-0.5 rounded border bg-indigo-50">≈ C∞ (reg. + unif. bounded)</span>}
          </div>
         <div className="text-[11px] opacity-70 mt-1">
           Heuristic per Thm. 6.1: regular + (essentially finite ≈ small set of short paths) ↔ Cf; regular + uniformly bounded ↔ C∞. :contentReference[oaicite:10]{10}
         </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="inline-block px-1.5 py-0.5 rounded bg-slate-50 border">Paths observed: {uniqueCount}</span>
            <span className={`inline-block px-1.5 py-0.5 rounded border ${ludicable ? 'bg-emerald-50' : 'bg-amber-50'}`}>
              {ludicable ? 'Ludicable ✓' : 'Not ludicable'}
            </span>
             <button className="text-[11px] underline" onClick={() => probeShuffleRegularity(2)}>Shuffle‑regularity</button>
      {!!shuffleReport.tried && (
        <span className="text-[11px] px-1.5 py-0.5 rounded border bg-white">
          shuffles: {shuffleReport.legal}/{shuffleReport.reversible}/{shuffleReport.tried} (legal / reversible / tried)
        </span>
      )}
            <button className="ml-auto text-[11px] underline" onClick={() => setShowPaths(v => !v)}>
              {showPaths ? 'Hide paths' : 'Show paths'}
            </button>
          </div>

          {problems.length > 0 && (
            <ul className="mt-2 list-disc ml-5 text-rose-700">
              {problems.map(p => <li key={p}>{p}</li>)}
            </ul>
          )}

          {showPaths && (
            <div className="mt-2 rounded border bg-white/80 p-2">
              <div className="text-[11px] text-neutral-600 mb-1">Recent unique paths (up to 5):</div>
              {samples.length
                ? <ul className="space-y-1">{samples.map((p, i) => <li key={i} className="font-mono text-[11px]">{pathPretty(p)}</li>)}</ul>
                : <div className="text-[11px] text-neutral-500">No paths yet.</div>}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Badge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`px-1.5 py-0.5 rounded border ${ok ? 'text-emerald-700 bg-emerald-50' : 'text-amber-700 bg-amber-50'}`}>
      {ok ? '✓' : '•'} {label}
    </span>
  );
}
