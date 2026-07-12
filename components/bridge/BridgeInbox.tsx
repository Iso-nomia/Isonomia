'use client';
import useSWR from 'swr';
import { useState } from 'react';
import SummaryComposer from './SummaryComposer';

export default function BridgeInbox({ userId, hostType, hostId }:{
  userId: string;
  hostType?: 'article'|'post'|'room_thread'|'deliberation';
  hostId?: string;
}) {
  const { data, mutate } = useSWR(`/api/bridges/assignments?userId=${userId}`, (u)=>fetch(u).then(r=>r.json()));
  const rows = data?.assignments ?? [];
  const [selected, setSelected] = useState<any|null>(null);

  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold">Bridge assignments</div>
      {rows.map((a:any)=>(
        <div key={a.id} className="border rounded p-3">
          <div className="text-sm">Request: <code>{a.requestId}</code></div>
          <div className="text-xs text-neutral-600">Deliberation: {a.request.deliberationId}</div>
          <div className="flex gap-2 mt-2">
            <button className="px-2 py-1.5 bg-neutral-100 rounded text-sm" onClick={()=>setSelected(a)}>Open</button>
            {!a.acceptedAt && (
              <button
                className="px-2 py-1.5 bg-amber-500 text-white rounded text-sm"
                onClick={async ()=>{
                  await fetch(`/api/bridges/assignments/${a.id}/accept`, { method: 'POST' });
                  mutate();
                }}
              >Accept</button>
            )}
          </div>
        </div>
      ))}
      {selected && (
        <div className="border rounded p-3">
          <SummaryComposer
            deliberationId={selected.request.deliberationId}
            assigneeId={userId}
            assignmentId={selected.id}
            hostType={hostType}
            hostId={hostId}
            onDone={()=>{ setSelected(null); mutate(); }}
          />
        </div>
      )}
    </div>
  );
}
