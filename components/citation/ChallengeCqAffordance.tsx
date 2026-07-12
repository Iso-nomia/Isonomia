"use client";

import { useState } from "react";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { useSession } from "@/lib/useSession";
import ChallengeCqDialog from "./ChallengeCqDialog";

export type ChallengeCqAffordanceProps = {
  argumentId: string;
  cqKey: string;
  schemeKey: string | null;
  cqRequiresEvidence: boolean;
  cqBurden: "PROPONENT" | "CHALLENGER" | "OPPONENT";
  /**
   * Whether the canonical answer was self-asserted by an AI agent over MCP
   * (Dev Spec §12.1). Drives the harder "your challenge is especially valuable"
   * nudge — disclosure only, never gates the form.
   */
  answerSelfCanonical: boolean;
};

/**
 * Per-answered-CQ challenge island (Dev Spec §12.3). Mounted inside the server
 * `AnsweredCriticalQuestions` card. Gates on `useSession`:
 *   • signed-in  → "Challenge this answer" button + modal dialog
 *   • signed-out → muted "Sign in to challenge" link (NOT the form)
 *
 * On a successful filing it flips to a local optimistic DISPUTED confirmation
 * (the next server render reconciles to the amber badge + ledger).
 */
export default function ChallengeCqAffordance({
  argumentId,
  cqKey,
  schemeKey,
  cqRequiresEvidence,
  cqBurden,
  answerSelfCanonical,
}: ChallengeCqAffordanceProps) {
  const { session, loading } = useSession();
  const [open, setOpen] = useState(false);
  const [filed, setFiled] = useState(false);

  // Optimistic post-file state: the next server render shows the real amber
  // badge + challenge ledger; until then we confirm inline (§12.3).
  if (filed) {
    return (
      <div className="mt-2.5 flex items-center gap-1.5 pt-2.5 border-t border-amber-200/50">
        <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0" />
        <span className="text-xs text-amber-700/90 leading-relaxed">
          Challenge filed — this answer is now disputed and will be re-examined.
        </span>
      </div>
    );
  }

  // While the session resolves, render nothing to avoid a flash of the wrong
  // affordance.
  if (loading) return null;

  const signedIn = !!session && session.userId != null;

  return (
    <div className="mt-2.5 pt-2.5 border-t border-slate-200/60 flex flex-col gap-1.5">
      {answerSelfCanonical && (
        <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
          <ShieldAlert className="w-3 h-3" />
          Answered by an AI agent
        </span>
      )}
      {signedIn ? (
        <>
          <button
            type="button"
            onClick={() => setOpen(true)}
            data-testid="challenge-cq-button"
            className="inline-flex items-center gap-1.5 self-start px-2.5 py-1 rounded-lg text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200/70 transition-colors"
          >
            <AlertTriangle className="w-3 h-3" />
            Challenge this answer
          </button>
          {open && (
            <ChallengeCqDialog
              argumentId={argumentId}
              cqKey={cqKey}
              schemeKey={schemeKey}
              cqRequiresEvidence={cqRequiresEvidence}
              cqBurden={cqBurden}
              answerSelfCanonical={answerSelfCanonical}
              onClose={() => setOpen(false)}
              onFiled={() => setFiled(true)}
            />
          )}
        </>
      ) : (
        <a
          href="/login"
          className="inline-flex items-center gap-1 self-start text-xs text-slate-400 hover:text-slate-600"
        >
          Sign in to challenge
        </a>
      )}
    </div>
  );
}
