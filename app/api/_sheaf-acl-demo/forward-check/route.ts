export const dynamic = "force-dynamic";

import { NextRequest } from 'next/server';
import { ok, badRequest, readJSON, devOnlyGuard } from '../_util';
import { DB } from '../_store';
import type { AudienceSelector, MessageFacet } from '@app/sheaf-acl';
import { canForward, audienceSubsetOf } from '@app/sheaf-acl';

// Build env resolvers so audienceSubsetOf can resolve DYNAMIC memberships deterministically
const env = {
  resolveListMembers: (listId: string) => DB.lists.get(listId)?.memberIds ?? null,
  resolveRoleMembers: (role: string) =>
    Array.from(DB.users.values())
      .filter(u => u.roles.includes(role))
      .map(u => u.id),
};

// POST /api/_sheaf-acl-demo/forward-check
// Body: {
//   op: 'quote' | 'forward',
//   messageId: string,
//   facetId: string,
//   target: AudienceSelector,
//   quoteRange?: { start: number; end: number } // optional metadata for quotes
// }
export async function POST(req: NextRequest) {
  const blocked = devOnlyGuard();
  if (blocked) return blocked;

  type Body = {
    op: 'quote' | 'forward';
    messageId: string;
    facetId: string;
    target: AudienceSelector;
    quoteRange?: { start: number; end: number };
  };

  let body: Body;
  try {
    body = await readJSON<Body>(req);
  } catch {
    return badRequest('Invalid JSON');
  }

  const { op, messageId, facetId, target } = body;
  if (!op || !messageId || !facetId || !target) {
    return badRequest('Missing op/messageId/facetId/target');
  }

  const msg = DB.messages.get(messageId);
  if (!msg) return badRequest('Unknown messageId');
  const facet: MessageFacet | undefined = msg.facets.find(f => f.id === facetId);
  if (!facet) return badRequest('Unknown facetId');

  // Evaluate
  const subsetTri = audienceSubsetOf(target, facet.audience, env);
  const decision = canForward(facet, target, env); // 'ALLOW' | 'REDACT' | 'FORBID'

  // Build suggested outcomes for UI
  const result = {
    op,
    decision,
    subset: subsetTri, // 'yes' | 'no' | 'indeterminate'
    original: {
      messageId,
      facetId,
      sharePolicy: facet.sharePolicy,
    },
    target,
  };

  if (decision === 'ALLOW') {
    // Suggest a safe outgoing payload (caller will still add body/attachments as needed)
    return ok({
      ...result,
      suggestion: {
        mode: 'direct', // content can be included
        note: 'Target is subset of original audience; forwarding/quoting allowed.',
      },
    });
  }

  if (decision === 'REDACT') {
    // Provide a minimal redacted shell suggestion (server-side redaction)
    return ok({
      ...result,
      suggestion: {
        mode: 'redacted',
        redactedShell: {
          // The caller should post this as the outgoing message body.
          body: { type: 'text', text: '[[redacted]]' },
          meta: {
            fromMessageId: messageId,
            fromFacetId: facetId,
            reason:
              subsetTri === 'no'
                ? 'Target audience is not a subset of original.'
                : 'Subset could not be proven (dynamic audiences).',
          },
        },
      },
    });
  }

  // FORBID
  return ok({
    ...result,
    suggestion: {
      mode: 'blocked',
      note: 'Original facet sharePolicy=FORBID; cannot quote/forward.',
    },
  });
}
