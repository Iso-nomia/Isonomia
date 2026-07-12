// components/work/SelectionPromoteBar.tsx
'use client';
import * as React from 'react';

export function SelectionPromoteBar({
  workId,
  deliberationId, // if you want to verify context client-side; server enforces anyway
  getSelection,
}: {
  workId: string;
  deliberationId: string;
  getSelection: () => { text:string; start:number; end:number } | null; // you have the viewer offsets
}) {
  const [pending, setPending] = React.useState(false);
  const [visible, setVisible] = React.useState(false);
  const [sel, setSel] = React.useState<{text:string; start:number; end:number}|null>(null);

  React.useEffect(() => {
    const h = () => {
      const s = getSelection();
      setSel(s);
      setVisible(!!s && s.text.trim().length >= 3);
    };
    document.addEventListener('selectionchange', h);
    return () => document.removeEventListener('selectionchange', h);
  }, [getSelection]);

  if (!visible || !sel) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-2 py-1 bg-white/90 border rounded shadow text-sm">
      <button
        disabled={pending}
        className="px-2 py-1 border rounded"
        onClick={async () => {
          setPending(true);
          try {
            const res = await fetch(`/api/works/${workId}/promote-claim`, {
              method:'POST',
              headers:{ 'Content-Type':'application/json' },
              body: JSON.stringify({
                text: sel.text,
                locatorStart: sel.start,
                locatorEnd: sel.end,
                excerptHash: btoa(sel.text).slice(0,32), // simple, replace with SHA if you prefer
              })
            });
            if (!res.ok) {
              const msg = await res.text();
              alert(`Promote failed: ${msg}`);
            } else {
              setVisible(false);
            }
          } finally {
            setPending(false);
          }
        }}
      >
        Promote to Claim
      </button>
    </div>
  );
}
