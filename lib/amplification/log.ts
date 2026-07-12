import { prisma } from '@/lib/prismaclient';

export async function emitAmplificationEvent(args: {
  deliberationId: string;
  hostType?: 'article'|'post'|'room_thread'|'deliberation';
  hostId?: string;
  eventType: 'bridge_endorsement'|'viewpoint_selection'|string;
  reason?: string;
  payload?: any;
  createdById?: string|null;
}) {
  return prisma.amplificationEvent.create({
    data: {
      deliberationId: args.deliberationId,
      hostType: args.hostType as any ?? null,
      hostId: args.hostId ?? null,
      eventType: args.eventType,
      reason: args.reason ?? null,
      payload: args.payload ?? null,
      createdById: args.createdById ?? null,
    },
  });
}
