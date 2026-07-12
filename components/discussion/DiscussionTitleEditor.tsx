'use client';
import * as React from 'react';

export default function DiscussionTitleEditor({
  id,
  title,
  canEdit,
  onUpdated,
  className,
}: {
  id: string;
  title: string | null;
  canEdit: boolean;
  onUpdated?: (t: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState(title?.trim() || '');
  const [busy, setBusy] = React.useState(false);
  const display = value.trim() || 'Discussion';

  React.useEffect(() => { setValue(title?.trim() || ''); }, [title]);

  async function save() {
    const next = value.trim();
    if (!next || busy) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/discussions/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: next }),
      });
      if (!r.ok) throw new Error(await r.text().catch(()=> 'Failed'));
      onUpdated?.(next);
      setEditing(false);
    } catch (e) {
      console.error(e);
      // TODO: toast error
    } finally { setBusy(false); }
  }

  if (!canEdit) {
    return <h1 className={className + ' truncate text-sm  tracking-wide'}>{display}</h1>;
  }

  return (
    <div className={className + ' flex items-center gap-2'}>
      {editing ? (
        <>
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save();
              if (e.key === 'Escape') { setValue(title?.trim() || ''); setEditing(false); }
            }}
            maxLength={160}
            className="rounded border px-2 py-1 text-sm"
            placeholder="Enter a title…"
          />
          <button
            onClick={save}
            disabled={!value.trim() || busy}
            className="rounded border px-2 py-1 text-xs hover:bg-slate-50"
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={() => { setValue(title?.trim() || ''); setEditing(false); }}
            className="rounded border px-2 py-1 text-xs hover:bg-slate-50"
          >
            Cancel
          </button>
        </>
      ) : (
        <div className='flex items-center gap-3'>
          <h1 className="flex truncate text-sm  tracking-wider">{display}</h1>
          <button
            onClick={() => setEditing(true)}
            className="flex items-center btnv2--ghost px-1.5 py-.5 text-[11px] text-slate-600 rounded-xl  hover:bg-slate-50"
            aria-label="Rename discussion"
            title="Rename"
          >
            ✎ Rename
          </button>
        </div>
      )}
    </div>
  );
}
