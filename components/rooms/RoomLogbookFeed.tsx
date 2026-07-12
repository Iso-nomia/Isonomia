'use client';
import useSWR from 'swr';
const fetcher = (u: string)=>fetch(u).then(r=>r.json());

export default function RoomLogbookFeed({ roomId }:{ roomId: string }) {
  const {data} = useSWR(`/api/room-logbook?roomId=${roomId}`, fetcher);
  const items = data?.items ?? [];
  return (
    <div className="space-y-2">
      <div className="text-xs uppercase text-slate-500">Logbook</div>
      {items.map((e:any)=>(
        <div key={e.id} className="text-xs border rounded p-2">
          <div className="font-medium">{e.entryType}</div>
          <div className="text-slate-600">{e.summary}</div>
          <div className="text-slate-400">{new Date(e.createdAt).toLocaleString()}</div>
        </div>
      ))}
    </div>
  );
}
