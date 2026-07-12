'use client';
import * as React from 'react';

export function UniformityPill({
  dialogueId, posDesignId, negDesignId, baseLocus, childrenPaths,
}: {
  dialogueId: string;
  posDesignId: string;
  negDesignId: string;
  baseLocus: string;          // e.g. '0.3'
  childrenPaths: string[];    // e.g. ['0.3.1','0.3.2',...]
}) {
  const [state, setState] = React.useState<'idle'|'loading'|'pass'|'fail'|'na'>('idle');
  const [msg, setMsg] = React.useState<string>('Uniformity');

  async function run() {
    if (childrenPaths.length < 2) { setState('na'); setMsg('Uniformity: n<2'); return; }
    setState('loading'); setMsg('Uniformity: …');
    const [a, b] = [...childrenPaths].sort().slice(0, 2);
    const r = await fetch('/api/ludics/uniformity/check', {
      method:'POST', headers:{'content-type':'application/json'},
      body: JSON.stringify({ dialogueId, posDesignId, negDesignId, baseLocus, childA:a, childB:b }),
    }).then(x=>x.json()).catch(()=>null);
    if (!r?.ok) { setState('fail'); setMsg('Uniformity: error'); return; }
    setState(r.uniform ? 'pass' : 'fail');
    setMsg(r.uniform ? 'Uniform ✓' : 'Uniform ×');
  }

  React.useEffect(() => { setState('idle'); setMsg('Uniformity'); }, [baseLocus, childrenPaths.join(',')]);

  const cls =
    state === 'pass' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
    state === 'fail' ? 'bg-rose-50 border-rose-200 text-rose-700' :
    state === 'na'   ? 'bg-neutral-50 border-neutral-200 text-neutral-500' :
                       'bg-amber-50 border-amber-200 text-amber-700';

  return (
    <button
      onClick={run}
      title="Check α-equivalence across copies under this base locus"
      className={`px-1.5 py-0.5 rounded border text-[10px] ${cls}`}
      disabled={state==='loading'}
    >
      {state==='loading' ? 'Uniformity: …' : msg}
    </button>
  );
}
