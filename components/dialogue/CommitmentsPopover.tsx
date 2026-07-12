// components/dialogue/CommitmentsPopover.tsx
'use client';
import * as React from 'react';
import useSWR from 'swr';

const fetcher = (u:string)=>fetch(u,{cache:'no-store'}).then(r=>r.json());

export function CommitmentsPopover({ deliberationId }: { deliberationId: string }) {
  const { data } = useSWR<{ ok:boolean; commitments: Record<string, { proposition:string; locusPath?:string|null; createdAt:string }[]> }>(
    `/api/dialogue/commitments?deliberationId=${deliberationId}`, fetcher);
  if (!data?.ok) return null;

  return (
    <div className="rounded-xl border bg-white/80 p-3 panel-edge text-sm">
      <div className="font-medium mb-2">Public Commitments</div>
      <div className="space-y-2">
        {Object.entries(data.commitments).map(([user, list]) => (
          <div key={user}>
            <div className="text-slate-700 font-medium">User {user}</div>
            <ul className="ml-4 list-disc">
              {list.map((c, i) => (
                <li key={i}>
                  <span className="text-slate-800">{c.proposition}</span>
                  {c.locusPath ? <span className="ml-1 text-slate-500">@{c.locusPath}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
