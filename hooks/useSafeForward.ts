'use client';

import * as React from 'react';

export type AudienceSelector =
  | { kind: 'EVERYONE' }
  | { kind: 'ROLE'; role: string; mode: 'DYNAMIC' }
  | { kind: 'LIST'; listId: string; mode: 'SNAPSHOT' | 'DYNAMIC' }
  | { kind: 'USERS'; mode: 'SNAPSHOT' | 'DYNAMIC'; userIds?: string[]; snapshotMemberIds?: string[] };

type ForwardCheckResponse = {
  op: 'quote'|'forward';
  decision: 'ALLOW'|'REDACT'|'FORBID';
  subset: 'yes'|'no'|'indeterminate';
  suggestion?: any;
};

export function useSafeForward() {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function check(
    op: 'quote'|'forward',
    messageId: string | number,
    facetId: string | number,
    target: AudienceSelector
  ): Promise<ForwardCheckResponse> {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/sheaf/forward-check', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ op, messageId: String(messageId), facetId: String(facetId), target }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || 'forward-check failed');
      return json as ForwardCheckResponse;
    } catch (e: any) {
      setError(e.message ?? String(e));
      throw e;
    } finally {
      setLoading(false);
    }
  }

  // Given an original facet payload, and target audience, prepare the outgoing payload based on decision
  function prepareOutgoing(
    decision: ForwardCheckResponse['decision'],
    original: { body: any; attachments?: any[]; facetId: string; messageId: string },
    suggestion?: any
  ) {
    if (decision === 'ALLOW') {
      return {
        mode: 'direct',
        body: original.body,
        attachments: original.attachments ?? [],
        meta: { fromMessageId: original.messageId, fromFacetId: original.facetId },
      };
    }
    if (decision === 'REDACT') {
      return {
        mode: 'redacted',
        body: suggestion?.redactedShell?.body ?? { type: 'text', text: '[[redacted]]' },
        attachments: [],
        meta: suggestion?.redactedShell?.meta ?? { fromMessageId: original.messageId, fromFacetId: original.facetId },
      };
    }
    return { mode: 'blocked' as const };
  }

  return { loading, error, check, prepareOutgoing };
}
