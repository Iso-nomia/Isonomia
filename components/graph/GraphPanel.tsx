'use client';
import { useState } from 'react';
import AFLens from './AFLens';
import BipolarLens from './BipolarLens';

export default function GraphPanel({ deliberationId }: { deliberationId: string }) {
  const [lens, setLens] = useState<'af'|'bipolar'>('af');
  

  return (
    <section className="rounded-2xl border border-slate-200 bg-white/95 shadow-sm">
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <h3 className="text-sm font-semibold text-slate-700">Discussion Graph</h3>
        <div className="flex items-center gap-2 text-xs">
          <button
            className={`px-2 py-1 border rounded ${lens==='af'?'bg-slate-100':''}`}
            onClick={()=>setLens('af')}
          >Argumentation Framework</button>
          <button
            className={`px-2 py-1 border rounded ${lens==='bipolar'?'bg-slate-100':''}`}
            onClick={()=>setLens('bipolar')}
          >Bipolar</button>
        </div>
      </div>
      <div className="p-2">
        {lens === 'af'
          ? <AFLens deliberationId={deliberationId} />
          : <BipolarLens deliberationId={deliberationId} />
        }
      </div>
    </section>
  );
}
