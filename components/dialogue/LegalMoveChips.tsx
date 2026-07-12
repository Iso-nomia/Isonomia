// components/dialogue/LegalMoveChips.tsx
/**
 * LegalMoveChips - Minimal inline UI for dialogue moves
 * 
 * Purpose: Lightweight strip of button chips for quick move selection
 * Use when: You need compact, inline move buttons without heavy UI
 * 
 * Opens specialized modals:
 * - GROUNDS → NLCommitPopover
 * - THEREFORE/SUPPOSE/DISCHARGE → StructuralMoveModal
 * 
 * For full-featured UI, use DialogueActionsButton + DialogueActionsModal instead.
 */
'use client';
import * as React from 'react';
import useSWR from 'swr';
import { useMemo } from 'react';
import { NLCommitPopover } from '@/components/dialogue/NLCommitPopover';
import { StructuralMoveModal } from '@/components/dialogue/StructuralMoveModal';
import { WhyChallengeModal } from '@/components/dialogue/WhyChallengeModal';
import { useBusEffect } from '@/lib/client/useBusEffect';
import { useMicroToast } from '@/hooks/useMicroToast';
import { useCQStats } from '@/hooks/useCQStats';
import type { Move, MoveKind } from '@/types/dialogue';
import { TargetType } from '@prisma/client';

export function LegalMoveChips({
  deliberationId,
  targetType,
  targetId,
  locusPath = '0',
  commitOwner = 'Proponent',
  onPosted,
  onPick,
  showCQButton = false,
  onViewCQs,
}: {
  deliberationId: string;
  targetType: TargetType;
  targetId: string;
  locusPath?: string;
  commitOwner?: 'Proponent'|'Opponent';
  onPosted?: () => void;
  onPick?: (m: Move) => void;
  showCQButton?: boolean;
  onViewCQs?: () => void;
}) {
  const qs = new URLSearchParams({
    deliberationId, targetType, targetId, locusPath
  }).toString();
  const key = `/api/dialogue/legal-moves?${qs}`;

  const fetcher = (u:string)=>fetch(u,{cache:'no-store'}).then(r=>r.json());
  const { data, mutate, isLoading } = useSWR<{ ok:boolean; moves: Move[] }>(key, fetcher, { revalidateOnFocus:false });

  // Fetch CQ stats using shared hook
  const cqStats = useCQStats({ targetType, targetId });

  // live refresh on server events
  useBusEffect(['dialogue:changed','dialogue:moves:refresh'], () => mutate(), { retry: true });

  const toast = useMicroToast();
  const [open, setOpen] = React.useState(false);
  const [pendingMove, setPendingMove] = React.useState<Move | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  
  // Modal state for structural moves
  const [structuralModalOpen, setStructuralModalOpen] = React.useState(false);
  const [structuralMoveKind, setStructuralMoveKind] = React.useState<'THEREFORE' | 'SUPPOSE' | 'DISCHARGE' | null>(null);
  const [pendingStructuralMove, setPendingStructuralMove] = React.useState<Move | null>(null);
  
  // Modal state for WHY challenges
  const [whyChallengeModalOpen, setWhyChallengeModalOpen] = React.useState(false);
  const [pendingWhyMove, setPendingWhyMove] = React.useState<Move | null>(null);

  const postMove = async (m: Move) => {
    if (m.disabled || busy) return;
    if (onPick) { onPick(m); return; }

    // For generic WHY without cqId, open challenge modal instead of prompt
    if (m.kind === 'WHY' && !m.payload?.cqId) {
      setPendingWhyMove(m);
      setWhyChallengeModalOpen(true);
      return; // Modal will handle the rest
    }

    // For THEREFORE, SUPPOSE, DISCHARGE - use modal instead of prompt
    if (m.kind === 'THEREFORE' || m.kind === 'SUPPOSE' || m.kind === 'DISCHARGE') {
      setPendingStructuralMove(m);
      setStructuralMoveKind(m.kind);
      setStructuralModalOpen(true);
      return; // Modal will handle the rest
    }

    setBusy(m.kind);
    try {
      const postTargetType = m.postAs?.targetType ?? targetType;
      const postTargetId   = m.postAs?.targetId   ?? targetId;
      const body = {
        deliberationId,
        targetType: postTargetType,
        targetId: postTargetId,
        kind: m.kind,
        payload: { locusPath, ...(m.payload ?? {}) },
        autoCompile: true, autoStep: true, phase: 'neutral' as const,
      };
      const r = await fetch('/api/dialogue/move', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
      const j = await r.json().catch(()=>({}));
      if (!r.ok || j?.ok === false) throw new Error(j?.error ?? `HTTP ${r.status}`);

      onPosted?.();
      mutate();
      // ✅ Better success messages (structural moves handled separately)
      const successMsg = 
        m.kind === 'WHY' ? 'Challenge posted! Waiting for response.' :
        m.kind === 'GROUNDS' ? 'Response posted successfully!' :
        m.kind === 'CLOSE' ? 'Discussion closed.' :
        m.kind === 'CONCEDE' ? 'Conceded - added to your commitments.' :
        m.kind === 'RETRACT' ? 'Retracted successfully.' :
        `${m.label || m.kind} posted`;
      toast.show(successMsg, 'ok');
    } catch (e:any) {
      toast.show(`Failed to post ${m.label || m.kind}: ${e.message}`, 'err');
    } finally {
      setBusy(null);
    }
  };

  // Handler for structural move modal submission
  const handleStructuralMoveSubmit = async (text: string) => {
    if (!pendingStructuralMove) return;
    
    const m = {
      ...pendingStructuralMove,
      payload: { ...pendingStructuralMove.payload, expression: text }
    };
    
    setBusy(m.kind);
    try {
      const postTargetType = m.postAs?.targetType ?? targetType;
      const postTargetId   = m.postAs?.targetId   ?? targetId;
      const body = {
        deliberationId,
        targetType: postTargetType,
        targetId: postTargetId,
        kind: m.kind,
        payload: { locusPath, ...(m.payload ?? {}) },
        autoCompile: true, autoStep: true, phase: 'neutral' as const,
      };
      const r = await fetch('/api/dialogue/move', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
      const j = await r.json().catch(()=>({}));
      if (!r.ok || j?.ok === false) throw new Error(j?.error ?? `HTTP ${r.status}`);

      onPosted?.();
      mutate();
      
      const successMsg = 
        m.kind === 'THEREFORE' ? 'Conclusion asserted!' :
        m.kind === 'SUPPOSE' ? 'Supposition opened!' :
        m.kind === 'DISCHARGE' ? 'Supposition discharged!' :
        `${m.label || m.kind} posted`;
      toast.show(successMsg, 'ok');
    } catch (e:any) {
      toast.show(`Failed to post ${m.label || m.kind}: ${e.message}`, 'err');
      throw e; // Re-throw so modal can handle it
    } finally {
      setBusy(null);
      setPendingStructuralMove(null);
    }
  };

  // Handler for WHY challenge modal submission
  const handleWhyChallengeSubmit = async (challengeText: string) => {
    if (!pendingWhyMove) return;
    
    const m = {
      ...pendingWhyMove,
      payload: { ...pendingWhyMove.payload, expression: challengeText.trim() }
    };
    
    setBusy(m.kind);
    try {
      const postTargetType = m.postAs?.targetType ?? targetType;
      const postTargetId   = m.postAs?.targetId   ?? targetId;
      const body = {
        deliberationId,
        targetType: postTargetType,
        targetId: postTargetId,
        kind: m.kind,
        payload: { locusPath, ...(m.payload ?? {}) },
        autoCompile: true, autoStep: true, phase: 'neutral' as const,
      };
      const r = await fetch('/api/dialogue/move', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
      const j = await r.json().catch(()=>({}));
      if (!r.ok || j?.ok === false) throw new Error(j?.error ?? `HTTP ${r.status}`);

      onPosted?.();
      mutate();
      toast.show('Challenge posted! Waiting for response.', 'ok');
    } catch (e:any) {
      toast.show(`Failed to post challenge: ${e.message}`, 'err');
      throw e; // Re-throw so modal can handle it
    } finally {
      setBusy(null);
      setPendingWhyMove(null);
    }
  };

  // Note: answerAndCommit removed - all GROUNDS moves now use NLCommitPopover modal flow

  const moves = Array.isArray(data?.moves) ? (data!.moves as Move[]) : [];

  // 👇 priority: CLOSE (†) first, then GROUNDS, WHY, CONCEDE, RETRACT, everything else.
  const priority = (m: Move) =>
    m.kind === 'CLOSE'   && !m.disabled ? 0 :
    m.kind === 'GROUNDS' && !m.disabled ? 1 :
    m.kind === 'WHY'     && !m.disabled ? 2 :
    m.kind === 'CONCEDE' ? 3 :
    m.kind === 'RETRACT' ? 4 : 9;

  const sorted = useMemo(() => [...moves].sort((a,b) => priority(a) - priority(b)), [moves]);

  if (!deliberationId || !targetId || (!isLoading && !moves.length)) return null;



  const cls = (m: Move) => [
    'px-2 py-1 rounded text-xs menu',
    m.kind === 'GROUNDS' ? ' text-emerald-700' :
    m.kind === 'WHY'     ? ' text-amber-700'  :
    m.kind === 'CONCEDE' ? ' text-slate-700'  :
    m.kind === 'RETRACT' ? ' text-slate-700'  : ' text-slate-700',
    m.kind === 'CLOSE' && !m.disabled ? ' font-semibold ring-1 ring-emerald-400/70' : '',
    m.disabled ? ' opacity-50 cursor-not-allowed' : ''
  ].join(' ');

  const btnClass = (m: Move) => [
    'px-2 py-1 rounded-md text-xs btnv2--ghost border bg-white transition',
    m.kind === 'CLOSE'
      ? 'border-indigo-300 text-indigo-800 bg-indigo-50 hover:bg-indigo-100 font-semibold'
      : m.kind === 'GROUNDS'
      ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
      : m.kind === 'WHY'
      ? 'border-amber-200 text-amber-700 hover:bg-amber-50'
      : 'border-slate-200 text-slate-700 hover:bg-slate-50',
    (m.disabled || !!busy) ? 'opacity-50 cursor-not-allowed' : ''
  ].join(' ');
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {sorted.map((m, i) => {
          // Extract CQ text from verdict context if available
          const cqText = (m as any).verdict?.context?.cqText;
          const cqKey = (m as any).verdict?.context?.cqKey;
          
          // Build tooltip text
          const tooltipText = 
            m.disabled ? m.reason : 
            m.kind === "WHY" && !m.payload?.cqId ? "Challenge this claim - ask for justification" :
            m.kind === "GROUNDS" && cqText ? `${cqKey}: ${cqText}` :
            m.kind === "GROUNDS" ? "Respond to the challenge with your reasoning" :
            m.kind === "CLOSE" ? "End this discussion and accept the current state" :
            m.kind === "CONCEDE" ? "Accept this claim and add it to your commitments" :
            m.kind === "RETRACT" ? "Withdraw your previous statement" :
            m.label;
          
          return (
            <div key={`${m.kind}-${i}`} className="inline-flex items-center gap-1">
              <button
                disabled={!!m.disabled || !!busy || m.relevance === "unlikely"}
                title={tooltipText}
                onClick={() => {
                  // For GROUNDS moves, always open the modal (no more prompt!)
                  if (m.kind === "GROUNDS") {
                    setPendingMove(m);
                    setOpen(true);
                  } else {
                    postMove(m);
                  }
                }}
                className={(m.kind === "ASSERT" && (m as any)?.payload?.as === "ACCEPT_ARGUMENT")
                  ? "px-2 py-1 rounded text-xs border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                  : cls(m)}
              >
                {m.kind === "CLOSE"   ? (m.label || "Close (†)") :
                 m.kind === "GROUNDS" ? `Answer ${m.label}` :
                 m.kind === "WHY"     ? (m.label || "CHALLENGE") :
                 m.label}
              </button>
            </div>
          );
        })}
        
        {/* View CQs button with badge */}
        {showCQButton && cqStats && cqStats.total > 0 && (
          <button
            onClick={onViewCQs}
            className="px-2 py-1 rounded-md text-xs border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition flex items-center gap-1"
            title={`View ${cqStats.total} critical questions (${cqStats.satisfied} answered)`}
          >
            <span>View CQs</span>
            <span className={[
              'inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[10px] font-semibold px-1',
              cqStats.satisfied === cqStats.total ? 'bg-emerald-500 text-white' :
              cqStats.satisfied > 0 ? 'bg-amber-400 text-slate-900' :
              'bg-slate-300 text-slate-700'
            ].join(' ')}>
              {cqStats.satisfied}/{cqStats.total}
            </span>
          </button>
        )}
      </div>

      {open && pendingMove && (
        <NLCommitPopover
          open={open}
          onOpenChange={setOpen}
          deliberationId={deliberationId}
          targetType={targetType as "argument" | "claim" | "card"}
          targetId={targetId}
          locusPath={pendingMove.payload?.justifiedByLocus ?? locusPath}
          cqKey={pendingMove.payload?.cqId ?? pendingMove.payload?.schemeKey ?? "default"}
          defaultOwner={commitOwner}
          onDone={() => { mutate(); onPosted?.(); }}
        />
      )}
      
      {/* Structural Move Modal (THEREFORE/SUPPOSE/DISCHARGE) */}
      {structuralModalOpen && structuralMoveKind && (
        <StructuralMoveModal
          open={structuralModalOpen}
          onOpenChange={setStructuralModalOpen}
          kind={structuralMoveKind}
          onSubmit={handleStructuralMoveSubmit}
        />
      )}
      
      {/* WHY Challenge Modal */}
      {whyChallengeModalOpen && (
        <WhyChallengeModal
          open={whyChallengeModalOpen}
          onOpenChange={setWhyChallengeModalOpen}
          onSubmit={handleWhyChallengeSubmit}
        />
      )}
      
      {toast.node}
    </>
  );
}