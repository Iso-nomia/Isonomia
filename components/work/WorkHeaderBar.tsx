// components/work/WorkHeaderBar.tsx
'use client';
import * as React from 'react';
import SupplyDrawer from './SupplyDrawer';
import { IntegrityBadge } from '../integrity/IntegrityBadge';
import CitePickerModal from '@/components/citations/CitePickerModal';
export default function WorkHeaderBar({
  workId,
  title,
  theoryType,
  deliberationId
}: { workId:string; title:string; theoryType:'DN'|'IH'|'TC'|'OP'; deliberationId:string }) {
  const [open, setOpen] = React.useState(false);
  const [citeOpen, setCiteOpen] = React.useState(false);

  return (
    <div className="flex items-center justify-between border-b pb-2 mb-3">
      <div className="flex items-center gap-2">
        <span className="px-1.5 py-0.5 rounded bg-neutral-100 text-xs">{theoryType}</span>
        <h2 className="text-sm font-semibold">{title}</h2>
        <IntegrityBadge workId={workId} theoryType={theoryType} />
      </div>
      <div className="flex items-center gap-2">
        <button className="px-2 py-1 border rounded text-xs bg-white" onClick={()=>setOpen(true)}>
          Dependencies…
        </button>
                <button className="px-2 py-1 border rounded text-xs bg-white" onClick={()=>setCiteOpen(true)}>
          Cite this Work…
        </button>
        <button
  className="px-2 py-1 border rounded text-xs bg-white"
  onClick={async () => {
    const res = await fetch(`/api/works/${workId}/dossier?format=md`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${title.replace(/\s+/g,'_')}_Dossier.md`;
    a.click(); URL.revokeObjectURL(url);
  }}
>
  Export Dossier
</button>
      </div>
        <CitePickerModal
        open={citeOpen}
        onOpenChange={setCiteOpen}
        targetType="work"
        targetId={workId}
        title="Attach citation to this Work"
      />
      <SupplyDrawer workId={workId} open={open} onClose={()=>setOpen(false)} />
    </div>
  );
}
