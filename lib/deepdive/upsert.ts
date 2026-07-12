// lib/deepdive/upsert.ts
import { prisma } from "../prismaclient";

export async function getOrCreateDeliberationId(
  hostType: 'article'|'post'|'room_thread'|'library_stack'|'site'|'inbox_thread'|'discussion'|'free'|'work',
  hostId: string,
  roomId: string | null,
  createdById: string
) {
    const creatorId = String(createdById);
  const existing = await prisma.deliberation.findFirst({
    where: { hostType, hostId },
    select: { id: true }
  });
  if (existing) return existing.id;

  const created = await prisma.deliberation.create({
    data: {
      hostType,
      hostId,
            roomId: roomId ?? undefined,
            createdById: creatorId,
      // default rule (utilitarian); AgoraRoom does not carry a representation rule
      rule: "utilitarian",
    },
    select: { id: true }
  });
  return created.id;
}
