'use client';
import * as React from 'react';

export default function EditClient({ pageId, initialTitle }: { pageId:string; initialTitle:string }) {
  const [title, setTitle] = React.useState(initialTitle);
  const [saving, setSaving] = React.useState(false);
  const [note, setNote] = React.useState<string|null>(null);

  async function save() {
    setSaving(true); setNote(null);
    const r = await fetch(`/api/kb/pages/${pageId}`, {
      method:'PATCH',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ title })
    });
    if (r.ok) setNote('Saved'); else setNote('Save failed');
    setSaving(false);
  }

  return (
    <div className="rounded-lg border bg-white p-3 space-y-3">
      <div className="flex items-center gap-2">
        <label className="text-sm min-w-[60px]">Title</label>
        <input
          value={title}
          onChange={e=>setTitle(e.target.value)}
          className="flex-1 rounded border px-2 py-1 text-sm"
          placeholder="Untitled"
        />
        <button onClick={save} disabled={saving} className="rounded border px-3 py-1.5 text-sm hover:bg-slate-50">
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      {note && <div className="text-xs text-emerald-700">{note}</div>}
      <div className="pt-2 text-[12px] text-slate-600">
        (Editor shell) You can wire the full block editor here next: add text, image, and transclusion blocks.  
        For now, rename the page title and “View” to inspect the live renderer.
      </div>
    </div>
  );
}
