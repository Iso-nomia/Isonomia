// components/agora/SheetPicker.tsx
'use client';
import useSWR from 'swr';
import React from 'react';
import clsx from 'clsx';

export default function SheetPicker({
  rooms,
  value,
  onChange,
}: {
  rooms: string[];
  value: string | null;             // either "delib:<roomId>" or a sheet id
  onChange: (sheetKey: string) => void;
}) {
interface SheetListResponse {
    items: SheetItem[];
}

const { data } = useSWR<SheetListResponse>(
    '/api/sheets/list', (u: string) => fetch(u, { cache: 'no-store' }).then((r: Response) => r.json())
);

  const [manual, setManual] = React.useState('');
  const sheets = data?.items ?? [];
interface SheetItem {
    id: string;
    title: string | null;
}

interface SheetPickerProps {
    rooms: string[];
    value: string | null;
    onChange: (sheetKey: string) => void;
}
  const pickRoom = (rid: string) => onChange(`delib:${rid}`);
  const pickSheet = (sid: string) => onChange(sid);
  const submitManual = () => {
    const s = manual.trim();
    if (!s) return;
    // accept "delib:<id>" or a bare id
    onChange(s.startsWith('delib:') ? s : s);
    setManual('');
  };

  return (
    <div className="flex flex-col gap-2 p-2 text-sm rounded border bg-white/70">
      <div className="font-medium">Active sheet</div>
      <div className="flex items-center gap-2">
        <label className="text-neutral-600">From room:</label>
        <select className="menuv2--lite rounded px-2 py-1"
          value={value?.startsWith('delib:') ? value.slice(6) : ''}
          onChange={e => pickRoom(e.target.value)}>
          <option value="">— select room —</option>
          {rooms.map(rid => <option key={rid} value={rid}>room:{rid.slice(0,20)}…</option>)}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-neutral-600">Real sheet:</label>
        <select className="menuv2--lite rounded px-2 py-1"
          value={value && !value.startsWith('delib:') ? value : ''}
          onChange={e => pickSheet(e.target.value)}>
          <option value="">— select sheet —</option>
          {sheets.map(s => <option key={s.id} value={s.id}>{s.title ?? s.id.slice(0,10)+'…'}</option>)}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-neutral-600">Paste id:</label>
        <input className="rounded border px-2 py-1 flex-1" value={manual} onChange={e=>setManual(e.target.value)}
               placeholder="delib:<roomId> or <sheetId>" />
        <button className="px-2 py-1 rounded border" onClick={submitManual}>Load</button>
      </div>
    </div>
  );
}
