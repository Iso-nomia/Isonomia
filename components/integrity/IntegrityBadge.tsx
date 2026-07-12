// components/integrity/IntegrityBadge.tsx
'use client';
import * as React from 'react';

export function IntegrityBadge({ workId, theoryType }:{
  workId:string; theoryType:'DN'|'IH'|'TC'|'OP'
}) {
  const [data, setData] = React.useState<{ has: any }|null>(null);
  React.useEffect(() => {
    (async () => {
      const res = await fetch(`/api/works/${workId}/integrity`, { cache:'no-store' });
      const j = await res.json(); setData(j ?? null);
    })();
  }, [workId]);

  if (!data) return null;

  const h = data.has;
  let ok=false, msg='';
  if (theoryType==='DN') { ok = !!h.dn;                msg = ok ? 'DN slots complete' : 'Add DN structure'; }
  if (theoryType==='IH') { ok = !!(h.ih && h.herm && h.prac && h.std); msg = ok ? 'IH complete' : 'Add IH + hermeneutic + practical + std.'; }
  if (theoryType==='TC') { ok = !!(h.tc && h.prac && h.std);           msg = ok ? 'TC complete' : 'Add TC + practical + std.'; }
  if (theoryType==='OP') { ok = !!(h.op && h.pascal);                   msg = ok ? 'OP complete' : 'Add OP + Pascal'; }

  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] border ${ok?'bg-emerald-50 border-emerald-200 text-emerald-700':'bg-amber-50 border-amber-200 text-amber-800'}`}>
      {msg}
    </span>
  );
}
