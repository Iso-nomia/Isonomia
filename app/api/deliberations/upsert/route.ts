export const dynamic = "force-dynamic";

//api/deliberations/upsert/route.ts
import { prisma } from '@/lib/prismaclient';
import { asUserIdString } from '@/lib/auth/normalize';

async function getOrCreateDeliberationId(
  hostType: 'article'|'post'|'room_thread'|'library_stack'|'site'|'inbox_thread' | 'free' | 'discussion' | 'work',
  hostId: string,
  roomId: string | null,
  createdById: string
) {
  const existing = await prisma.deliberation.findFirst({
    where: { hostType, hostId },
    select: { id: true }
  });
  if (existing) return existing.id;
  const userIdStr = asUserIdString(createdById);

  const created = await prisma.deliberation.create({
    data: {
      hostType,
      hostId,
      roomId: roomId ?? undefined,
      createdById: userIdStr,
      // AgoraRoom has no representation rule column; default to utilitarian
      rule: 'utilitarian',
    },
    select: { id: true }
  });
  return created.id;
}
