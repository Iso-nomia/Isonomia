'use client';
import * as React from 'react';
import { useChatStore } from '@/contexts/useChatStore';
import { supabase } from '@/lib/supabaseclient';

const QUICK = ['👍', '❤️', '🎉', '😄', '🙏', '👀'];
const EMPTY: { emoji: string; count: number; mine: boolean }[] = []; // ✅ stable

export function ReactionBar(props: {
  conversationId: string;
  messageId: string;
  userId: string;
  activeFacetId?: string | null;
}) {
  const { conversationId, messageId, userId, activeFacetId } = props;

  // ✅ stable selector; never returns a new array during the same render
  const items = useChatStore(
    React.useCallback((s) => s.reactionsByMessageId[messageId] ?? EMPTY, [messageId])
  );

  const applyDelta = useChatStore((s) => s.applyReactionDelta);
  const mine = React.useMemo(() => new Set(items.filter(i => i.mine).map(i => i.emoji)), [items]);

  async function toggle(emoji: string) {
    const isMine = mine.has(emoji);
    // optimistic update
    applyDelta(messageId, emoji, isMine ? 'remove' : 'add', true);

    try {
      const res = await fetch('/api/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          messageId,
          facetId: activeFacetId ?? null,
          emoji,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Failed');

      // broadcast
      supabase.channel(`conversation-${conversationId}`).send({
        type: 'broadcast',
        event: `reaction_${data.action}`, // add|remove
        payload: { messageId, facetId: activeFacetId ?? null, emoji, userId },
      });
    } catch {
      // revert optimistic
      applyDelta(messageId, emoji, isMine ? 'add' : 'remove', true);
    }
  }

  return (
    <div className="mt-1 flex items-center gap-1">
      {QUICK.map((e) => {
        const selected = mine.has(e);
        return (
          <button
            key={e}
            type="button"
            onClick={() => toggle(e)}
            className={[
              'rounded-full border px-2 py-[2px] text-xs bg-white/70 hover:bg-white transition',
              selected ? 'ring-1 ring-indigo-400' : '',
            ].join(' ')}
            aria-pressed={selected}
            title={selected ? 'Remove reaction' : 'Add reaction'}
          >
            {e}
          </button>
        );
      })}
    </div>
  );
}
