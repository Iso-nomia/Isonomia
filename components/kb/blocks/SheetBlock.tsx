// components/kb/blocks/SheetBlock.tsx
'use client';
import * as React from 'react';
import { ProvenanceChip } from '../ProvenanceChip';

export function SheetBlock({ env }: { env: any }) {
  const s = env?.data;
  return (
    <div className="rounded border bg-white/70 p-3">
      <div className="text-sm font-semibold mb-1">{s?.title ?? 'Sheet'}</div>
      <div className="text-[11px] text-slate-600">nodes {s?.nodes?.length ?? 0}</div>
      <div className="mt-2">
        <ProvenanceChip item={env} />
      </div>
    </div>
  );
}
