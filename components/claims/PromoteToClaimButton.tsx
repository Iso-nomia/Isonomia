'use client';
import { useState } from 'react';

type Props =
  | {
      deliberationId?: string;
      target: { type: 'argument' | 'card'; id: string };
      label?: string;
      onClaim?: (claimId: string) => void;
    }
  | {
      deliberationId?: string;
      text: string;
      label?: string;
      onClaim?: (claimId: string) => void;
    };

export default function PromoteToClaimButton(props: Props) {
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  async function promote() {
    setBusy(true);
    setToast(null);

     const payload =
       'target' in props
         ? { deliberationId: props.deliberationId, target: props.target, text: (props as any).text }
         : { deliberationId: props.deliberationId, text: (props as any).text };

     // Prefer native timeout; fall back to AbortController
     const useNativeTimeout = typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal;
     const controller = useNativeTimeout ? null : new AbortController();
     const signal = useNativeTimeout ? (AbortSignal as any).timeout(30000) : controller!.signal;
     const tid = controller ? setTimeout(() => controller!.abort(), 30000) : null;
  
     try {
       const res = await fetch('/api/claims', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(payload),
         signal,
       });
     if (tid) clearTimeout(tid);


      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
     const claimId = data?.claim?.id ?? data?.claimId;
      // Let claim lists update themselves
 if (claimId) {
   window.dispatchEvent(new CustomEvent('claims:changed', { detail: { claimId } }));
 }
      setToast(data.created ? 'Claim created ✓' : 'Already promoted');
      // auto-dismiss toast after 2.5s
      setTimeout(() => setToast(null), 2500);
    } catch (e: any) {
             if (e?.name === 'AbortError' || /aborted/i.test(String(e?.message))) {
         setToast('Timed out while promoting. Please try again.');
       } else {
         setToast(e?.message ?? 'Error promoting');
     }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="inline-flex items-center gap-2">
      <button
        disabled={busy}
        onClick={promote}
        className="text-xs px-2 py-1 btnv2--ghost rounded"
        title="Promote to Claim (thin CEG)"
      >
        {busy ? 'Promoting…' : (('label' in props && props.label) || 'Promote to Claim')}
      </button>
      {toast && (
        <span
          className={`text-[11px] ${
            toast.includes('✓') ? 'text-emerald-600' : 'text-rose-600'
          }`}
        >
          {toast}
        </span>
      )}
    </div>
  );
}
