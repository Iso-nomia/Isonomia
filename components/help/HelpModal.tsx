'use client';
import { useState } from 'react';

export default function HelpModal() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="text-xs px-2 py-1 rounded border hover:bg-slate-50"
        onClick={()=>setOpen(true)}
        aria-haspopup="dialog"
      >?</button>

      {open && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-black/30">
          <div className="w-[520px] max-w-[90vw] rounded bg-white border shadow p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Discussion Help</h3>
              <button className="text-xs underline" onClick={()=>setOpen(false)}>Close</button>
            </div>
            <ul className="text-sm space-y-2">
              <li><b>What is a representative view?</b> A consistent set of arguments chosen by a transparent rule (Utilitarian/Harmonic/MaxCov).</li>
              <li><b>What does JR mean?</b> MaxCov guaranteed that ≥ n/k users are fully covered by a viewpoint.</li>
              <li><b>Best achievable?</b> The maximum average coverage possible given mutually exclusive arguments.</li>
              <li><b>How do I cite?</b> Click <i>Cite</i> → paste source URL + exact excerpt; we save a snapshot and let you copy CSL-JSON.</li>
              <li><b>How do I create a Claim?</b> Click <i>Promote to Claim</i> to add it to the claim map—used in briefs and decisions.</li>
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
