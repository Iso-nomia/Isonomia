// components/deepdive/IssueRegister.tsx
'use client';
import { useEffect, useState } from 'react';

export default function IssueRegister({ deliberationId }: { deliberationId: string }) {
  const [issues, setIssues] = useState<any[]>([]);
  const [label, setLabel] = useState('');
  const [desc, setDesc] = useState('');

  const load = async () => {
    const res = await fetch(`/api/deliberations/${deliberationId}/issues`);
    const data = await res.json(); setIssues(data.issues ?? []);
  };

  useEffect(() => { load(); }, [deliberationId]);

  const create = async () => {
    if (!label.trim()) return;
    await fetch(`/api/deliberations/${deliberationId}/issues`, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ label, description: desc })
    });
    setLabel(''); setDesc(''); load();
  };

  const close = async (id: string) => {
    await fetch(`/api/deliberations/${deliberationId}/issues/${id}`, { method: 'PATCH' });
    load();
  };

  return (
    <div className="rounded-md border p-3 space-y-3">
      <div className="text-sm font-medium">Issue register</div>
      <div className="flex gap-2">
        <input className="border rounded px-2 py-1 text-sm flex-1" placeholder="Label (e.g., Data validity)"
          value={label} onChange={(e)=>setLabel(e.target.value)} />
        <button className="px-2 py-1 border rounded" onClick={create}>Open issue</button>
      </div>
      <textarea className="w-full border rounded p-2 text-sm" placeholder="Short description (optional)"
        value={desc} onChange={e=>setDesc(e.target.value)} />
      <ul className="space-y-2">
        {issues.map((i:any)=>(
          <li key={i.id} className="p-2 border rounded">
            <div className="text-sm font-medium">{i.label}</div>
            {i.description && <div className="text-xs text-neutral-600">{i.description}</div>}
            <div className="text-[11px] text-neutral-500">Linked args: {i.links?.length ?? 0}</div>
            <div className="mt-1">
              <button className="px-2 py-1 border rounded text-xs" onClick={()=>close(i.id)}>Close</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
