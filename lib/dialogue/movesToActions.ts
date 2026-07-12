// lib/dialogue/movesToActions.ts
import type { CommandCardAction, TargetRef } from '@/components/dialogue/command-card/types';
import type { Move } from '@/types/dialogue';

/**
 * Convert legal moves from the dialogue API into CommandCard actions
 * for the 3×3 grid interface.
 */
export function movesToActions(
  moves: Move[],
  targetRef: TargetRef
): CommandCardAction[] {
  const actions: CommandCardAction[] = [];

  // Top row: WHY, GROUNDS, CLOSE
  const whyMoves = moves.filter(m => m.kind === 'WHY');
  whyMoves.forEach((why, i) => {
    actions.push({
      id: `why-${i}`,
      kind: 'WHY',
      label: why.label || 'WHY',
      force: (why.force || 'ATTACK') as any,
      disabled: why.disabled,
      reason: why.reason,
      relevance: why.relevance,
      group: 'top',
      move: {
        kind: 'WHY',
        payload: why.payload
      },
      target: targetRef
    });
  });

  const groundsMoves = moves.filter(m => m.kind === 'GROUNDS');
  groundsMoves.forEach((g, i) => {
    actions.push({
      id: `grounds-${i}`,
      kind: 'GROUNDS',
      label: g.label || 'GROUNDS',
      force: (g.force || 'ATTACK') as any,
      disabled: g.disabled,
      reason: g.reason,
      relevance: g.relevance,
      group: 'top',
      move: {
        kind: 'GROUNDS',
        payload: g.payload
      },
      target: targetRef
    });
  });

  const close = moves.find(m => m.kind === 'CLOSE');
  if (close) {
    actions.push({
      id: 'close',
      kind: 'CLOSE',
      label: close.label || 'Close (†)',
      force: (close.force || 'SURRENDER') as any,
      disabled: close.disabled,
      reason: close.reason,
      relevance: close.relevance,
      group: 'top',
      tone: 'primary',
      move: {
        kind: 'CLOSE',
        payload: close.payload
      },
      target: targetRef
    });
  }

  // Mid row: CONCEDE, RETRACT, ACCEPT_ARGUMENT
  const concede = moves.find(m => m.kind === 'CONCEDE');
  if (concede) {
    actions.push({
      id: 'concede',
      kind: 'CONCEDE',
      label: concede.label || 'Concede',
      force: (concede.force || 'SURRENDER') as any,
      disabled: concede.disabled,
      reason: concede.reason,
      relevance: concede.relevance,
      group: 'mid',
      move: {
        kind: 'CONCEDE',
        payload: concede.payload
      },
      target: targetRef
    });
  }

  const retract = moves.find(m => m.kind === 'RETRACT');
  if (retract) {
    actions.push({
      id: 'retract',
      kind: 'RETRACT',
      label: retract.label || 'Retract',
      force: (retract.force || 'SURRENDER') as any,
      disabled: retract.disabled,
      reason: retract.reason,
      relevance: retract.relevance,
      group: 'mid',
      move: {
        kind: 'RETRACT',
        payload: retract.payload
      },
      target: targetRef
    });
  }

  // Accept argument (R7 - accept argument as-is)
  const acceptArg = moves.find(m => m.label?.toLowerCase().includes('accept argument'));
  if (acceptArg) {
    actions.push({
      id: 'accept-argument',
      kind: 'ACCEPT_ARGUMENT',
      label: 'Accept Arg',
      force: (acceptArg.force || 'SURRENDER') as any,
      disabled: acceptArg.disabled,
      reason: acceptArg.reason,
      relevance: acceptArg.relevance,
      group: 'mid',
      tone: 'primary',
      move: {
        kind: acceptArg.kind as any,
        payload: acceptArg.payload,
        postAs: acceptArg.postAs as any
      },
      target: targetRef
    });
  }

  // Bottom row: Structural moves (THEREFORE, SUPPOSE, DISCHARGE)
  const therefore = moves.find(m => m.kind === 'THEREFORE');
  if (therefore) {
    actions.push({
      id: 'therefore',
      kind: 'THEREFORE' as any,
      label: therefore.label || 'Therefore…',
      force: 'NEUTRAL',
      disabled: therefore.disabled,
      reason: therefore.reason,
      relevance: therefore.relevance,
      group: 'bottom',
      move: {
        kind: 'THEREFORE' as any,
        payload: therefore.payload
      },
      target: targetRef
    });
  }

  const suppose = moves.find(m => m.kind === 'SUPPOSE');
  if (suppose) {
    actions.push({
      id: 'suppose',
      kind: 'SUPPOSE' as any,
      label: suppose.label || 'Suppose…',
      force: 'NEUTRAL',
      disabled: suppose.disabled,
      reason: suppose.reason,
      relevance: suppose.relevance,
      group: 'bottom',
      move: {
        kind: 'SUPPOSE' as any,
        payload: suppose.payload
      },
      target: targetRef
    });
  }

  const discharge = moves.find(m => m.kind === 'DISCHARGE');
  if (discharge) {
    actions.push({
      id: 'discharge',
      kind: 'DISCHARGE' as any,
      label: discharge.label || 'Discharge',
      force: 'NEUTRAL',
      disabled: discharge.disabled,
      reason: discharge.reason,
      relevance: discharge.relevance,
      group: 'bottom',
      move: {
        kind: 'DISCHARGE' as any,
        payload: discharge.payload
      },
      target: targetRef
    });
  }

  return actions;
}
