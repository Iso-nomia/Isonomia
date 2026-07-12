'use client';
import React from 'react';
import { scoreWinningness, type Move } from '@/lib/dialogue/winningness';

export function WinningnessBadge({ moves, targetId }: { moves: Move[]; targetId: string }) {
  const w = scoreWinningness(moves, targetId);
  const style =
    w.status === 'won' ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
    : w.status === 'contested' ? 'bg-amber-50 border-amber-300 text-amber-800'
    : 'bg-neutral-50 border-neutral-300 text-neutral-700';

  return (
    <span className={`px-1.5 py-0.5 rounded border text-[10px]`} title={`answered ${w.answeredAttacks} · open ${w.unansweredAttacks}`}>
      <span className={style + ' px-1.5 py-0.5 rounded border'}>{w.status}</span>
    </span>
  );
}
