import { NextRequest } from 'next/server';
import { prisma } from '../_prisma';
import { ok, badRequest } from '../_util';
import { userCtxFrom } from '../_map';
import {
  visibleFacetsFor,
  defaultFacetFor,
  priorityRank,
  type AudienceSelector,
  type MessageFacet,
} from '@app/sheaf-acl';
import type { SheafAudienceList } from '@prisma/client';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  type FacetIn = {
    audience: AudienceSelector;
    sharePolicy?: 'ALLOW' | 'REDACT' | 'FORBID';
    expiresAt?: number | null;
    body: any;
    attachments?: any[];
  };
  type Body = {
    viewer: { everyone?: true; role?: string; userId?: string | number; roles?: string[] };
    facets: FacetIn[];
  };

  let body: Body;
  try { body = await req.json(); } catch { return badRequest('Invalid JSON'); }

  const { viewer, facets } = body;
  if (!viewer || !Array.isArray(facets)) return badRequest('Missing viewer/facets');

  // Preload lists referenced by facets
  const listIds = Array.from(new Set(
    facets.map(f => f.audience?.kind === 'LIST' ? f.audience.listId : null).filter(Boolean)
  )) as string[];

  const listRows = await prisma.sheafAudienceList.findMany({
    where: { id: { in: listIds } },
    select: { id: true, memberIds: true },  // only what we need
  });



// ✅ typed map
const lists = new Map<string, Pick<SheafAudienceList, 'id' | 'memberIds'>>();
for (const l of listRows) {
  lists.set(l.id, { id: l.id, memberIds: l.memberIds });
}

  // Viewer context
  let dbUser = null, roles: string[] = [];
  if (viewer.userId != null) {
    dbUser = await prisma.user.findUnique({ where: { id: BigInt(viewer.userId) } });
    roles = viewer.roles ?? [];
  } else if (viewer.role) {
    roles = [viewer.role];
  }
  const ctx = userCtxFrom(dbUser, roles, lists);

  // Build ACL facets directly from draft
  const aclFacets: MessageFacet[] = facets.map((f, i) => ({
    id: `draft_${i}`,
    messageId: 'draft',
    audience: f.audience,
    sharePolicy: f.sharePolicy ?? 'ALLOW',
    expiresAt: f.expiresAt ?? undefined,
    body: f.body,
    attachments: f.attachments ?? [],
    createdAt: Date.now(),
    priorityRank: priorityRank(f.audience),
  }));

  const visible = visibleFacetsFor(ctx, aclFacets);
  if (visible.length === 0) return ok({ visible: [], defaultFacetId: null });

  const def = defaultFacetFor(ctx, aclFacets);
  return ok({ visible: visible.map(f => f.id), defaultFacetId: def?.id ?? visible[0].id });
}
