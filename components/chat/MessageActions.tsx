'use client';
import * as React from 'react';
import { useSafeForward } from '@/hooks/useSafeForward';
import type { AudienceSelector } from '@app/sheaf-acl';
import { toast } from 'sonner';

export function MessageActions({
  messageId,
  facetId,
  currentFacet, // { body, attachments }
  onForwardDone,
}: {
  messageId: string;
  facetId: string;
  currentFacet: { body: any; attachments?: any[] };
  onForwardDone?: () => void;
}) {
  const { check, prepareOutgoing, loading } = useSafeForward();

  async function onForwardClick(target: AudienceSelector) {
    try {
      const decision = await check('forward', messageId, facetId, target);
      if (decision.decision === 'FORBID') {
        toast.error('Forwarding is forbidden for this facet');
        return;
      }

      const outgoing = prepareOutgoing(
        decision.decision,
        { body: currentFacet.body, attachments: currentFacet.attachments, facetId, messageId },
        decision.suggestion
      );
      if (outgoing.mode === 'blocked') return;

      // Post to your normal send endpoint (or a dedicated forward endpoint)
      await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          // choose a conversation or target audience for the forward
          targetAudience: target,
          payload: outgoing,
        }),
      });

      onForwardDone?.();
      toast.success(decision.decision === 'REDACT' ? 'Forwarded (redacted).' : 'Forwarded.');
    } catch (e: any) {
      toast.error(e.message ?? 'Forward failed');
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={loading}
        onClick={() => onForwardClick({ kind: 'EVERYONE' })}
        className="text-xs rounded px-2 py-1 bg-white/70"
        title="Forward to Everyone"
      >
        ↗ Forward
      </button>
      {/* You can add a small menu here to pick ROLE/LIST/USERS as target */}
    </div>
  );
}
