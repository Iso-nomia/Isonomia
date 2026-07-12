// components/work/editors/IHThesesEditor.tsx
'use client';
import * as React from 'react';
import { slotAnchorId } from './slot-helpers';
import PromoteSlotButton from '../PromoteSlotButton';
import CiteSlotButton from '@/components/work/evidence/CiteSlotButton';
import EvidenceChipsForSlot from '@/components/work/evidence/EvidenceChipsForSlot';

type Ih = {
  structure?: string | null;
  function?: string | null;
  objectivity?: string | null;
};

export default function IHThesesEditor({ workId }: { workId: string }) {
  const [val, setVal] = React.useState<Ih>({});
  const [saving, setSaving] = React.useState(false);
  const [savedAt, setSavedAt] = React.useState<number | null>(null);

  React.useEffect(() => {
    (async () => {
      const r = await fetch(`/api/works/${workId}/ih`, { cache: 'no-store' });
      const j = await r.json();
      if (j?.ih) setVal(j.ih);
    })();
  }, [workId]);

    async function save() {
    setSaving(true);
    try {
      const r = await fetch(`/api/works/${workId}/ih`, {
        method: 'PUT', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(val),
      });
      if (!r.ok) {
        const txt = await r.text();
        alert(`Save IH failed: ${r.status} ${txt}`);
        return;
      }
      setSavedAt(Date.now()); // ✅ actually mark saved
    } finally { setSaving(false); }
  }

  return (
    <div className="rounded border p-2 space-y-2 bg-white/70">
      <div className="text-sm  font-medium">IH Theses</div>

<label id={slotAnchorId('IH.structure')} htmlFor="ih-structure" className="text-xs text-neutral-600">Structure (TIH)</label>
  <div className="flex items-center gap-2">
  <PromoteSlotButton workId={workId} slotKey="IH.structure" getText={() => val.structure ?? ''} />
  <CiteSlotButton     workId={workId} slotKey="IH.structure" getText={() => val.structure ?? ''} />
</div>
<EvidenceChipsForSlot workId={workId} slotKey="IH.structure" className="mt-1" />
      <textarea id="ih-structure" className="w-full minorfield border border-indigo-400/60 rounded px-1.5 py-1.5 text-sm" rows={2}
        placeholder="Describe the structure of the practice/system"
        value={val.structure ?? ''} onChange={e => setVal(v => ({ ...v, structure: e.target.value }))} />

      <label htmlFor="ih-function" className="text-xs text-neutral-600">Function (TIH)</label>
      <div className="flex items-center gap-2">
  <PromoteSlotButton workId={workId} slotKey="IH.function" getText={() => val.function ?? ''} />
  <CiteSlotButton     workId={workId} slotKey="IH.function" getText={() => val.function ?? ''} />
</div>
<EvidenceChipsForSlot workId={workId} slotKey="IH.function" className="mt-1" />
      <textarea id="ih-function" className="w-full minorfield border border-indigo-400/60 rounded px-1.5 py-1.5 text-sm" rows={2}
        placeholder="What function/ends does it (should it) serve?"
        value={val.function ?? ''} onChange={e => setVal(v => ({ ...v, function: e.target.value }))} />

      <label htmlFor="ih-objectivity" className="text-xs text-neutral-600">Objectivity of reasons (TIH)</label>
      <div className="flex items-center gap-2">
  <PromoteSlotButton workId={workId} slotKey="IH.objectivity" getText={() => val.objectivity ?? ''} />
  <CiteSlotButton     workId={workId} slotKey="IH.objectivity" getText={() => val.objectivity ?? ''} />
</div>
<EvidenceChipsForSlot workId={workId} slotKey="IH.objectivity" className="mt-1" />
      <textarea id="ih-objectivity" className="w-full minorfield border border-indigo-400/60 rounded px-1.5 py-1.5 text-sm" rows={2}
        placeholder="Justify that reasons are objective / intersubjectively warranted"
        value={val.objectivity ?? ''} onChange={e => setVal(v => ({ ...v, objectivity: e.target.value }))} />

      <div className="flex items-center gap-2">
        <button className="btnv2--ghost px-3 py-1 border rounded text-xs bg-white hover:bg-neutral-100" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        {savedAt && <span className="text-[11px] text-neutral-500">Saved</span>}
      </div>
    </div>
  );
}
