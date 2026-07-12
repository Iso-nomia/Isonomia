// components/agora/RoomAndDebatePickers.tsx
"use client";
import useSWR from 'swr';

export function RoomPicker({
  value, onChange,
}: { value: string|null; onChange: (id: string)=>void }) {
  const { data } = useSWR('/api/agora/rooms', u=>fetch(u).then(r=>r.json()));
  const rooms = data?.items ?? [];
  return (
    <div className="flex items-center gap-2 text-sm">
      <label className="text-neutral-600">Room:</label>
      <select className="menuv2--lite rounded px-2 py-1"
        value={value ?? ''} onChange={e=>onChange(e.target.value)}>
        {!value && <option value="">Select…</option>}
        {rooms.map((r:any)=>(
          <option key={r.id} value={r.id}>{r.title ?? r.slug}</option>
        ))}
      </select>
    </div>
  );
}

export function DebatePicker({
  roomId, value, onChange,
}: { roomId?:string|null; value:string|null; onChange:(id:string)=>void }) {
  const { data } = useSWR(
    roomId ? `/api/agora/rooms/${roomId}/deliberations` : null,
    u=>fetch(u).then(r=>r.json())
  );
  const debates = data?.items ?? [];
  if (!roomId) return null;
  return (
    <div className="flex items-center gap-2 text-sm">
      <label className="text-neutral-600">Debate:</label>
      <select className=" menuv2--lite w-full rounded px-2 py-1"
        value={value ?? ''} onChange={e=>onChange(e.target.value)}>
        {!value && <option value="">Select…</option>}
        {debates.map((d:any)=>(
          <option key={d.id} value={d.id}>{d.title}</option>
        ))}
      </select>
    </div>
  );
}

export function SheetPicker({
  deliberationId, value, onChange,
}: { deliberationId?:string|null; value:string|null; onChange:(id:string)=>void }) {
  const { data } = useSWR(
    deliberationId ? `/api/sheets/by-deliberation/${deliberationId}` : null,
    u=>fetch(u).then(r=>r.json())
  );
  const curated = data?.items ?? [];
  if (!deliberationId) return null;

  return (
    <div className="flex items-center gap-2 text-sm">
      <label className="text-neutral-600">Sheet:</label>
      <select className="menuv2--lite rounded px-2 py-1"
        value={value ?? `delib:${deliberationId}`}
        onChange={e=>onChange(e.target.value)}>
        <option value={`delib:${deliberationId}`}>Live (synthetic)</option>
        {curated.map((s:any)=>(
          <option key={s.id} value={s.id}>{s.title ?? s.id.slice(0,18)+'…'}</option>
        ))}
      </select>
    </div>
  );
}
