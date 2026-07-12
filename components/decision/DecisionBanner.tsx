'use client';
import useSWR from 'swr';
const fetcher = (u:string)=>fetch(u,{cache:'no-store'}).then(r=>r.json());

export function DecisionBanner({
  deliberationId, subjectType, subjectId,
}: { deliberationId:string; subjectType:'claim'|'locus'|'view'|'option'|'card'; subjectId:string }) {
  const key = `/api/decisions?deliberationId=${deliberationId}&subjectType=${subjectType}&subjectId=${subjectId}&limit=1`;
  const { data } = useSWR<{items:any[]}>(key, fetcher, { revalidateOnFocus:false });

  const rec = data?.items?.[0];
  if (!rec) return null;

  const isUnderReview = rec.inputsJson?.underReview === true;
  const pill =
    rec.kind === 'allocative' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
    rec.kind === 'procedural' ? 'bg-amber-50 text-amber-700 border-amber-200' :
    rec.kind === 'editorial' ? 'bg-sky-50 text-sky-700 border-sky-200' :
                               'bg-emerald-50 text-emerald-700 border-emerald-200';

  return (
    <div className="mt-2 rounded border p-2 bg-white">
      <div className="text-[12px] flex items-center gap-2">
        <span className={`px-1.5 py-0.5 rounded border ${pill}`}>{rec.kind}</span>
        <span className="text-neutral-600">
          {isUnderReview ? 'Under review' : (rec.rationale || 'Decision recorded')}
          {rec.issuedBy?.startsWith?.('panel') ? ' · Panel' : rec.issuedBy}
        </span>
      </div>
    </div>
  );
}

// components/decisions/DecisionBanner.tsx


export function DecisionBanner_Votes({
  deliberationId, subjectType, subjectId,
}: { deliberationId: string; subjectType:'claim'|'card'; subjectId:string }) {
  const { data } = useSWR(
    `/api/decisions/receipts?deliberationId=${deliberationId}&subjectType=${subjectType}&subjectId=${subjectId}`,
    fetcher,
    { revalidateOnFocus:false }
  );
  const items = data?.items ?? [];
  if (!items.length) return null;

  return (
    <div className="mt-1 mb-1 rounded border bg-emerald-50/60 border-emerald-200 text-emerald-800 px-2 py-1 text-[12px]">
      {items.slice(0,2).map((r:any) => (
        <div key={r.id}>
          <b>{r.kind}</b> · {r.rationale ?? 'confirmed'}
          {r.openVoteId ? <span className="ml-1">· vote open</span> : null}
        </div>
      ))}
    </div>
  );
}
