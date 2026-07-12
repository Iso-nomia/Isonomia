// components/kb/blocks/ArgumentBlock.tsx
'use client';
import * as React from 'react';
import { ProvenanceChip } from '../ProvenanceChip';

export function ArgumentBlock({ env }: { env: any }) {
  const diag = env?.data?.diagram;
  return (
    <div className="rounded border bg-white/70 p-3">
      <div className="text-sm font-semibold mb-1">Argument</div>
      <pre className="text-[11px] bg-slate-50 p-2 rounded overflow-auto">{JSON.stringify(diag, null, 2)}</pre>
      <div className="mt-2">
<ProvenanceChip item={env} />
      </div>
    </div>
  );
}
