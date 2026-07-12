import { prisma } from '@/lib/prismaclient';

export async function writeDecisionReceipt(args: {
  roomId: string;
  actorId: string;
  action: string;
  reason?: string | null;
  targetType: 'article'|'post'|'room_thread'|'deliberation'|'argument'|'card'|'claim'|'brief'|'brief_version';
  targetId: string;
  panelId?: string | null;
  policyId?: string | null;
}) {
  return prisma.decisionReceipt.create({
    data: {
      roomId: args.roomId,
      actorId: args.actorId,
      action: args.action,
      reason: args.reason ?? null,
      targetType: args.targetType as any,
      targetId: args.targetId,
      panelId: args.panelId ?? null,
      policyId: args.policyId ?? null,
    },
  });
}

export async function writeLogbook(args: {
  roomId: string;
  entryType: 'STATUS_CHANGE'|'PANEL_OPEN'|'PANEL_CLOSE'|'PANEL_DECISION'|'POLICY_CHANGE'|'NOTE';
  summary: string;
  payload?: any;
}) {
  return prisma.roomLogbook.create({
    data: {
      roomId: args.roomId,
      entryType: args.entryType as any,
      summary: args.summary,
      payload: args.payload ?? null,
    },
  });
}
