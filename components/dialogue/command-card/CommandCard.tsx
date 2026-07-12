// components/dialogue/command-card/CommandCard.tsx
'use client';

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import type { CommandCardProps, CommandCardAction } from './types';
import { NLCommitPopover } from '@/components/dialogue/NLCommitPopover';
import { StructuralMoveModal } from '@/components/dialogue/StructuralMoveModal';
import { WhyChallengeModal } from '@/components/dialogue/WhyChallengeModal';

function getActionStyles(action: CommandCardAction, isExecuting: boolean) {
  const base = 'h-10 rounded-lg text-[11px] px-2 border transition-all duration-200 transform relative overflow-hidden';
  
  if (action.disabled) {
    return `${base} opacity-40 cursor-not-allowed bg-slate-50 border-slate-200`;
  }

  if (isExecuting) {
    return `${base} scale-95 bg-blue-100 border-blue-300`;
  }

  switch (action.tone) {
    case 'danger':
      return `${base} border-rose-300 bg-rose-50 hover:bg-rose-100 hover:border-rose-400 hover:scale-105 active:scale-95`;
    case 'primary':
      return `${base} border-indigo-300 bg-indigo-50 hover:bg-indigo-100 hover:border-indigo-400 hover:scale-105 active:scale-95 font-semibold`;
    default:
      return `${base} border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 hover:scale-105 active:scale-95`;
  }
}

function getForceIndicator(force: CommandCardAction['force']) {
  switch (force) {
    case 'ATTACK':
      return <span className="text-rose-600 text-[9px]">⚔️</span>;
    case 'SURRENDER':
      return <span className="text-emerald-600 text-[9px]">🏳️</span>;
    default:
      return null;
  }
}

function getRelevanceIndicator(relevance: CommandCardAction['relevance']) {
  if (!relevance) return null;
  switch (relevance) {
    case 'likely':
      return <span className="text-emerald-500 text-[8px]">●</span>;
    case 'unlikely':
      return <span className="text-amber-500 text-[8px]">○</span>;
    default:
      return null;
  }
}

export function CommandCard({
  actions,
  onPerform,
  variant = 'full',
}: CommandCardProps) {
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [lastExecutedId, setLastExecutedId] = useState<string | null>(null);
  
  // Modal state for GROUNDS moves
  const [groundsModalOpen, setGroundsModalOpen] = useState(false);
  const [pendingGroundsAction, setPendingGroundsAction] = useState<CommandCardAction | null>(null);
  
  // Modal state for WHY challenges
  const [whyChallengeModalOpen, setWhyChallengeModalOpen] = useState(false);
  const [pendingWhyAction, setPendingWhyAction] = useState<CommandCardAction | null>(null);
  
  // Modal state for structural moves (THEREFORE/SUPPOSE)
  const [structuralModalOpen, setStructuralModalOpen] = useState(false);
  const [pendingStructuralAction, setPendingStructuralAction] = useState<CommandCardAction | null>(null);

  const handlePerform = useCallback(async (action: CommandCardAction) => {
    if (action.disabled || executingId) return;

    // For GROUNDS moves, open the modal instead of posting directly
    if (action.move?.kind === 'GROUNDS') {
      setPendingGroundsAction(action);
      setGroundsModalOpen(true);
      return;
    }
    
    // For generic WHY without cqId, open challenge modal
    if (action.move?.kind === 'WHY' && !action.move.payload?.cqId) {
      setPendingWhyAction(action);
      setWhyChallengeModalOpen(true);
      return;
    }
    
    // For THEREFORE/SUPPOSE, open structural modal
    if (action.move?.kind === 'THEREFORE' || action.move?.kind === 'SUPPOSE') {
      setPendingStructuralAction(action);
      setStructuralModalOpen(true);
      return;
    }

    setExecutingId(action.id);
    try {
      await onPerform(action);
      setLastExecutedId(action.id);
      setTimeout(() => setLastExecutedId(null), 1000);
    } catch (error) {
      console.error('Command execution failed:', error);
    } finally {
      setExecutingId(null);
    }
  }, [executingId, onPerform]);

  // Validate action count (warn if >9 since we only have 3x3 grid)
  useEffect(() => {
    if (actions.length > 9) {
      console.warn(`CommandCard: ${actions.length} actions provided but only 9 can be displayed in 3x3 grid. Excess actions will be hidden.`);
    }
  }, [actions.length]);

  // Group actions by row
  const grid = [
    actions.filter(a => a.group === 'top'),
    actions.filter(a => a.group === 'mid'),
    actions.filter(a => a.group === 'bottom'),
  ];

  const width = variant === 'compact' ? 'w-[220px]' : 'w-full';

  return (
    <div className={`${width} rounded-xl border border-slate-200 bg-white/95 backdrop-blur shadow-lg p-2`}>
      {/* Header */}
      <div className="mb-2 px-1">
        <h3 className="text-xs font-semibold text-slate-700">Actions</h3>
      </div>

      {/* Action Grid */}
      <div className="space-y-1">
        {grid.map((row, rowIndex) => (
          <div key={rowIndex} className="grid grid-cols-3 gap-1">
            {row.slice(0, 3).map(action => {
              const isExecuting = executingId === action.id;
              const wasExecuted = lastExecutedId === action.id;

              return (
                <button
                  key={action.id}
                  title={action.reason || action.label}
                  disabled={action.disabled || !!executingId}
                  className={getActionStyles(action, isExecuting)}
                  onClick={() => handlePerform(action)}
                  aria-label={action.label}
                >
                  {/* Success flash */}
                  {wasExecuted && (
                    <div className="absolute inset-0 bg-emerald-400/50 animate-ping" />
                  )}

                  {/* Loading spinner */}
                  {isExecuting && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/80">
                      <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}

                  <div className="flex flex-col items-center justify-center leading-tight relative z-10">
                    {/* Label with indicators */}
                    <div className="flex items-center gap-0.5">
                      {getForceIndicator(action.force)}
                      <span className="truncate max-w-[80px]">{action.label}</span>
                      {getRelevanceIndicator(action.relevance)}
                    </div>

                    {/* Disabled reason */}
                    {action.disabled && action.reason && (
                      <span className="text-[8px] text-slate-500 mt-0.5 italic truncate max-w-full">
                        {action.reason}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
            
            {/* Fill empty slots */}
            {row.length < 3 &&
              Array.from({ length: 3 - row.length }).map((_, j) => (
                <div key={`empty-${j}`} className="h-10" />
              ))}
          </div>
        ))}
      </div>

      {/* Stats footer */}
      {actions.length > 0 && (
        <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[9px] text-slate-500 px-1">
          <span>{actions.filter(a => !a.disabled).length} available</span>
          {executingId && (
            <span className="text-blue-600 font-medium animate-pulse">Executing...</span>
          )}
        </div>
      )}

      {/* GROUNDS modal for answering critical questions */}
      {groundsModalOpen && pendingGroundsAction && pendingGroundsAction.target && (
        <NLCommitPopover
          open={groundsModalOpen}
          onOpenChange={setGroundsModalOpen}
          deliberationId={pendingGroundsAction.target.deliberationId}
          targetType={pendingGroundsAction.target.targetType}
          targetId={pendingGroundsAction.target.targetId}
          locusPath={pendingGroundsAction.target.locusPath || '0'}
          cqKey={pendingGroundsAction.move?.payload?.cqId || 'default'}
          defaultOwner="Proponent"
          onDone={() => {
            setGroundsModalOpen(false);
            setPendingGroundsAction(null);
            // Trigger UI refresh
            window.dispatchEvent(new CustomEvent('mesh:dialogue:refresh'));
          }}
        />
      )}
      
      {/* WHY Challenge Modal */}
      {whyChallengeModalOpen && pendingWhyAction && (
        <WhyChallengeModal
          open={whyChallengeModalOpen}
          onOpenChange={setWhyChallengeModalOpen}
          onSubmit={async (challengeText) => {
            const actionWithPayload: CommandCardAction = {
              ...pendingWhyAction,
              move: {
                ...pendingWhyAction.move!,
                payload: {
                  ...pendingWhyAction.move!.payload,
                  expression: challengeText.trim()
                }
              }
            };
            
            setWhyChallengeModalOpen(false);
            setPendingWhyAction(null);
            
            // Execute the action with the challenge text
            setExecutingId(actionWithPayload.id);
            try {
              await onPerform(actionWithPayload);
              setLastExecutedId(actionWithPayload.id);
              setTimeout(() => setLastExecutedId(null), 1000);
            } catch (error) {
              console.error('Command execution failed:', error);
            } finally {
              setExecutingId(null);
            }
          }}
        />
      )}
      
      {/* Structural Move Modal (THEREFORE/SUPPOSE) */}
      {structuralModalOpen && pendingStructuralAction && (
        <StructuralMoveModal
          open={structuralModalOpen}
          onOpenChange={setStructuralModalOpen}
          kind={pendingStructuralAction.move!.kind as 'THEREFORE' | 'SUPPOSE'}
          onSubmit={async (expressionText) => {
            const actionWithPayload: CommandCardAction = {
              ...pendingStructuralAction,
              move: {
                ...pendingStructuralAction.move!,
                payload: {
                  ...pendingStructuralAction.move!.payload,
                  expression: expressionText.trim()
                }
              }
            };
            
            setStructuralModalOpen(false);
            setPendingStructuralAction(null);
            
            // Execute the action with the expression text
            setExecutingId(actionWithPayload.id);
            try {
              await onPerform(actionWithPayload);
              setLastExecutedId(actionWithPayload.id);
              setTimeout(() => setLastExecutedId(null), 1000);
            } catch (error) {
              console.error('Command execution failed:', error);
            } finally {
              setExecutingId(null);
            }
          }}
        />
      )}
    </div>
  );
}

// Helper function to execute commands (used by parent components)
// ⚠️ DEPRECATED: This standalone helper uses window.prompt() which is deprecated.
// Instead, use the CommandCard component's handlePerform method which opens proper modals.
// 
// Migration guide:
// - For WHY without cqId: Opens WhyChallengeModal
// - For THEREFORE/SUPPOSE: Opens StructuralMoveModal
// - For GROUNDS: Opens NLCommitPopover
//
// TODO: Remove this function once all callers are migrated to use CommandCard component directly
export async function performCommand(action: CommandCardAction): Promise<void> {
  if (action.scaffold?.template) {
    // Client-side: insert template into composer
    window.dispatchEvent(
      new CustomEvent('mesh:composer:insert', {
        detail: { template: action.scaffold.template },
      })
    );

    // Optional: track analytics
    if (action.scaffold.analyticsName) {
      // trackEvent(action.scaffold.analyticsName);
    }
    
    // Dispatch a success event so UI can react if needed
    window.dispatchEvent(
      new CustomEvent('mesh:command:success', {
        detail: { actionId: action.id, kind: action.kind },
      })
    );
    return;
  }

  if (action.move) {
    // Server-side: execute protocol move
    const { deliberationId, targetType, targetId, locusPath } = action.target;
    
    let payload: any = {
      ...(action.move.payload || {}),
      ...(locusPath ? { locusPath } : {}),
    };

    // ⚠️ DEPRECATED: Using window.prompt() - should use WhyChallengeModal instead
    if (action.move.kind === 'WHY' && !payload.cqId) {
      console.warn('[performCommand] DEPRECATED: window.prompt() for WHY. Use CommandCard component instead.');
      const challengeText = window.prompt('What is your challenge? (Why should we accept this?)');
      if (!challengeText || !challengeText.trim()) {
        console.log('Challenge cancelled - no text entered');
        return;
      }
      payload = { ...payload, expression: challengeText.trim() };
    }

    // ⚠️ DEPRECATED: Using window.prompt() - should use StructuralMoveModal instead
    if (action.move.kind === 'THEREFORE' || action.move.kind === 'SUPPOSE') {
      console.warn('[performCommand] DEPRECATED: window.prompt() for structural moves. Use CommandCard component instead.');
      const promptText = action.move.kind === 'THEREFORE' 
        ? 'Enter the conclusion that follows from the premises:'
        : 'Enter the supposition (what we\'re assuming):';
      
      const expression = window.prompt(promptText);
      if (!expression || !expression.trim()) {
        console.log('Cancelled - no text entered');
        return;
      }
      
      payload = { ...payload, expression: expression.trim() };
    }
    
    const response = await fetch('/api/dialogue/move', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        deliberationId,
        targetType,
        targetId,
        kind: action.move.kind,
        payload,
        postAs: action.move.postAs,
        autoCompile: true,
        autoStep: true,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Move failed: ${response.statusText}`);
    }

    // Trigger UI refresh
    window.dispatchEvent(new CustomEvent('mesh:dialogue:refresh'));
  }
}