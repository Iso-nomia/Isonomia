// components/work/PromoteSlotButton.tsx
'use client';
import * as React from 'react';

export default function PromoteSlotButton({
  workId, slotKey, getText,
}: {
  workId: string;
  slotKey: string;               // use SlotKey
  getText?: () => string;        // optional; falls back to server read
}) {
  const [pending, setPending] = React.useState(false);
  const [ok, setOk] = React.useState<boolean | null>(null);

  return (
    <button
      type="button"
      className="text-[11px] underline underline-offset-2 text-neutral-700 disabled:opacity-50"
            disabled={(getText?.().trim().length === 0) || pending || ok === true}

      onClick={async () => {
        setPending(true);
        try {
          const text = getText?.().trim();
          const r = await fetch(`/api/works/${workId}/slots/promote`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ slotKey, text: text || undefined }),
          });
          setOk(r.ok);
          // Let edges/consumers refresh if needed
          window.dispatchEvent(new CustomEvent('mesh:edges-updated', { detail: { toWorkId: workId } }));
        } finally { setPending(false); }
      }}
    >
      {pending ? 'Promoting…' : (ok ? 'Promoted ✓' : 'Promote to claim')}
    </button>
  );
}
