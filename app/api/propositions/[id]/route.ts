export const dynamic = "force-dynamic";

//app/api/propositions/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { getCurrentUserId } from '@/lib/serverutils';

const NO_STORE = { headers: { 'Cache-Control': 'no-store' } } as const;

export async function GET(_req: NextRequest, { params }: { params:{ id:string } }) {
  const id = params.id;
  const prop = await prisma.proposition.findUnique({ where: { id } });
  if (!prop) return NextResponse.json({ error: 'Not found' }, { status: 404, ...NO_STORE });

  const userId = await getCurrentUserId().catch(()=>null);
  let viewerVote = 0;
  let viewerEndorsed = false;
  if (userId) {
    const [v, e] = await Promise.all([
      prisma.propositionVote.findUnique({ where: { propositionId_userId: { propositionId: id, userId: String(userId) } } }),
      prisma.propositionEndorsement.findUnique({ where: { propositionId_userId: { propositionId: id, userId: String(userId) } } }),
    ]);
    viewerVote = v?.value ?? 0;
    viewerEndorsed = !!e;
  }

  return NextResponse.json({
    ok: true,
    proposition: {
      id: prop.id,
      deliberationId: prop.deliberationId,
      authorId: prop.authorId,
      text: prop.text,
      mediaType: prop.mediaType,
      mediaUrl: prop.mediaUrl,
      status: prop.status,
      promotedClaimId: prop.promotedClaimId,
      voteUpCount: prop.voteUpCount,
      voteDownCount: prop.voteDownCount,
      endorseCount: prop.endorseCount,
      replyCount: prop.replyCount,
      createdAt: prop.createdAt.toISOString(),
      viewerVote, viewerEndorsed,
    }
  }, NO_STORE);
}
