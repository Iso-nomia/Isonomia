'use client';
import * as React from 'react';

type Props = { argumentId: string; onCreated?: (nodeId: string)=>void };

export default function AnchorToMapButton({ argumentId, onCreated }: Props) {
  const [sel, setSel] = React.useState<{text: string; start: number; end: number} | null>(null);
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const onMouseUp = () => {
      const s = window.getSelection();
      if (!s || s.isCollapsed) { setSel(null); setOpen(false); return; }
      const text = s.toString();
      const anchorNode = s.anchorNode;
      if (!text || !anchorNode) return;
      // Best-effort offsets for now:
      const root = document.getElementById(`arg-${argumentId}`);
      if (!root) return;
      const full = root.innerText || '';
      const idx = full.indexOf(text);
      if (idx < 0) return;
      setSel({ text, start: idx, end: idx + text.length });
      setOpen(true);
    };
    document.addEventListener('mouseup', onMouseUp);
    return () => document.removeEventListener('mouseup', onMouseUp);
  }, [argumentId]);

  async function createNode(kind: 'claim'|'reason'|'counter'|'evidence') {
    if (!sel) return;
    try {
      // stub API; replace with your real route
      const res = await fetch('/api/map/nodes', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ argumentId, ...sel, kind }),
      });
      const json = await res.json().catch(()=>null);
      onCreated?.(json?.id || '');
    } finally {
      setOpen(false);
      setSel(null);
    }
  }

  if (!open || !sel) return null;
  return (
    <div
      ref={ref}
      className="fixed z-50 px-2 py-1 text-xs bg-white border rounded shadow"
      style={{ left: 12, bottom: 24 }}
    >
      <span className="mr-2">Map as:</span>
      <button className="px-1 py-0.5 border rounded mr-1 " onClick={()=>createNode('claim')}>Claim</button>
      <button className="px-1 py-0.5 border rounded mr-1" onClick={()=>createNode('reason')}>Reason</button>
      <button className="px-1 py-0.5 border rounded mr-1" onClick={()=>createNode('counter')}>Counter</button>
      <button className="px-1 py-0.5 border rounded" onClick={()=>createNode('evidence')}>Evidence</button>
    </div>
  );
}
