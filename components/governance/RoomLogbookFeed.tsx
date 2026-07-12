'use client';
import useSWR from 'swr';

export default function RoomLogbookFeed({ roomId }: { roomId: string }) {
  const { data } = useSWR(`/api/rooms/${roomId}/logbook?limit=100`, (u) => fetch(u).then(r => r.json()));
  const entries = data?.entries ?? [];
  return (
    <div className="border rounded-md p-3 space-y-2">
      <div className="text-sm font-semibold">Room logbook</div>
      {entries.map((e: any) => (
        <div key={e.id} className="text-sm border-b pb-2">
          <div className="text-neutral-700">{e.entryType}</div>
          <div className="text-neutral-900">{e.summary}</div>
          <div className="text-xs text-neutral-500">{new Date(e.createdAt).toLocaleString()}</div>
        </div>
      ))}
    </div>
  );
}
