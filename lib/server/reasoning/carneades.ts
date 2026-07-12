// lib/server/reasoning/carneades.ts
import { prisma } from '@/lib/prismaclient';

export type Label = 'IN'|'OUT'|'UNDEC';
export async function labelArgument(argumentId: string): Promise<{ label: Label; why: string[] }> {
  const why: string[] = [];

  const [cqs, ca] = await Promise.all([
    prisma.cQStatus.findMany({ where: { targetType: 'argument', targetId: argumentId } }),
    prisma.conflictApplication.findMany({ where: { OR: [{ conflictedArgumentId: argumentId }, { conflictingArgumentId: argumentId }] } }),
  ]);

  const open = cqs.filter(s => s.status === 'open');
  if (open.length) { why.push('open_cq'); return { label: 'UNDEC', why }; }

  const hasUndercut = ca.some(e => (e.legacyAttackType || '').toUpperCase() === 'UNDERCUTS');
  if (hasUndercut) { why.push('undercut_present'); return { label: 'OUT', why }; }

  return { label: 'IN', why };
}
