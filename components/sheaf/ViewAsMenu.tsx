'use client';
import * as React from 'react';
import { useSheafPreview } from '@/hooks/useSheafPreview';
import type { FacetDraft } from './FacetChipBar';

export function ViewAsMenu({
  draft, threadId, authorId, candidates,
}: {
  draft: FacetDraft[];
  threadId: string | number;
  authorId: string | number;
  candidates: Array<{ id: string; label: string; type: 'user'|'role'|'everyone' }>;
}) {
  const [as, setAs] = React.useState<{ kind: 'user'|'role'|'everyone'; value?: string }>({ kind: 'everyone' });
  const { data, loading, error, preview } = useSheafPreview();

  const onPreview = () => {
    const viewAs =
      as.kind === 'everyone' ? { everyone: true } :
      as.kind === 'role' ? { role: as.value } :
      { userId: as.value };
    preview({
      draftMessage: { threadId, authorId, facets: draft.map(d => ({ audience: d.audience, body: d.body, sharePolicy: d.policy, expiresAt: d.expiresAt ?? null })) },
      viewAs,
    });
  };

  return (
    <div className="flex items-center gap-2">
      <select
        className="text-xs border rounded px-2 py-1 bg-white/70"
        value={`${as.kind}:${as.value ?? ''}`}
        onChange={(e) => {
          const [kind, value] = e.target.value.split(':');
          setAs({ kind: kind as any, value: value || undefined });
        }}
      >
        <option value="everyone:">Everyone</option>
        {candidates.map((c) => (
          <option key={`${c.type}:${c.id}`} value={`${c.type}:${c.id}`}>{c.label}</option>
        ))}
      </select>
      <button type="button" className="px-2 py-1 rounded bg-white/70 text-xs" onClick={onPreview}>
        {loading ? 'Previewing…' : 'View as'}
      </button>
      {error && <span className="text-xs text-red-600">{String(error)}</span>}
      {data && <span className="text-xs text-slate-600">Default facet: {data.defaultFacetId}</span>}
    </div>
  );
}
