// components/work/evidence/EvidenceChipsForSlot.tsx
'use client';
import * as React from 'react';
import CitePickerModal from '@/components/citations/CitePickerModal';

export default function EvidenceChipsForSlot({
  workId,
  slotKey,
  max = 3,
  className,
}: {
  workId: string;
  slotKey: string;
  max?: number;
  className?: string;
}) {
  const [claimId, setClaimId] = React.useState<string | null>(null);
  const [cites, setCites] = React.useState<any[]>([]);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    let off = false;
    (async () => {
      try {
        const r = await fetch(`/api/works/${workId}/slots/resolve-claim?slotKey=${encodeURIComponent(slotKey)}`, { cache:'no-store' });
        const j = await r.json();
        if (!off) setClaimId(j?.claimId ?? null);
      } catch {}
    })();
    return () => { off = true; };
  }, [workId, slotKey]);

  React.useEffect(() => {
    if (!claimId) return;
    let off = false;
    (async () => {
      try {
        // Expect: GET /api/citations?targetType=claim&targetId=...
        const u = new URL('/api/citations', window.location.origin);
        u.searchParams.set('targetType', 'claim');
        u.searchParams.set('targetId', claimId);
        const r = await fetch(u.toString(), { cache:'no-store' });
        if (!r.ok) return;
        const j = await r.json();
        const arr = j?.citations ?? j?.items ?? [];
        if (!off) setCites(arr.slice(0, max));
      } catch {}
    })();
    return () => { off = true; };
  }, [claimId, max]);

  // allow adding more citations
  const addCite = !!claimId;

  return (
    <div className={['flex items-center flex-wrap gap-2', className].filter(Boolean).join(' ')}>
      {cites.length === 0 && <span className="text-[11px] text-neutral-500">No evidence yet.</span>}
      {cites.map((c:any) => {
        const label =
          c.source?.title?.slice(0, 32) ||
          c.source?.url?.replace(/^https?:\/\//,'').slice(0, 32) ||
          c.sourceId?.slice(0,8) || 'source';
        return (
          <a
            key={c.id}
            className="text-[10px] px-1.5 py-0.5 rounded border bg-white hover:bg-slate-50"
            href={c.source?.url ?? '#'}
            target={c.source?.url ? '_blank' : undefined}
            rel="noreferrer"
            title={c.source?.url || c.source?.title || ''}
          >
            {label}
          </a>
        );
      })}
      {addCite && (
        <>
          <button
            className="text-[11px] underline text-slate-600"
            onClick={() => setOpen(true)}
          >
            + Cite
          </button>
          <CitePickerModal
            open={open}
            onOpenChange={setOpen}
            targetType="claim"
            targetId={claimId!}
            title="Attach citation"
            onDone={() => {
              setOpen(false);
              // refresh list
              try { window.dispatchEvent(new CustomEvent('citations:changed', { detail: { targetType:'claim', targetId: claimId } })); } catch {}
              // naive refetch
              setTimeout(() => {
                setCites([]); // force refetch on next effect tick
              }, 0);
            }}
          />
        </>
      )}
    </div>
  );
}
