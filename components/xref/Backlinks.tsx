// components/xref/Backlinks.tsx
"use client";
import useSWR from 'swr';
export default function Backlinks({ toType, toId }:{ toType:string; toId:string }) {
  const { data } = useSWR(`/api/xref?toType=${toType}&toId=${toId}`, (u)=>fetch(u,{cache:'no-store'}).then(r=>r.json()));
  const items = data?.items ?? [];
  if (!items.length) return null;
  return (
    <div className="rounded border bg-white/70 p-2">
      <div className="text-xs font-medium mb-1">Backlinks</div>
      <ul className="space-y-1">
        {items.map((x:any)=>(
          <li key={x.id} className="text-[12px]">
            <span className="text-slate-500">{x.relation}</span> from <b>{x.fromType}</b> <code className="text-slate-600">{x.fromId.slice(0,6)}…</code>
          </li>
        ))}
      </ul>
    </div>
  );
}
