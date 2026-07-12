export const dynamic = "force-dynamic";

import { NextRequest } from 'next/server';
import { prisma } from '../sheaf/_prisma';
import { readJSON, ok, badRequest, toBigInt, s } from '@/app/api/sheaf/_util';
import { toAclFacet, userCtxFrom } from '@/app/api/sheaf/_map';

import { visibleFacetsFor } from '@app/sheaf-acl';

/**
 * GET /api/reactions?userId=...&messageId=...     (single)
 * GET /api/reactions?userId=...&messageIds=a,b,c  (batch)
 * 
 * Returns: { items: Array<{ messageId: string, reactions: Array<{emoji:string, count:number, mine:boolean}> }> }
 * Facet-aware: only counts reactions whose facetId is null OR in viewer-visible facet set.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  if (!userId) return badRequest('Missing userId');

  const single = searchParams.get('messageId');
  const multi  = searchParams.get('messageIds');

  const messageIds: bigint[] = single
    ? [toBigInt(single)]
    : multi
    ? multi.split(',').map((x) => toBigInt(x.trim())).filter(Boolean)
    : [];

  if (messageIds.length === 0) return ok({ items: [] });

  // Load viewer + roles for ACL
  const [viewer, viewerRoles] = await Promise.all([
    prisma.user.findUnique({ where: { id: toBigInt(userId) } }),
    prisma.userRole.findMany({ where: { userId: toBigInt(userId) } }),
  ]);
  if (!viewer) return badRequest('Unknown userId');
  const rolesArr = viewerRoles.map((r) => r.role);

  // Preload all facets for messages, plus lists for ACL evaluation
  const facets = await prisma.sheafFacet.findMany({ where: { messageId: { in: messageIds } } });
  const listIds = Array.from(new Set(facets.map((f) => f.audienceListId).filter(Boolean))) as string[];
  const lists = new Map(
    (await prisma.sheafAudienceList.findMany({ where: { id: { in: listIds } } }))
      .map((l) => [l.id, l]),
  );

  const ctx = userCtxFrom(viewer, rolesArr, lists);

  // Group facets by message — and compute viewer-visible facetId set
  const visibleByMessage = new Map<string, Set<string>>();
  const grouped = new Map<string, typeof facets>();
  for (const f of facets) {
    const key = f.messageId.toString();
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(f);
  }
  for (const [mid, list] of grouped) {
    const fs = list.map(toAclFacet);
    const visible = visibleFacetsFor(ctx, fs as any);
    visibleByMessage.set(mid, new Set(visible.map((v: any) => String(v.id))));
  }

  // Fetch reactions for all messages and ACL-filter them
  const rows = await prisma.messageReaction.findMany({
    where: { messageId: { in: messageIds } },
    select: { messageId: true, facetId: true, emoji: true, userId: true },
  });

  const byMsg = new Map<string, Map<string, { count: number; mine: boolean }>>();
  for (const r of rows) {
    const mid = r.messageId.toString();
    const allow = (() => {
      if (r.facetId == null) return true;
      const vis = visibleByMessage.get(mid);
      return vis?.has(r.facetId.toString()) ?? false;
    })();
    if (!allow) continue;

    if (!byMsg.has(mid)) byMsg.set(mid, new Map());
    const slot = byMsg.get(mid)!;
    const k = r.emoji;
    const entry = slot.get(k) ?? { count: 0, mine: false };
    entry.count += 1;
    if (String(r.userId) === String(userId)) entry.mine = true;
    slot.set(k, entry);
  }

  const items = Array.from(byMsg.entries()).map(([mid, m]) => ({
    messageId: mid,
    reactions: Array.from(m.entries()).map(([emoji, v]) => ({ emoji, ...v })),
  }));
  return ok({ items });
}

/**
 * POST /api/reactions
 * { userId, messageId, facetId?, emoji } → toggle (add if missing, remove if exists)
 * Returns: { ok:true, action:'add'|'remove', reaction:{ messageId, facetId, emoji, userId } }
 */
export async function POST(req: NextRequest) {
  type Body = { userId: string|number; messageId: string|number; facetId?: string|number|null; emoji: string };
  const body = await readJSON<Body>(req).catch(() => null);
  if (!body) return badRequest('Invalid JSON');
  const { userId, messageId, facetId, emoji } = body;
  if (!userId || !messageId || !emoji) {
    return badRequest('Missing userId/messageId/emoji');
  }

  const mid = toBigInt(messageId);
  const uid = toBigInt(userId);
  const fid = facetId == null ? null : toBigInt(facetId);

  // Ensure message exists (and obtain conversation for broadcast if you later move broadcast server-side)
  const msg = await prisma.message.findUnique({ where: { id: mid }, select: { id: true, conversation_id: true } });
  if (!msg) return badRequest('Unknown messageId');

  // Toggle
  const existing = await prisma.messageReaction.findFirst({
    where: { messageId: mid, userId: uid, emoji, facetId: fid },
    select: { id: true },
  });

  let action: 'add' | 'remove';
  if (existing) {
    await prisma.messageReaction.delete({ where: { id: existing.id } });
    action = 'remove';
  } else {
    await prisma.messageReaction.create({
      data: { messageId: mid, userId: uid, emoji, facetId: fid },
    });
    action = 'add';
  }

  return ok({
    ok: true,
    action,
    reaction: { messageId: s(mid), facetId: fid ? s(fid) : null, emoji, userId: s(uid) },
  });
}

/**
 * DELETE /api/reactions { userId, messageId, facetId?, emoji }
 * Optional explicit remove (POST already toggles).
 */
export async function DELETE(req: NextRequest) {
  type Body = { userId: string|number; messageId: string|number; facetId?: string|number|null; emoji: string };
  const body = await readJSON<Body>(req).catch(() => null);
  if (!body) return badRequest('Invalid JSON');
  const { userId, messageId, facetId, emoji } = body;
  if (!userId || !messageId || !emoji) return badRequest('Missing fields');

  const mid = toBigInt(messageId);
  const uid = toBigInt(userId);
  const fid = facetId == null ? null : toBigInt(facetId);

  await prisma.messageReaction.deleteMany({ where: { messageId: mid, userId: uid, emoji, facetId: fid } });
  return ok({ ok: true });
}
