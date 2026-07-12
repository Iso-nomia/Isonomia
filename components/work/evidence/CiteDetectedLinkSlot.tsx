// components/work/evidence/CiteDetectedLinkSlot.tsx
'use client';
import * as React from 'react';

export default function CiteDetectedLinkSlot({
  workId,
  slotKey,
  text,
}: {
  workId: string;
  slotKey: string;         // e.g. 'DN.nomological'
  text: string;            // slot body
}) {
  const [busy, setBusy] = React.useState(false);
  const urls = React.useMemo(() => {
    const found = (text?.match(/\bhttps?:\/\/[^\s)]+/gi) ?? []).map(u => u.replace(/[),.;]+$/, ''));
    return Array.from(new Set(found));
  }, [text]);

  async function citeAndPromote(url: string) {
    setBusy(true);
    try {
      // 1) promote → get claimId
      const pr = await fetch(`/api/works/${workId}/slots/promote`, {
        method:'POST', headers:{'content-type':'application/json'},
        body: JSON.stringify({ slotKey, text: (text||'').trim() })
      });
      const pj = await pr.json();
      const claimId = String(pj?.claim?.id ?? pj?.claimId ?? '');
      if (!claimId) throw new Error('Promote failed');

      // 2) resolve URL to Source
      const rr = await fetch('/api/citations/resolve', {
        method:'POST', headers:{'content-type':'application/json'},
        body: JSON.stringify({ url })
      });
      const rj = await rr.json();
      const sourceId = rj?.source?.id;
      if (!sourceId) throw new Error('Resolve failed');

      // 3) attach to the claim
      await fetch('/api/citations/attach', {
        method:'POST', headers:{'content-type':'application/json'},
        body: JSON.stringify({ targetType:'claim', targetId: claimId, sourceId })
      });

      try { window.dispatchEvent(new CustomEvent('citations:changed', { detail: { targetType:'claim', targetId: claimId } })); } catch {}
    } catch (e:any) {
      alert(e?.message || 'Failed to cite link');
    } finally { setBusy(false); }
  }

  if (urls.length === 0) return null;

  return (
    <div className="mt-1 flex items-center gap-2">
      <button
        className="px-2 py-1 btnv2--ghost rounded text-[11px]"
        disabled={busy}
        onClick={() => citeAndPromote(urls[0])}
        title={urls[0]}
      >
        Cite detected link
      </button>

      {urls.length > 1 && (
        <details className="relative">
          <summary className="list-none px-2 py-1 btnv2--ghost rounded text-[11px] cursor-pointer">
            Cite detected links ▾
          </summary>
          <div className="absolute z-20 mt-1 rounded border bg-white shadow p-2 min-w-[240px]">
            {urls.map((u) => (
              <div key={u} className="flex items-center justify-between gap-2 py-0.5">
                <button className="text-[11px] underline" onClick={() => citeAndPromote(u)} title={u}>
                  {new URL(u).hostname}
                </button>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
