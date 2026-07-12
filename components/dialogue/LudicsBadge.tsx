// components/dialogue/LudicsBadge.tsx
'use client';
import * as React from 'react';

export function LudicsBadge({
  deliberationId,
  targetType,
  targetId,
}: {
  deliberationId: string;
  targetType: 'argument' | 'claim' | 'card';
  targetId: string;
}) {
  const [unresolved, setUnresolved] = React.useState(false);

  React.useEffect(() => {
    if (!deliberationId || !targetId) return;
    let alive = true;
    const ctrl = new AbortController();

    const fetchOpen = async () => {
      try {
        const url =
          deliberationId && targetId
            ? `/api/dialogue/open-cqs?deliberationId=${encodeURIComponent(
                deliberationId
              )}&targetType=${encodeURIComponent(targetType)}&targetId=${encodeURIComponent(targetId)}`
            : null;
       if (!url) return;                        // ✅ extra safety
         const res = await fetch(url, { cache: 'no-store', signal: ctrl.signal });
       if (!res.ok) return;
       const j = await res.json().catch(() => null);
        if (!alive) return;
        setUnresolved(Array.isArray(j?.cqOpen) && j.cqOpen.length > 0);
      } catch { /* ignore */ }
    };

    fetchOpen();
    const h = () => fetchOpen();
    window.addEventListener('dialogue:moves:refresh', h as any);

    return () => {
      alive = false;
      ctrl.abort();
      window.removeEventListener('dialogue:moves:refresh', h as any);
    };
  },  [deliberationId, targetType, targetId]);

  return (
    <span
      className={`px-1.5 py-0.5 rounded border text-[10px] ${
        unresolved
          ? 'bg-rose-50 border-rose-200 text-rose-700'
          : 'bg-slate-50 border-slate-200 text-slate-700'
      }`}
      title={
        unresolved ? 'Open WHY challenge — click to focus in Ludics' : 'No open WHY'
      }
      onClick={() => {
        window.dispatchEvent(
          new CustomEvent('ludics:focus', {
            detail: { deliberationId, target: { type: targetType, id: targetId } },
          })
        );
      }}
      style={{ cursor: 'pointer' }}
    >
      Ludics {unresolved ? 'WHY' : 'OK'}
    </span>
  );
}
