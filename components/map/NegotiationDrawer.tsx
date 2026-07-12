// components/dialogue/NegotiationDrawer.tsx
'use client';
import * as React from 'react';
import { createPortal } from 'react-dom';

export default function NegotiationDrawer({
  deliberationId,
  open,
  onClose,
}: {
  deliberationId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [moves, setMoves] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/dialogue/move?deliberationId=${encodeURIComponent(deliberationId)}`
      );
      const json = await res.json();
      setMoves(json.moves || []);
    } catch {
      /* noop */
    }
    setLoading(false);
  }, [open, deliberationId]);

  React.useEffect(() => {
    load();
  }, [load]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999]">
      {/* overlay */}
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
      />
      {/* drawer */}
      <div className="absolute right-0 top-0 h-full w-[420px] bg-white border-l shadow-2xl p-3 overflow-y-auto">
        <div className="flex items-center justify-between mb-2">
          <div className="font-medium text-sm">Negotiation timeline</div>
          <button
            className="text-xs underline"
            onClick={load}
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
        <div className="space-y-2">
          {moves.map((m: any) => (
            <div key={m.id} className="rounded border p-2">
              <div className="text-xs text-neutral-600">
                <b>{m.kind}</b> ·{' '}
                {new Date(m.createdAt).toLocaleString()}
              </div>
              <div className="text-sm">
                {m.targetType} {m.targetId}
              </div>
              {m.payload && (
                <pre className="mt-1 text-[11px] bg-slate-50 p-2 rounded overflow-x-auto">
                  {JSON.stringify(m.payload, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
        <div className="mt-3 text-right">
          <button
            className="px-2 py-1 border rounded text-xs"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
