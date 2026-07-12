// components/kb/blocks/ClaimBlock.tsx
'use client';
import * as React from 'react';
import { ProvenanceChip } from '../ProvenanceChip';

export function ClaimBlock({ env }: { env: any }) {
  if (!env?.data) return null;
  const { text, bel, pl, top, roomId } = env.data;
  return (
    <div className="rounded border bg-white/70 p-3">
      <div className="text-sm font-medium mb-1">{text || '—'}</div>
      <div className="text-[11px] text-slate-700">Bel {Math.round((bel ?? 0)*100)}% • Pl {Math.round((pl ?? bel ?? 0)*100)}%</div>
      {Array.isArray(top) && top.length > 0 && (
        <ul className="mt-1 text-[12px] text-slate-700 list-disc ml-5">
          {top.slice(0,3).map((t: any) => (
            <li key={t.argumentId}>arg {t.argumentId.slice(0,8)}… • {Math.round((t.score ?? 0)*100)}%</li>
          ))}
        </ul>
      )}
      <div className="mt-2">
        <ProvenanceChip
          item={env.data}
        />
      </div>
    </div>
  );
}
