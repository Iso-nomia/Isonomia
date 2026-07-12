export const dynamic = "force-dynamic";

import { NextRequest } from 'next/server';
import { prisma } from '../_prisma';
import { ok, badRequest, toBigInt } from '../_util';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const conversationId = searchParams.get('conversationId');
  if (!conversationId) return badRequest('Missing conversationId');

  const parts = await prisma.conversationParticipant.findMany({
    where: { conversation_id: toBigInt(conversationId) },
    include: { user: { select: { id: true, name: true, username: true } } }
  });

  const users = parts.map((p) => ({
    id: String(p.user.id),
    name: p.user.name || p.user.username || String(p.user.id),
  }));

  return ok({ users });
}
