// lib/eval/aifInvariants.ts
import type { AttackType, TargetScope } from "@prisma/client";
import { assertAttackLegality } from "@/packages/aif-core/src/guards";
export type AifArgument = { id: string; conclusionClaimId: string; premises: { claimId: string }[]; };
export type AifAttack   = {
  id: string; attackType: AttackType; targetScope: TargetScope;
  toArgumentId?: string; targetClaimId?: string; targetPremiseId?: string; targetInferenceId?: string | null;
};
export type AifGraph = { claims: { id: string }[]; arguments: AifArgument[]; attacks: AifAttack[]; };

export function validateAifGraph(g: AifGraph) {
  const errors: string[] = [];
  const claimIds = new Set(g.claims.map(c => c.id));
  const argById  = new Map(g.arguments.map(a => [a.id, a]));

  for (const a of g.arguments) {
    if (!a.conclusionClaimId || !claimIds.has(a.conclusionClaimId))
      errors.push(`Argument ${a.id} has missing/unknown conclusionClaimId`);
    if (!a.premises?.length)
      errors.push(`Argument ${a.id} has no premises`);
    else for (const p of a.premises) {
      if (!claimIds.has(p.claimId)) errors.push(`Argument ${a.id} premise unknown claimId ${p.claimId}`);
      if (p.claimId === a.conclusionClaimId) errors.push(`Argument ${a.id} uses conclusion as premise`);
    }
  }

  for (const at of g.attacks) {
    try {
      assertAttackLegality({ deliberationId:"check", createdById:"check", fromArgumentId:"check", ...at } as any);
    } catch (e:any) { errors.push(`Attack ${at.id} illegal: ${e.message}`); }
    if (at.attackType === "UNDERMINES" && at.toArgumentId && at.targetPremiseId) {
      const target = argById.get(at.toArgumentId);
      const premIds = new Set(target?.premises.map(p => p.claimId) ?? []);
      if (!premIds.has(at.targetPremiseId))
        errors.push(`Attack ${at.id} undermines non-premise on target RA ${at.toArgumentId}`);
    }
  }
  return { ok: errors.length === 0, errors };
}
