/**
 * Phase 3.1: Challenge Service
 * Manages attacks (challenges) and defenses for claims
 */

import { prisma } from "@/lib/prismaclient";
import {
  AttackSummary,
  DefenseSummary,
  ChallengeReport,
  CreateAttackOptions,
  CreateDefenseOptions,
  UpdateAttackStatusOptions,
  UpdateDefenseOutcomeOptions,
  AttackType,
  ClaimAttackStatus,
  ClaimDefenseType,
  ClaimDefenseOutcome,
  ConsensusStatus,
  AttackFilters,
  DefenseFilters,
} from "./types";
import { updateClaimConsensusStatus } from "./provenanceService";

// ─────────────────────────────────────────────────────────
// Attack (Challenge) Management
// ─────────────────────────────────────────────────────────

/**
 * Create an attack (challenge) against a claim
 */
export async function createAttack(
  options: CreateAttackOptions,
  userId: string
): Promise<AttackSummary> {
  const { targetClaimId, attackingArgumentId, attackType, attackSubtype } = options;

  // Verify the target claim exists
  const claim = await prisma.claim.findUnique({
    where: { id: targetClaimId },
  });

  if (!claim) {
    throw new Error("Target claim not found");
  }

  // Verify the attacking argument exists
  const argument = await prisma.argument.findUnique({
    where: { id: attackingArgumentId },
    select: { id: true, text: true, authorId: true },
  });

  if (!argument) {
    throw new Error("Attacking argument not found");
  }

  // Create the attack
  const attack = await prisma.claimAttack.create({
    data: {
      targetClaimId,
      attackingArgumentId,
      attackType,
      attackSubtype,
      status: "OPEN",
      createdById: userId,
    },
    include: {
      attackingArgument: {
        select: { id: true, text: true, authorId: true },
      },
      _count: {
        select: { defenses: true },
      },
    },
  });

  // Update consensus status
  await updateClaimConsensusStatus(targetClaimId);

  // Get author name
  const user = await prisma.user.findUnique({
    where: { auth_id: argument.authorId },
    select: { name: true },
  });

  return {
    id: attack.id,
    attackType: attack.attackType as AttackType,
    attackSubtype: attack.attackSubtype || undefined,
    status: attack.status as ClaimAttackStatus,
    argument: {
      id: attack.attackingArgument.id,
      text: attack.attackingArgument.text,
      authorId: attack.attackingArgument.authorId,
      authorName: user?.name || undefined,
    },
    defenseCount: attack._count.defenses,
    createdAt: attack.createdAt,
    createdById: attack.createdById,
  };
}

/**
 * Get an attack by ID
 */
export async function getAttack(attackId: string): Promise<AttackSummary | null> {
  const attack = await prisma.claimAttack.findUnique({
    where: { id: attackId },
    include: {
      attackingArgument: {
        select: { id: true, text: true, authorId: true },
      },
      _count: {
        select: { defenses: true },
      },
    },
  });

  if (!attack) return null;

  // Get author name
  const user = await prisma.user.findUnique({
    where: { auth_id: attack.attackingArgument.authorId },
    select: { name: true },
  });

  return {
    id: attack.id,
    attackType: attack.attackType as AttackType,
    attackSubtype: attack.attackSubtype || undefined,
    status: attack.status as ClaimAttackStatus,
    argument: {
      id: attack.attackingArgument.id,
      text: attack.attackingArgument.text,
      authorId: attack.attackingArgument.authorId,
      authorName: user?.name || undefined,
    },
    defenseCount: attack._count.defenses,
    createdAt: attack.createdAt,
    createdById: attack.createdById,
  };
}

/**
 * Get all attacks against a claim
 */
export async function getAttacksForClaim(
  claimId: string,
  filters?: AttackFilters
): Promise<AttackSummary[]> {
  const whereClause: Record<string, unknown> = {
    targetClaimId: claimId,
  };

  if (filters?.status) {
    whereClause.status = Array.isArray(filters.status)
      ? { in: filters.status }
      : filters.status;
  }

  if (filters?.attackType) {
    whereClause.attackType = Array.isArray(filters.attackType)
      ? { in: filters.attackType }
      : filters.attackType;
  }

  if (filters?.createdById) {
    whereClause.createdById = filters.createdById;
  }

  const attacks = await prisma.claimAttack.findMany({
    where: whereClause,
    include: {
      attackingArgument: {
        select: { id: true, text: true, authorId: true },
      },
      _count: {
        select: { defenses: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Get all author IDs for name lookup
  const authorIds = [...new Set(attacks.map((a) => a.attackingArgument.authorId))];
  const users = await prisma.user.findMany({
    where: { auth_id: { in: authorIds } },
    select: { auth_id: true, name: true },
  });
  const nameMap = new Map(users.map((u) => [u.auth_id, u.name || "Unknown"]));

  return attacks.map((attack) => ({
    id: attack.id,
    attackType: attack.attackType as AttackType,
    attackSubtype: attack.attackSubtype || undefined,
    status: attack.status as ClaimAttackStatus,
    argument: {
      id: attack.attackingArgument.id,
      text: attack.attackingArgument.text,
      authorId: attack.attackingArgument.authorId,
      authorName: nameMap.get(attack.attackingArgument.authorId),
    },
    defenseCount: attack._count.defenses,
    createdAt: attack.createdAt,
    createdById: attack.createdById,
  }));
}

/**
 * Update attack status
 */
export async function updateAttackStatus(
  options: UpdateAttackStatusOptions,
  userId: string
): Promise<AttackSummary> {
  const { attackId, status, resolutionNote } = options;

  const attack = await prisma.claimAttack.findUnique({
    where: { id: attackId },
  });

  if (!attack) {
    throw new Error("Attack not found");
  }

  const isResolved = ["DEFENDED", "CONCEDED", "WITHDRAWN", "STALEMATE"].includes(status);

  const updated = await prisma.claimAttack.update({
    where: { id: attackId },
    data: {
      status,
      resolutionNote,
      resolvedAt: isResolved ? new Date() : null,
      resolvedById: isResolved ? userId : null,
    },
    include: {
      attackingArgument: {
        select: { id: true, text: true, authorId: true },
      },
      _count: {
        select: { defenses: true },
      },
    },
  });

  // Update consensus status
  await updateClaimConsensusStatus(attack.targetClaimId);

  return {
    id: updated.id,
    attackType: updated.attackType as AttackType,
    attackSubtype: updated.attackSubtype || undefined,
    status: updated.status as ClaimAttackStatus,
    argument: {
      id: updated.attackingArgument.id,
      text: updated.attackingArgument.text,
      authorId: updated.attackingArgument.authorId,
    },
    defenseCount: updated._count.defenses,
    createdAt: updated.createdAt,
    createdById: updated.createdById,
  };
}

/**
 * Delete an attack (only by creator or admin)
 */
export async function deleteAttack(attackId: string, userId: string): Promise<void> {
  const attack = await prisma.claimAttack.findUnique({
    where: { id: attackId },
  });

  if (!attack) {
    throw new Error("Attack not found");
  }

  if (attack.createdById !== userId) {
    throw new Error("Only the creator can delete this attack");
  }

  await prisma.claimAttack.delete({
    where: { id: attackId },
  });

  // Update consensus status
  await updateClaimConsensusStatus(attack.targetClaimId);
}

// ─────────────────────────────────────────────────────────
// Defense Management
// ─────────────────────────────────────────────────────────

/**
 * Create a defense against an attack
 */
export async function createDefense(
  options: CreateDefenseOptions,
  userId: string
): Promise<DefenseSummary> {
  const { claimId, attackId, defendingArgumentId, defenseType } = options;

  // Verify the attack exists and targets the specified claim
  const attack = await prisma.claimAttack.findUnique({
    where: { id: attackId },
  });

  if (!attack) {
    throw new Error("Attack not found");
  }

  if (attack.targetClaimId !== claimId) {
    throw new Error("Attack does not target the specified claim");
  }

  // Verify the defending argument exists
  const argument = await prisma.argument.findUnique({
    where: { id: defendingArgumentId },
    select: { id: true, text: true, authorId: true },
  });

  if (!argument) {
    throw new Error("Defending argument not found");
  }

  // Create the defense
  const defense = await prisma.claimDefense.create({
    data: {
      claimId,
      attackId,
      defendingArgumentId,
      defenseType,
      outcome: "PENDING",
      createdById: userId,
    },
    include: {
      defendingArgument: {
        select: { id: true, text: true, authorId: true },
      },
    },
  });

  // Get author name
  const user = await prisma.user.findUnique({
    where: { auth_id: argument.authorId },
    select: { name: true },
  });

  return {
    id: defense.id,
    attackId: defense.attackId,
    defenseType: defense.defenseType as ClaimDefenseType,
    outcome: defense.outcome as ClaimDefenseOutcome | undefined,
    outcomeNote: defense.outcomeNote || undefined,
    argument: {
      id: defense.defendingArgument.id,
      text: defense.defendingArgument.text,
      authorId: defense.defendingArgument.authorId,
      authorName: user?.name || undefined,
    },
    createdAt: defense.createdAt,
    createdById: defense.createdById,
  };
}

/**
 * Get defenses for an attack
 */
export async function getDefensesForAttack(attackId: string): Promise<DefenseSummary[]> {
  const defenses = await prisma.claimDefense.findMany({
    where: { attackId },
    include: {
      defendingArgument: {
        select: { id: true, text: true, authorId: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Get all author IDs for name lookup
  const authorIds = [...new Set(defenses.map((d) => d.defendingArgument.authorId))];
  const users = await prisma.user.findMany({
    where: { auth_id: { in: authorIds } },
    select: { auth_id: true, name: true },
  });
  const nameMap = new Map(users.map((u) => [u.auth_id, u.name || "Unknown"]));

  return defenses.map((defense) => ({
    id: defense.id,
    attackId: defense.attackId,
    defenseType: defense.defenseType as ClaimDefenseType,
    outcome: defense.outcome as ClaimDefenseOutcome | undefined,
    outcomeNote: defense.outcomeNote || undefined,
    argument: {
      id: defense.defendingArgument.id,
      text: defense.defendingArgument.text,
      authorId: defense.defendingArgument.authorId,
      authorName: nameMap.get(defense.defendingArgument.authorId),
    },
    createdAt: defense.createdAt,
    createdById: defense.createdById,
  }));
}

/**
 * Get all defenses for a claim
 */
export async function getDefensesForClaim(
  claimId: string,
  filters?: DefenseFilters
): Promise<DefenseSummary[]> {
  const whereClause: Record<string, unknown> = {
    claimId,
  };

  if (filters?.attackId) {
    whereClause.attackId = filters.attackId;
  }

  if (filters?.outcome) {
    whereClause.outcome = Array.isArray(filters.outcome)
      ? { in: filters.outcome }
      : filters.outcome;
  }

  if (filters?.createdById) {
    whereClause.createdById = filters.createdById;
  }

  const defenses = await prisma.claimDefense.findMany({
    where: whereClause,
    include: {
      defendingArgument: {
        select: { id: true, text: true, authorId: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Get all author IDs for name lookup
  const authorIds = [...new Set(defenses.map((d) => d.defendingArgument.authorId))];
  const users = await prisma.user.findMany({
    where: { auth_id: { in: authorIds } },
    select: { auth_id: true, name: true },
  });
  const nameMap = new Map(users.map((u) => [u.auth_id, u.name || "Unknown"]));

  return defenses.map((defense) => ({
    id: defense.id,
    attackId: defense.attackId,
    defenseType: defense.defenseType as ClaimDefenseType,
    outcome: defense.outcome as ClaimDefenseOutcome | undefined,
    outcomeNote: defense.outcomeNote || undefined,
    argument: {
      id: defense.defendingArgument.id,
      text: defense.defendingArgument.text,
      authorId: defense.defendingArgument.authorId,
      authorName: nameMap.get(defense.defendingArgument.authorId),
    },
    createdAt: defense.createdAt,
    createdById: defense.createdById,
  }));
}

/**
 * Update defense outcome
 */
export async function updateDefenseOutcome(
  options: UpdateDefenseOutcomeOptions,
  userId: string
): Promise<DefenseSummary> {
  const { defenseId, outcome, outcomeNote } = options;

  const defense = await prisma.claimDefense.findUnique({
    where: { id: defenseId },
    include: { attack: true },
  });

  if (!defense) {
    throw new Error("Defense not found");
  }

  const updated = await prisma.claimDefense.update({
    where: { id: defenseId },
    data: {
      outcome,
      outcomeNote,
    },
    include: {
      defendingArgument: {
        select: { id: true, text: true, authorId: true },
      },
    },
  });

  // If defense is successful, consider updating attack status
  if (outcome === "SUCCESSFUL") {
    // Check if all defenses are successful
    const allDefenses = await prisma.claimDefense.findMany({
      where: { attackId: defense.attackId },
      select: { outcome: true },
    });

    const allSuccessful = allDefenses.every((d) => d.outcome === "SUCCESSFUL");

    if (allSuccessful) {
      await updateAttackStatus(
        {
          attackId: defense.attackId,
          status: "DEFENDED",
          resolutionNote: "All defenses successful",
        },
        userId
      );
    }
  }

  return {
    id: updated.id,
    attackId: updated.attackId,
    defenseType: updated.defenseType as ClaimDefenseType,
    outcome: updated.outcome as ClaimDefenseOutcome | undefined,
    outcomeNote: updated.outcomeNote || undefined,
    argument: {
      id: updated.defendingArgument.id,
      text: updated.defendingArgument.text,
      authorId: updated.defendingArgument.authorId,
    },
    createdAt: updated.createdAt,
    createdById: updated.createdById,
  };
}

// ─────────────────────────────────────────────────────────
// Challenge Report
// ─────────────────────────────────────────────────────────

/**
 * Generate a comprehensive challenge report for a claim
 */
export async function getChallengeReport(claimId: string): Promise<ChallengeReport | null> {
  const claim = await prisma.claim.findUnique({
    where: { id: claimId },
    select: {
      id: true,
      text: true,
      consensusStatus: true,
      deliberationId: true,
    },
  });

  if (!claim) return null;

  // Get all attacks grouped by type
  const attacks = await getAttacksForClaim(claimId);

  const rebuttals = attacks.filter((a) => a.attackType === "REBUTS");
  const undercuts = attacks.filter((a) => a.attackType === "UNDERCUTS");
  const undermines = attacks.filter((a) => a.attackType === "UNDERMINES");

  // Get all defenses
  const defenses = await getDefensesForClaim(claimId);

  // Determine resolution status
  const openCount = attacks.filter((a) => a.status === "OPEN" || a.status === "UNDER_REVIEW").length;
  const defendedCount = attacks.filter((a) => a.status === "DEFENDED").length;
  const concededCount = attacks.filter((a) => a.status === "CONCEDED").length;
  const stalemateCount = attacks.filter((a) => a.status === "STALEMATE").length;

  let resolutionStatus: "open" | "defended" | "conceded" | "stalemate" | "mixed";
  let resolutionSummary: string;

  if (attacks.length === 0) {
    resolutionStatus = "defended"; // No challenges = effectively defended
    resolutionSummary = "No challenges have been raised against this claim.";
  } else if (openCount === attacks.length) {
    resolutionStatus = "open";
    resolutionSummary = `All ${attacks.length} challenge(s) are still open.`;
  } else if (defendedCount === attacks.length) {
    resolutionStatus = "defended";
    resolutionSummary = `All ${attacks.length} challenge(s) have been successfully defended.`;
  } else if (concededCount === attacks.length) {
    resolutionStatus = "conceded";
    resolutionSummary = `All ${attacks.length} challenge(s) have been conceded.`;
  } else if (stalemateCount === attacks.length) {
    resolutionStatus = "stalemate";
    resolutionSummary = `All ${attacks.length} challenge(s) are at stalemate.`;
  } else {
    resolutionStatus = "mixed";
    resolutionSummary = `Mixed results: ${openCount} open, ${defendedCount} defended, ${concededCount} conceded, ${stalemateCount} stalemate.`;
  }

  return {
    claim: {
      id: claim.id,
      text: claim.text,
      status: claim.consensusStatus as ConsensusStatus,
      deliberationId: claim.deliberationId || undefined,
    },
    challenges: {
      rebuttals,
      undercuts,
      undermines,
    },
    defenses,
    resolutionStatus,
    resolutionSummary,
  };
}

/**
 * Get summary statistics for challenges in a deliberation
 */
export async function getDeliberationChallengeStats(deliberationId: string): Promise<{
  totalClaims: number;
  claimsWithChallenges: number;
  totalChallenges: number;
  openChallenges: number;
  defendedChallenges: number;
  concededChallenges: number;
  totalDefenses: number;
  byStatus: Record<string, number>;
}> {
  // Get all claims in deliberation
  const claims = await prisma.claim.findMany({
    where: { deliberationId },
    select: { id: true },
  });

  const claimIds = claims.map((c) => c.id);

  // Get all attacks
  const attacks = await prisma.claimAttack.findMany({
    where: { targetClaimId: { in: claimIds } },
    select: { status: true, targetClaimId: true },
  });

  // Get all defenses
  const defenseCount = await prisma.claimDefense.count({
    where: { claimId: { in: claimIds } },
  });

  // Calculate stats
  const claimsWithChallenges = new Set(attacks.map((a) => a.targetClaimId)).size;
  const openChallenges = attacks.filter(
    (a) => a.status === "OPEN" || a.status === "UNDER_REVIEW"
  ).length;
  const defendedChallenges = attacks.filter((a) => a.status === "DEFENDED").length;
  const concededChallenges = attacks.filter((a) => a.status === "CONCEDED").length;

  // Group by status
  const byStatus: Record<string, number> = {};
  for (const attack of attacks) {
    byStatus[attack.status] = (byStatus[attack.status] || 0) + 1;
  }

  return {
    totalClaims: claims.length,
    claimsWithChallenges,
    totalChallenges: attacks.length,
    openChallenges,
    defendedChallenges,
    concededChallenges,
    totalDefenses: defenseCount,
    byStatus,
  };
}
