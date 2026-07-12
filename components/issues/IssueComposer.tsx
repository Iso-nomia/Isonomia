// components/issues/IssueComposer.tsx
'use client';
import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

export default function IssueComposer({
  deliberationId,
  initialArgumentId,
  initialTarget, // { type:'argument'|'claim'|'card', id:string }
  initialLabel,
  open,
  onOpenChange,
  onCreated,
}: {
  deliberationId: string;
  initialArgumentId?: string;
  initialTarget?: { type:'argument'|'claim'|'card'; id:string };
   
  initialLabel?: string;
  open: boolean;
  onOpenChange: (o:boolean)=>void;
  onCreated?: (issueId: string) => void;
}) {
  const [label, setLabel] = React.useState('');
  const [desc, setDesc] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  React.useEffect(()=>{ if (open) { setLabel(initialLabel ?? ''); setDesc(''); } }, [open, initialLabel]);

  async function submit() {
    if (!label.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/deliberations/${encodeURIComponent(deliberationId)}/issues`, {
        method:'POST', headers:{'content-type':'application/json'},
          body: JSON.stringify({
            label: label.trim(),
            description: desc.trim() || undefined,
            links: initialArgumentId ? [initialArgumentId] : undefined,
            targets: initialTarget ? [{ type: initialTarget.type, id: initialTarget.id, role: 'related' }] : undefined,
         }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { issue } = await res.json();
      window.dispatchEvent(new CustomEvent('issues:refresh', { detail: { deliberationId } }));
      onCreated?.(issue.id);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={o => !busy && onOpenChange(o)}>
      <DialogContent className="bg-slate-50 rounded-xl sm:max-w-[520px]">
        <DialogHeader><DialogTitle>Open an issue</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <label className="block">
            <span className="text-[11px] text-neutral-600">Label</span>
            <input className="mt-1 w-full border rounded px-2 py-1 text-sm" value={label} onChange={e=>setLabel(e.target.value)} placeholder="e.g., Data validity" />
          </label>
          <label className="block">
            <span className="text-[11px] text-neutral-600">Description (optional)</span>
            <textarea className="mt-1 w-full border rounded px-2 py-1 text-sm" rows={4} value={desc} onChange={e=>setDesc(e.target.value)} />
          </label>
        </div>
        <DialogFooter>
          <button className="px-2 py-1 border rounded text-xs" onClick={()=>onOpenChange(false)} disabled={busy}>Cancel</button>
          <button className="px-2 py-1 border rounded text-xs bg-emerald-50" onClick={submit} disabled={busy || !label.trim()}>
            {busy ? 'Opening…' : 'Open issue'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
