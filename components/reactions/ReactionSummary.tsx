'use client';
import * as React from 'react';
import { useChatStore } from '@/contexts/useChatStore';

type ReactionAgg = { emoji: string; count: number; mine: boolean };

// ✅ stable fallback so selector doesn't create a new array each render
const EMPTY: ReactionAgg[] = [];

export function ReactionSummary({ messageId }: { messageId: string }) {
  // ✅ memo the selector + return a stable reference when empty
  const items = useChatStore(
    React.useCallback((s) => s.reactionsByMessageId[messageId] ?? EMPTY, [messageId])
  );

  if (!items.length) return null;

  return (
    <div className="mt-0 p-1 grid gap-1">
      {items.map((r) => (
        <span
          key={r.emoji}
          className={[
            'flex inline-flex p-1 items-center gap-1 rounded-full   text-xs bg-white/70',
            r.mine ? 'ring-0 ring-indigo-400' : '',
          ].join(' ')}
          title={r.mine ? 'You reacted' : undefined}
        >
          <span>{r.emoji}</span>
          <span className="tabular-nums">{r.count}</span>
        </span>
      ))}
    </div>
  );
}
