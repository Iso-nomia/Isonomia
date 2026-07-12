// components/discussion/DiscussionDescriptionEditor.tsx
'use client';
import * as React from 'react';

export default function DiscussionDescriptionEditor({
  id,
  description,
  canEdit,
  onUpdated,
  className = '',
}: {
  id: string;
  description: string | null;
  canEdit: boolean;
  onUpdated?: (desc: string | null) => void;
  className?: string;
}) {
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState(description?.trim() || '');
  const [busy, setBusy] = React.useState(false);
  const display = value.trim() || 'No description';
  const hasDescription = !!description?.trim();

  React.useEffect(() => {
    setValue(description?.trim() || '');
  }, [description]);

  async function save() {
    const next = value.trim() || null;
    if (busy) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/discussions/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ description: next }),
      });
      if (!r.ok) throw new Error(await r.text().catch(() => 'Failed'));
      onUpdated?.(next);
      setEditing(false);
    } catch (e) {
      console.error(e);
      // TODO: toast error
    } finally {
      setBusy(false);
    }
  }

  function cancel() {
    setValue(description?.trim() || '');
    setEditing(false);
  }

  if (!canEdit) {
    return hasDescription ? (
      <p className={`text-sm text-slate-600 ${className}`}>{display}</p>
    ) : null;
  }

  return (
    <div className={`${className}`}>
      {editing ? (
        <div className="space-y-2">
          <textarea
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') cancel();
              // Cmd/Ctrl + Enter to save
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') save();
            }}
            maxLength={500}
            rows={1}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            placeholder="Add a brief description (optional)..."
          />
          <div className="flex items-center gap-5 justify-between">
            <span className="text-xs text-slate-400">
              {value.length}/500 characters
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={cancel}
                className="btnv2--ghost rounded-lg text-center  px-2 py-1 text-xs  text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={busy}
                className="rounded-lg bg-indigo-500 text-center px-3 py-1 text-xs font-medium text-white hover:bg-indigo-600 disabled:opacity-50"
              >
                {busy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="group flex items-center tracking-wide gap-2">
          <p className={`flex-1 text-sm ${hasDescription ? 'text-slate-600' : 'text-slate-400 italic'}`}>
            {display}
          </p>
          <button
            onClick={() => setEditing(true)}
            className="opacity-0 rounded-lg px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 group-hover:opacity-100 transition-opacity"
            aria-label="Edit description"
            title="Edit description"
          >
            {hasDescription ? '✎ Edit' : '+ Add description'}
          </button>
        </div>
      )}
    </div>
  );
}