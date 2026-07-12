export const dynamic = "force-dynamic";

import { NextRequest } from 'next/server';
import { prisma } from '../_prisma';
import { readJSON, ok, badRequest, toBigInt } from '../_util';
import { buildAudienceEnv, toAudienceSelector } from '../_map';
import { audienceSubsetOf, canForward } from '@app/sheaf-acl';

// POST /api/sheaf/forward-check
// Body: { op: 'quote'|'forward', messageId: string|number, facetId: string|number, target: AudienceSelector }
export async function POST(req: NextRequest) {
  type Body = {
    op: 'quote' | 'forward';
    messageId: string | number;
    facetId: string | number;
    target: any; // AudienceSelector shape
  };

  let body: Body;
  try { body = await readJSON<Body>(req); }
  catch { return badRequest('Invalid JSON'); }

  const { op, messageId, facetId, target } = body;
  if (!op || !messageId || !facetId || !target) return badRequest('Missing fields');

  const facet = await prisma.sheafFacet.findUnique({ where: { id: toBigInt(facetId) } });
  if (!facet || facet.messageId !== toBigInt(messageId)) return badRequest('Unknown facet/message pair');

  // Build env: load lists referenced by the target or the original facet (for subset materialization)
  const listIds = [
    facet.audienceListId,
    target?.kind === 'LIST' ? target.listId : null,
  ].filter(Boolean) as string[];

  const lists = new Map(
    (await prisma.sheafAudienceList.findMany({ where: { id: { in: listIds } } }))
      .map(l => [l.id, l])
  );

  const rolesInPlay = new Set<string>();
  if (facet.audienceKind === 'ROLE' && facet.audienceRole) rolesInPlay.add(facet.audienceRole);
  if (target?.kind === 'ROLE' && target.role) rolesInPlay.add(target.role);
  const roleMembersRows = await prisma.userRole.findMany({ where: { role: { in: [...rolesInPlay] } } });
  const roleMembers = new Map<string, string[]>();
  for (const r of roleMembersRows) {
    const arr = roleMembers.get(r.role) ?? [];
    arr.push(r.userId.toString());
    roleMembers.set(r.role, arr);
  }
  const env = buildAudienceEnv(lists, roleMembers);
  
  const originalAudience = toAudienceSelector(facet);
  const subsetTri = audienceSubsetOf(target, originalAudience, env);
  const decision = canForward(
    { id: facet.id.toString(), messageId: facet.messageId.toString(), audience: originalAudience, sharePolicy: facet.sharePolicy, body: {}, attachments: [], createdAt: facet.createdAt?.getTime(), priorityRank: facet.priorityRank },
    target,
    env
  );

  if (decision === 'ALLOW') {
    return ok({
      op, decision, subset: subsetTri,
      suggestion: { mode: 'direct', note: 'Subset proven (or original EVERYONE). Include content.' },
    });
  }
  if (decision === 'REDACT') {
    return ok({
      op, decision, subset: subsetTri,
      suggestion: {
        mode: 'redacted',
        redactedShell: {
          body: { type: 'text', text: '[[redacted]]' },
          meta: { fromMessageId: messageId.toString(), fromFacetId: facetId.toString() }
        }
      }
    });
  }
  return ok({ op, decision, subset: subsetTri, suggestion: { mode: 'blocked', note: 'sharePolicy=FORBID' } });
}
