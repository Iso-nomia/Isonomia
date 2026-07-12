'use client';
import * as React from 'react';
import { UniformityPill } from './UniformityPill';

export default function LocusControls({
  dialogueId, posDesignId, negDesignId, baseLocus, childrenPaths, onRefresh,
}: {
  dialogueId: string;
  posDesignId: string;
  negDesignId: string;
  baseLocus: string;
  childrenPaths: string[];
  onRefresh?: () => void; // ask LociTree to refresh
}) {
  const [copyPending, setCopyPending] = React.useState(false);
  const [instPending, setInstPending] = React.useState(false);
  const [freshName, setFreshName]     = React.useState<string>('');

  async function doCopy() {
    setCopyPending(true);
    try {
      const r = await fetch('/api/loci/copy', {
        method:'POST', headers:{'content-type':'application/json'},
        body: JSON.stringify({ dialogueId, baseLocus, count: 1 }),
      });
      if (!r.ok) alert(await r.text());
      window.dispatchEvent(new CustomEvent('mesh:loci-updated', { detail: { dialogueId, baseLocus } }));
      onRefresh?.();
    } finally { setCopyPending(false); }
  }

  async function doInstantiate() {
    if (!freshName.trim()) { alert('Provide a name'); return; }
    setInstPending(true);
    try {
      const r = await fetch('/api/loci/instantiate', {
        method:'POST', headers:{'content-type':'application/json'},
        body: JSON.stringify({ dialogueId, baseLocus, name: freshName.trim(), mask: true }),
      });
      if (!r.ok) alert(await r.text());
      setFreshName('');
      window.dispatchEvent(new CustomEvent('mesh:loci-updated', { detail: { dialogueId, baseLocus } }));
      onRefresh?.();
    } finally { setInstPending(false); }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <button className="px-2 py-0.5 border rounded bg-white" onClick={doCopy} disabled={copyPending}>
        {copyPending ? 'Copying…' : 'Copy (σ·i)'}
      </button>

      <div className="inline-flex items-center gap-1">
        <span>∀ instantiate:</span>
        <input
          className="border rounded px-1 py-0.5 w-20"
          placeholder="a"
          value={freshName}
          onChange={e=>setFreshName(e.target.value)}
        />
        <button className="px-2 py-0.5 border rounded bg-white" onClick={doInstantiate} disabled={instPending}>
          {instPending ? '…' : 'Add'}
        </button>
      </div>

      <UniformityPill
        dialogueId={dialogueId}
        posDesignId={posDesignId}
        negDesignId={negDesignId}
        baseLocus={baseLocus}
        childrenPaths={childrenPaths}
      />
    </div>
  );
}
