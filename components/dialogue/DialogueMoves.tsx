'use client';
import * as React from 'react';
import { useLegalMoves } from './useLegalMoves';

type Kind = 'ASSERT'|'WHY'|'GROUNDS'|'RETRACT';

export default function DialogueMoves({
  deliberationId,
  targetType = 'argument',
  targetId,
  actorId,
  onMoved,
}: {
  deliberationId: string;
  targetType?: 'argument'|'claim';
  targetId: string;
  actorId?: string;                // pass current user id if you have it
  onMoved?: (kind: Kind, payload?: any) => void;
}) {
  async function post(kind: Kind, payload?: any) {
    const body = { deliberationId, targetType, targetId, kind, payload, actorId };
    const res = await fetch('/api/dialogue/move', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify(body),
    });
    onMoved?.(kind, payload);
    return res.ok;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {/* Challenge → WHY (starts a 24h clock via route-side default) */}
      <button className="px-2 py-1 btnv2--ghost  rounded text-xs" onClick={() => post('WHY')}>Challenge</button>
      {/* Defend → GROUNDS (supply brief rationale if you like) */}
      <button className="px-2 py-1 btnv2--ghost  rounded text-xs" onClick={() => post('GROUNDS', { brief: 'see evidence inline' })}>Defend</button>
      {/* Concede → represent as ASSERT with payload flag (no enum migration needed) */}
      <button className="px-2 py-1 btnv2--ghost  rounded text-xs" onClick={() => post('ASSERT', { as: 'CONCEDE' })}>Concede</button>
      {/* Retract → use existing kind */}
      <button className="px-2 py-1 btnv2--ghost  rounded text-xs" onClick={() => post('RETRACT')}>Retract</button>
    </div>
  );
}
