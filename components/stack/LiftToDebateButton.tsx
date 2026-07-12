// components/stack/LiftToDebateButton.tsx
"use client";

import { useState } from "react";
import { ArrowUpIcon, CheckIcon, FileTextIcon, Loader2Icon } from "lucide-react";

interface LiftToDebateButtonProps {
  commentId: string;
  hostType: string;
  hostId: string;
  citationCount?: number; // Phase 2.2: Show citation count hint
}

export default function LiftToDebateButton({ 
  commentId, 
  hostType, 
  hostId,
  citationCount = 0,
}: LiftToDebateButtonProps) {
  const [lifting, setLifting] = useState(false);
  const [result, setResult] = useState<{ 
    success: boolean; 
    citationsCopied?: number;
    deliberationId?: string;
  } | null>(null);

  async function go() {
    setLifting(true);
    setResult(null);

    const r = await fetch("/api/comments/lift", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ commentId, hostType, hostId, as: "claim" }),
    });

    let j: any = null;
    try { j = await r.json(); } catch {}

    if (r.ok && j?.deliberationId) {
      setResult({ 
        success: true, 
        citationsCopied: j.citationsCopied,
        deliberationId: j.deliberationId,
      });
      
      // Redirect after brief success message
      setTimeout(() => {
        location.href = `/deliberation/${j.deliberationId}`;
      }, 1200);
    } else {
      setResult({ success: false });
      alert(j?.error || `Lift failed (HTTP ${r.status})`);
      setLifting(false);
    }
  }

  // Success state
  if (result?.success) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-green-600 ml-2 px-3 py-1.5">
        <CheckIcon className="h-3.5 w-3.5" />
        <span>
          Lifted
          {result.citationsCopied ? ` with ${result.citationsCopied} citation${result.citationsCopied > 1 ? "s" : ""}` : ""}
        </span>
      </div>
    );
  }

  return (
    <button 
      onClick={go} 
      disabled={lifting}
      className="btnv2 btnv2--sm text-xs px-3 py-1.5 ml-2 flex items-center gap-1.5 disabled:opacity-50"
    >
      {lifting ? (
        <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <ArrowUpIcon className="h-3.5 w-3.5" />
      )}
      <span>{lifting ? "Lifting..." : "Deliberate"}</span>
      {citationCount > 0 && !lifting && (
        <span className="flex items-center gap-0.5 text-muted-foreground opacity-70">
          <FileTextIcon className="h-3 w-3" />
          {citationCount}
        </span>
      )}
    </button>
  );
}
   