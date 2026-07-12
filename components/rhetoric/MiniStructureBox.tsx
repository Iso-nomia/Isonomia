'use client';
import * as React from 'react';

const RE_CONC = /\b(therefore|thus|hence|so|it follows that)\b/i;
const RE_PREM = /\b(because|since|given that|as|insofar as)\b/i;

export default function MiniStructureBox({ text }: { text: string }) {
  const { premises, conclusion, other } = React.useMemo(() => {
    const sents = (text.match(/[^.!?]+[.!?]+/g) || [text]).map(s => s.trim());
    const prem: string[] = [], conc: string[] = [], rest: string[] = [];
    for (const s of sents) {
      if (RE_CONC.test(s)) conc.push(s);
      else if (RE_PREM.test(s)) prem.push(s);
      else rest.push(s);
    }
    return { premises: prem.slice(0, 2), conclusion: conc.slice(0, 1), other: rest.slice(0, 1) };
  }, [text]);

  if (!premises.length && !conclusion.length) return null;

  return (
    <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
      <div className="border rounded p-2 bg-emerald-50/40">
        <div className="font-medium mb-1">Premises</div>
        {premises.map((s, i) => <div key={i} className="mb-1">• {s}</div>)}
      </div>
      <div className="flex items-center justify-center text-neutral-500">→</div>
      <div className="border rounded p-2 bg-blue-50/40">
        <div className="font-medium mb-1">Conclusion</div>
        {conclusion.length ? conclusion.map((s, i) => <div key={i}>• {s}</div>) : <div className="italic text-neutral-500">not detected</div>}
      </div>
    </div>
  );
}
