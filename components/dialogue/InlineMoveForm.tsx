'use client';
import * as React from 'react';

export function InlineMoveForm({
  placeholder,
  onSubmit,
  pendingLabel = 'Posting…',
}: {
  placeholder: string;
  onSubmit: (text: string) => Promise<void>;
  pendingLabel?: string;
}) {
  const [val, setVal] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [ok, setOk] = React.useState<null|boolean>(null);

  async function go() {
    if (!val.trim()) return;
    setBusy(true); setOk(null);
    try {
      await onSubmit(val.trim());
      setVal(''); setOk(true);
      setTimeout(()=>setOk(null), 1200);
    } catch {
      setOk(false);
      setTimeout(()=>setOk(null), 1800);
    } finally { setBusy(false); }
  }

  return (
    <div className="flex items-center gap-2">
      <input
        className="border rounded px-2 py-1 text-xs flex-1"
        placeholder={placeholder}
        value={val}
        onChange={e=>setVal(e.target.value)}
        onKeyDown={(e)=>{ if (e.key==='Enter') go(); }}
        disabled={busy}
      />
      <button className="px-2 py-1 border rounded text-xs" onClick={go} disabled={busy}>
        {busy ? pendingLabel : 'Post'}
      </button>
      {ok === true && <span className="text-[10px] text-emerald-700">✓</span>}
      {ok === false && <span className="text-[10px] text-rose-700">✕</span>}
    </div>
  );
}
