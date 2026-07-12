// components/kb/blocks/TransportBlock.tsx
'use client';
import * as React from 'react';
import { ProvenanceChip } from '../ProvenanceChip';

export function TransportBlock({ env }: { env: any }) {
  const map = env?.data?.claimMap ?? {};
  const proposals = env?.data?.proposals ?? [];
  return (
    <div className="rounded border bg-white/70 p-3">
      <div className="text-sm font-semibold mb-2">Room Functor map</div>
      <ul className="text-[12px] space-y-1">
        {Object.keys(map).slice(0,20).map((k) => (
          <li key={k}><code>{k.slice(0,8)}…</code> → <code>{map[k].slice(0,8)}…</code></li>
        ))}
      </ul>
      {proposals.length > 0 && (
        <>
          <div className="mt-2 text-[12px] font-medium">Proposals</div>
          <ul className="text-[12px] space-y-1">
            {proposals.slice(0,5).map((p: any) => (
              <li key={p.fingerprint}>{p.previewText ?? '(no text)'} • {Math.round((p.base ?? 0.55)*100)}%</li>
            ))}
          </ul>
        </>
      )}
      <div className="mt-2">
        <ProvenanceChip item={env} />
      </div>
    </div>
  );
}
