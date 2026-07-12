// components/work/WorkViewerCard.tsx
'use client';
import * as React from 'react';

export function WorkViewerCard({
  workId,
  mode = 'compact',   // 'compact' | 'full'
  className = ''
}: {
  workId: string;
  mode?: 'compact' | 'full';
  className?: string;
}) {
  const [data, setData] = React.useState<any>(null);
  const [err, setErr]   = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      setErr(null);
      try {
        const r = await fetch(`/api/works/${workId}/dossier?format=json`, { cache: 'no-store' });
        if (!r.ok) throw new Error(await r.text());
        setData(await r.json());
      } catch (e:any) {
        setErr(e?.message || 'Failed to load work');
      }
    })();
  }, [workId]);

  if (err) return <div className={`rounded border p-3 bg-white ${className}`}>Error: {err}</div>;
  if (!data) return <div className={`rounded border p-3 bg-white ${className}`}>Loading…</div>;

  const meta = data.meta || {};
  const ih   = data.sections?.ih || null;
  const std  = meta.standardOutput;

  const ihSummary = (
    <div className="text-sm leading-relaxed space-y-1">
      {std && <div><b>Standard Output:</b> {std}</div>}
      {(ih?.structure || ih?.function || ih?.objectivity) && (
        <ul className="list-disc pl-4">
          {ih?.structure && <li><b>Structure:</b> {ih.structure}</li>}
          {ih?.function && <li><b>Function:</b> {ih.function}</li>}
          {ih?.objectivity && <li><b>Objectivity:</b> {ih.objectivity}</li>}
        </ul>
      )}
    </div>
  );

  return (
    <div className={`rounded-lg border bg-white p-3 ${className}`}>
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">{meta.title ?? meta.id}</div>
          <div className="text-[10px] text-neutral-600 mt-0.5">{meta.theoryType}</div>
        </div>
        <a className="text-[11px] underline" href={`/works/${meta.id}/view${mode==='compact' ? '?mode=compact':''}`}>Open</a>
      </div>
      <div className="mt-2">
        {mode === 'compact' && meta.theoryType === 'IH' ? ihSummary : (
          <div className="text-sm text-neutral-700">
            {(data.body || '').slice(0, 220) || '—'}
            {data.body?.length > 220 && '…'}
          </div>
        )}
      </div>
    </div>
  );
}
