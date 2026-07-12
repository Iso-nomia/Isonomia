// lib/deepdive/claimEdgeHelpers.ts
import { prisma } from '@/lib/prismaclient';
import { ClaimAttackType, ClaimEdgeType } from '@prisma/client';

// singular → enum (plural)
function normalizeType(t?: string | null): ClaimEdgeType {
  const v = (t || '').toLowerCase();
  return v === 'rebut' || v === 'rebuts' ? ClaimEdgeType.rebuts : ClaimEdgeType.supports;
}

/** derive rich attack kind from type+scope if ArgumentEdge has no attackType col */
function deriveAttackEnum(type?: string | null, scope?: string | null): ClaimAttackType {
  const s = (scope || '').toLowerCase();
  if (s === 'inference') return ClaimAttackType.UNDERCUTS;
  if (s === 'premise')   return ClaimAttackType.UNDERMINES;
  return normalizeType(type) === ClaimEdgeType.rebuts ? ClaimAttackType.REBUTS : ClaimAttackType.SUPPORTS;
}

function scopeFrom(attack: ClaimAttackType, t: ClaimEdgeType): 'premise'|'inference'|'conclusion'|null {
  if (attack === ClaimAttackType.UNDERCUTS)  return 'inference';
  if (attack === ClaimAttackType.UNDERMINES) return 'premise';
  if (attack === ClaimAttackType.REBUTS || t === ClaimEdgeType.rebuts) return 'conclusion';
  return null;
}

export async function maybeUpsertClaimEdgeFromArgumentEdge(edgeId: string) {
    const e = await prisma.argumentEdge.findUnique({
      where: { id: edgeId },
      select: {
        id: true,
        type: true,
        targetScope: true,
        fromArgumentId: true,
        toArgumentId: true,
        deliberationId: true,
      },
    });
    if (!e) return;
  
    const [fromArg, toArg] = await Promise.all([
      prisma.argument.findUnique({
        where: { id: e.fromArgumentId },
        select: { claimId: true, deliberationId: true },
      }),
      prisma.argument.findUnique({
        where: { id: e.toArgumentId },
        select: { claimId: true },
      }),
    ]);
  
    if (!fromArg?.claimId || !toArg?.claimId) return;
  
    // normalize type/attackType
    const typeEnum = normalizeType(e.type);
    const attackEnum = deriveAttackEnum(e.type, e.targetScope);
    const scope = e.targetScope ?? scopeFrom(attackEnum, typeEnum);
  
    await prisma.claimEdge.upsert({
      where: {
        unique_from_to_type_attack: {
          fromClaimId: fromArg.claimId,
          toClaimId:   toArg.claimId,
          type: typeEnum,
          attackType: attackEnum,
        },
      },
      update: { targetScope: scope ?? undefined },
      create: {
        deliberationId: fromArg.deliberationId!,
        fromClaimId: fromArg.claimId,
        toClaimId:   toArg.claimId,
        type: typeEnum,
        attackType: attackEnum,
        targetScope: scope ?? undefined,
      },
    });
  }
  