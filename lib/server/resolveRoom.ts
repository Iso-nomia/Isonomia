import { prisma } from '@/lib/prismaclient';

/** Resolve roomId and deliberationId for a claim */
export async function resolveClaimContext(claimId: string) {
    // try direct
    const claim = await prisma.claim.findUnique({
      where: { id: claimId },
      select: { deliberationId: true },
    });
    if (claim?.deliberationId) {
      const room = await prisma.deliberation.findUnique({
        where: { id: claim.deliberationId },
        select: { id: true, roomId: true },
      });
      return { deliberationId: claim.deliberationId, roomId: room?.roomId ?? null };
    }
  
    // fallback: see if this claim is linked via a card
    const card = await prisma.deliberationCard.findFirst({
      where: { claimId },
      select: { deliberationId: true },
    });
    if (card) {
      const room = await prisma.deliberation.findUnique({
        where: { id: card.deliberationId },
        select: { id: true, roomId: true },
      });
      return { deliberationId: card.deliberationId, roomId: room?.roomId ?? null };
    }
  
    // fallback: edges
    const edge = await prisma.claimEdge.findFirst({
      where: { OR: [{ fromClaimId: claimId }, { toClaimId: claimId }] },
      select: { deliberationId: true },
    });
    if (edge?.deliberationId) {
      const room = await prisma.deliberation.findUnique({
        where: { id: edge.deliberationId },
        select: { id: true, roomId: true },
      });
      return { deliberationId: edge.deliberationId, roomId: room?.roomId ?? null };
    }
  
    return { deliberationId: null, roomId: null };
  }