// packages/aif-core/src/guards.ts
import type { AttackType, TargetScope } from './types';

export type CreateArgumentPayload = {
  deliberationId: string;
  authorId: string;
  conclusionClaimId: string;
  premiseClaimIds: string[];
  schemeId?: string | null;
  implicitWarrant?: unknown;
  text?: string;
};

export type AttackPayload = {
  deliberationId: string;
  createdById: string;
  fromArgumentId: string;
  attackType: AttackType;
  targetScope: TargetScope;
  toArgumentId?: string;     // undercut
  targetClaimId?: string;    // rebut
  targetPremiseId?: string;  // undermine
  targetInferenceId?: string;// optional: inference id inside RA
  cqKey?: string | null;
};

export function assertCreateArgumentLegality(p: CreateArgumentPayload) {
  if (!p.deliberationId) throw new Error("deliberationId is required");
  if (!p.authorId) throw new Error("authorId is required");
  if (!p.conclusionClaimId) throw new Error("Argument needs a conclusionClaimId");
  if (!Array.isArray(p.premiseClaimIds) || p.premiseClaimIds.length < 1) {
    throw new Error("Argument needs ≥1 premiseClaimIds");
  }
  if (p.premiseClaimIds.includes(p.conclusionClaimId)) {
    throw new Error("A conclusion cannot also be a premise");
  }
}

export function assertAttackLegality(a: AttackPayload) {
  if (!a.deliberationId) throw new Error("deliberationId is required");
  if (!a.createdById) throw new Error("createdById is required");
  if (!a.fromArgumentId) throw new Error("fromArgumentId (attacking RA) is required");
  if (a.attackType === 'UNDERCUTS') {
    if (a.targetScope !== 'inference') throw new Error("Undercut must targetScope='inference'");
    if (!a.toArgumentId) throw new Error("Undercut requires toArgumentId");
  }
  if (a.attackType === 'REBUTS') {
    if (a.targetScope !== 'conclusion') throw new Error("Rebuttal must targetScope='conclusion'");
    if (!a.targetClaimId) throw new Error("Rebuttal requires targetClaimId");
  }
  if (a.attackType === 'UNDERMINES') {
    if (a.targetScope !== 'premise') throw new Error("Undermine must targetScope='premise'");
    if (!a.targetPremiseId) throw new Error("Undermine requires targetPremiseId");
  }
}
