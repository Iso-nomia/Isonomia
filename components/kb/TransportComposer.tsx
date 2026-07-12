'use client';
import * as React from 'react';
import { EntityPicker } from './EntityPicker';

export function TransportComposer({ open, onClose, onCreate }:{
  open:boolean; onClose:()=>void; onCreate:(fromId:string,toId:string)=>void;
}) {
  const [a, setA] = React.useState<string|null>(null);
  const [b, setB] = React.useState<string|null>(null);

  if (!open) return null;
  const ready = !!(a && b);

  return (
    <div className="fixed inset-0 z-50 bg-black/20 flex items-center justify-center" onClick={onClose}>
      <div className="rounded-lg border bg-white shadow-xl p-4 min-w-[420px]" onClick={e=>e.stopPropagation()}>
        <div className="text-sm font-medium mb-2">Create Transport (A → B)</div>
        <div className="space-y-2">
          <PickRow label="From room" picked={a} onPick={setA} />
          <PickRow label="To room" picked={b} onPick={setB} />
        </div>
        <div className="mt-3 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1 rounded border text-sm">Cancel</button>
          <button
            onClick={()=>{ if (ready) { onCreate(a!, b!); onClose(); } }}
            disabled={!ready}
            className="px-3 py-1 rounded border text-sm bg-indigo-600 text-white disabled:opacity-50"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

function PickRow({ label, picked, onPick }:{ label:string; picked:string|null; onPick:(v:string)=>void }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div>
      <div className="text-xs text-slate-600 mb-1">{label}</div>
      <div className="flex items-center gap-2">
        <input className="flex-1 px-2 py-1 rounded border text-sm" value={picked ?? ''} readOnly placeholder="Pick a room…" />
        <button className="px-2 py-1 rounded border text-sm" onClick={()=>setOpen(true)}>Search</button>
      </div>
      <EntityPicker kind="room" open={open} onClose={()=>setOpen(false)} onPick={(it)=>{ onPick(it.id); setOpen(false); }} />
    </div>
  );
}
