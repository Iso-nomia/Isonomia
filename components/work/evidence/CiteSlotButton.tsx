'use client';
import * as React from 'react';
import CitePickerModal from '@/components/citations/CitePickerModal';

type Props = {
  workId: string;
  slotKey: string;             // e.g., 'DN.explanandum'
  getText: () => string;       // how to read current slot text
  label?: string;              // button label
  className?: string;
  onPromoted?: (claimId: string) => void; // optional hook
};

/**
 * Ensures a slot-backed claim exists by calling your slots/promote endpoint,
 * then opens the CitePickerModal targeting that claim.
 * This attaches a Source to the claim (→ counted by WorkStatusRail's evidence).
 */
export default function CiteSlotButton({
  workId, slotKey, getText, label = 'Cite…', className, onPromoted,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [claimId, setClaimId] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  async function ensureClaim() {
    setBusy(true); setErr(null);
    try {
      const text = (getText() || '').trim();
      if (!text) throw new Error('Add text first.');
      // reuse your existing promote endpoint
      const r = await fetch(`/api/works/${workId}/slots/promote`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slotKey, text }),
      });
      const j = await r.json();
      if (!r.ok || !(j?.claim?.id || j?.claimId)) {
        throw new Error(j?.error || 'Failed to promote slot to claim.');
      }
      const cid = String(j.claim?.id ?? j.claimId);
      setClaimId(cid);
      onPromoted?.(cid);
      setOpen(true);
    } catch (e: any) {
      setErr(e?.message || 'Failed');
    } finally { setBusy(false); }
  }

  return (
    <>
      <button
        type="button"
        className={['px-2 py-1 text-[11px] underline underline-offset-2 text-neutral-700 hover:bg-slate-50', className].filter(Boolean).join(' ')}
        disabled={busy}
        onClick={ensureClaim}
        title="Attach a citation to the slot-backed claim"
      >
        {busy ? '…' : label}
      </button>

      {err && <span className="ml-2 text-[11px] text-rose-600">{err}</span>}

      {open && claimId && (
        <CitePickerModal
          open={open}
          onOpenChange={(v)=>setOpen(v)}
          targetType="claim"
          targetId={claimId}
          title="Attach citation"
          onDone={() => {
            setOpen(false);
            // Let any evidence badges refresh if they listen to 'citations:changed'
            try { window.dispatchEvent(new CustomEvent('citations:changed', { detail: { targetType:'claim', targetId: claimId }})); } catch {}
          }}
        />
      )}
    </>
  );
}
