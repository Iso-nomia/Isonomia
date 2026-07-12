// components/kb/blocks/RoomSummaryBlock.tsx
'use client';
import * as React from 'react';
import { ProvenanceChip } from '../ProvenanceChip';

export function RoomSummaryBlock({ env }: { env: any }) {
  const claims = env?.data?.claims ?? [];
  return (
    <div className="rounded border bg-white/70 p-3">
      <div className="text-sm font-semibold mb-2">Room summary</div>
      <ul className="space-y-1">
        {claims.map((c: any) => (
          <li key={c.id} className="text-[12px]">
            <span className="font-medium">{c.text}</span>{' '}
            <span className="text-slate-600">• {Math.round((c.bel ?? c.score ?? 0)*100)}%</span>
          </li>
        ))}
      </ul>
      <div className="mt-2">
        <ProvenanceChip item={{ provenance: { source: "deliberation" }, href: env?.actions?.openRoom }} />
      </div>
    </div>
  );
}
