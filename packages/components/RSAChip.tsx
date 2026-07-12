'use client';
import * as React from 'react';

export function RSAChip({ R, S, A }:{ R:number; S:number; A:number }) {
  const dot = (v:number) => {
    const tone = v>=0.75 ? 'bg-emerald-500' : v>=0.5 ? 'bg-amber-500' : 'bg-rose-500';
    return <span className={`inline-block w-2 h-2 rounded-full ${tone}`} title={v.toFixed(2)} />;
  };
  return (
    <span className="inline-flex items-center gap-1 text-[10px] border rounded px-1.5 py-0.5"
          title={`Relevance ${R.toFixed(2)} · Sufficiency ${S.toFixed(2)} · Acceptability ${A.toFixed(2)}`}>
      RSA {dot(R)}{dot(S)}{dot(A)}
    </span>
  );
}
