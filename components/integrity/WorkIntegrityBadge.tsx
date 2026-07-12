// components/integrity/WorkIntegrityBadge.tsx
'use client';
import * as React from 'react';
import useSWR from 'swr';
const fetcher = (u:string)=>fetch(u,{cache:'no-store'}).then(r=>r.json());

export default function WorkIntegrityBadge({ workId, theoryType }:{ workId:string; theoryType:'DN'|'IH'|'TC'|'OP' }) {
  const { data: herm } = useSWR(theoryType==='IH' ? `/api/works/${workId}/hermeneutic` : null, fetcher);
  const { data: pasc } = useSWR(theoryType==='OP' ? `/api/works/${workId}/pascal` : null, fetcher);
  const { data: prac } = useSWR((theoryType==='IH' || theoryType==='TC') ? `/api/works/${workId}/practical` : null, fetcher);

  let msg = 'OK';
  let ok = true;
  if (theoryType === 'IH') {
    const hasHerm = !!herm?.hermeneutic && (herm.hermeneutic.hypotheses?.length || 0) > 0;
    const hasPrac = !!prac?.practical && Object.keys(prac.practical.result || {}).length > 0;
    ok = hasHerm && hasPrac;
    msg = ok ? 'IH: Hermeneutic + Practical present' : `IH: ${hasHerm ? '' : 'needs Hermeneutic; '} ${hasPrac ? '' : 'needs Practical'}`.trim();
  } else if (theoryType === 'TC') {
    const hasPrac = !!prac?.practical && Object.keys(prac.practical.result || {}).length > 0;
    ok = hasPrac;
    msg = ok ? 'TC: Practical present' : 'TC: add Practical justification';
  } else if (theoryType === 'OP') {
    const hasPascal = !!pasc?.pascal && !!pasc.pascal.decision?.bestActionId;
    ok = hasPascal;
    msg = ok ? 'OP: Pascal decision present' : 'OP: add Pascal decision';
  } else if (theoryType === 'DN') {
    msg = 'DN: add supply links to IH/TC/OP (optional)';
  }

  return (
    <span className={`text-[11px] px-2 py-0.5 rounded border ${ok ? 'bg-emerald-50 border-emerald-200 text-emerald-700':'bg-amber-50 border-amber-200 text-amber-800'}`}>
      {msg}
    </span>
  );
}
