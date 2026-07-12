import { prisma } from '@/lib/prismaclient';

export async function canEditWorkOrClaimOrphan(workId: string, userId: string) {
  const work = await prisma.theoryWork.findUnique({
    where: { id: workId },
    select: { id: true, authorId: true, deliberationId: true },
  });
  if (!work) return { ok: false as const, reason: 'not-found' };

  // If orphaned, claim it (first editor wins)
  if (!work.authorId) {
    await prisma.theoryWork.update({
      where: { id: work.id },
      data: { authorId: String(userId) },
    });
    return { ok: true as const };
  }

  // Author can always edit
  if (String(work.authorId) === String(userId)) return { ok: true as const };

  // Optional: deliberation owner/editor can edit (enable if you have these fields)
  // const delib = await prisma.deliberation.findUnique({
  //   where: { id: work.deliberationId },
  //   select: { ownerId: true, editors: { select: { userId: true } } },
  // });
  // if (delib) {
  //   if (String(delib.ownerId) === String(userId)) return { ok: true as const };
  //   if (delib.editors?.some(e => String(e.userId) === String(userId))) return { ok: true as const };
  // }

  return { ok: false as const, reason: 'forbidden' };
}
