/**
 * Snapshot Generation Service
 * 
 * Phase 2.1: Debate Releases & Versioned Memory
 * 
 * Generates point-in-time snapshots of deliberation state
 * including claims, arguments, and their relationships.
 */

import { prisma } from "@/lib/prisma";
import {
  ClaimSnapshot,
  ClaimSnapshotItem,
  ClaimStats,
  ClaimStatus,
  ArgumentSnapshot,
  ArgumentSnapshotItem,
  PremiseSnapshot,
  AttackGraphSnapshot,
  ArgumentStats,
  StatsSnapshot,
} from "./types";

// ─────────────────────────────────────────────────────────
// Claim Snapshot Generation
// ─────────────────────────────────────────────────────────

/**
 * Generate a complete claim snapshot for a deliberation
 */
export async function generateClaimSnapshot(
  deliberationId: string
): Promise<ClaimSnapshot> {
  // Fetch all claims with relationships
  const claims = await prisma.claim.findMany({
    where: { deliberationId },
    include: {
      source: {
        select: { id: true, title: true },
      },
      edgesFrom: {
        select: { type: true },
      },
      edgesTo: {
        select: { type: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // Get user info for createdBy
  const userIds = [...new Set(claims.map((c) => c.createdById))];
  const users = await prisma.user.findMany({
    where: { auth_id: { in: userIds } },
    select: { auth_id: true, name: true, username: true },
  });
  const userMap = new Map(users.map((u) => [u.auth_id, u]));

  // Calculate claim statuses
  const claimStatuses = await calculateClaimStatuses(deliberationId);

  // Build snapshot items
  const snapshotItems: ClaimSnapshotItem[] = claims.map((claim) => {
    const user = userMap.get(claim.createdById);
    const attackCount = claim.edgesTo.filter(
      (e) => e.type === "rebuts"
    ).length;
    const supportCount = claim.edgesTo.filter(
      (e) => e.type === "supports"
    ).length;

    return {
      id: claim.id,
      text: claim.text,
      claimType: claim.claimType,
      academicClaimType: claim.academicClaimType,
      status: claimStatuses.get(claim.id) || "UNRESOLVED",
      sourceId: claim.source?.id || null,
      sourceTitle: claim.source?.title || null,
      createdById: claim.createdById,
      createdByName: user?.name || user?.username || "Unknown",
      attackCount,
      supportCount,
      createdAt: claim.createdAt.toISOString(),
    };
  });

  // Calculate stats
  const stats: ClaimStats = {
    total: snapshotItems.length,
    defended: snapshotItems.filter((c) => c.status === "DEFENDED").length,
    contested: snapshotItems.filter((c) => c.status === "CONTESTED").length,
    unresolved: snapshotItems.filter((c) => c.status === "UNRESOLVED").length,
    withdrawn: snapshotItems.filter((c) => c.status === "WITHDRAWN").length,
    accepted: snapshotItems.filter((c) => c.status === "ACCEPTED").length,
  };

  return {
    claims: snapshotItems,
    stats,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Calculate claim statuses based on attack/support relationships
 * Simplified heuristic - can be replaced with full ASPIC+ evaluation
 */
export async function calculateClaimStatuses(
  deliberationId: string
): Promise<Map<string, ClaimStatus>> {
  const statuses = new Map<string, ClaimStatus>();

  // Get claims with their incoming edges
  const claims = await prisma.claim.findMany({
    where: { deliberationId },
    include: {
      edgesTo: {
        include: {
          from: {
            include: {
              edgesTo: true, // To check if attacker is itself attacked
            },
          },
        },
      },
    },
  });

  for (const claim of claims) {
    const attacks = claim.edgesTo.filter(
      (e) => e.type === "rebuts"
    );
    const supports = claim.edgesTo.filter(
      (e) => e.type === "supports"
    );

    // Check if there are undefeated attacks
    const hasUndefeatedAttack = attacks.some((attack) => {
      // An attack is undefeated if the attacking claim is not itself attacked
      const attackerClaim = attack.from;
      const attackerIsAttacked = attackerClaim.edgesTo.some(
        (e) => e.type === "rebuts"
      );
      return !attackerIsAttacked;
    });

    if (hasUndefeatedAttack) {
      statuses.set(claim.id, "CONTESTED");
    } else if (supports.length > 0) {
      statuses.set(claim.id, "DEFENDED");
    } else if (attacks.length > 0) {
      // Has attacks but all are defeated
      statuses.set(claim.id, "DEFENDED");
    } else {
      statuses.set(claim.id, "UNRESOLVED");
    }
  }

  return statuses;
}

// ─────────────────────────────────────────────────────────
// Argument Snapshot Generation
// ─────────────────────────────────────────────────────────

/**
 * Generate a complete argument snapshot for a deliberation
 */
export async function generateArgumentSnapshot(
  deliberationId: string
): Promise<ArgumentSnapshot> {
  // Fetch all arguments with relationships
  const arguments_ = await prisma.argument.findMany({
    where: { deliberationId },
    include: {
      premises: {
        include: {
          claim: {
            select: { id: true, text: true },
          },
        },
      },
      conclusion: {
        select: { id: true, text: true },
      },
      scheme: {
        select: { id: true, name: true },
      },
      outgoingEdges: {
        select: { toArgumentId: true, type: true },
      },
      incomingEdges: {
        select: { fromArgumentId: true, type: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // Get user info
  const userIds = [...new Set(arguments_.map((a) => a.authorId))];
  const users = await prisma.user.findMany({
    where: { auth_id: { in: userIds } },
    select: { auth_id: true, name: true, username: true },
  });
  const userMap = new Map(users.map((u) => [u.auth_id, u]));

  // Calculate acceptability
  const acceptability = calculateArgumentAcceptability(arguments_);

  // Build snapshot items
  const snapshotItems: ArgumentSnapshotItem[] = arguments_.map((arg) => {
    const user = userMap.get(arg.authorId);
    const premises: PremiseSnapshot[] = arg.premises.map((p, idx) => ({
      claimId: p.claim.id,
      claimText: p.claim.text,
      order: idx,
    }));

    return {
      id: arg.id,
      text: arg.text,
      type: arg.scheme?.name || "Deductive",
      premises,
      conclusionId: arg.conclusion?.id || null,
      conclusionText: arg.conclusion?.text || null,
      schemeId: arg.scheme?.id || null,
      schemeName: arg.scheme?.name || null,
      acceptable: acceptability.get(arg.id) ?? true,
      attackedByIds: arg.incomingEdges
        .filter((e) => e.type === "rebut" || e.type === "undercut")
        .map((e) => e.fromArgumentId),
      attacksIds: arg.outgoingEdges
        .filter((e) => e.type === "rebut" || e.type === "undercut")
        .map((e) => e.toArgumentId),
      createdById: arg.authorId,
      createdByName: user?.name || user?.username || "Unknown",
      createdAt: arg.createdAt.toISOString(),
    };
  });

  // Build attack graph
  const attackGraph = buildAttackGraph(arguments_);

  // Calculate stats
  const stats: ArgumentStats = {
    total: snapshotItems.length,
    acceptable: snapshotItems.filter((a) => a.acceptable).length,
    defeated: snapshotItems.filter((a) => !a.acceptable).length,
    attackEdges: attackGraph.edges.filter((e) => e.type === "attack").length,
    supportEdges: attackGraph.edges.filter((e) => e.type === "support").length,
  };

  return {
    arguments: snapshotItems,
    attackGraph,
    stats,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Calculate argument acceptability (simplified grounded semantics)
 */
export function calculateArgumentAcceptability(
  arguments_: Array<{
    id: string;
    incomingEdges: Array<{ fromArgumentId: string; type: string }>;
  }>
): Map<string, boolean> {
  const acceptability = new Map<string, boolean>();

  // Build attack map
  const attackedBy = new Map<string, string[]>();
  for (const arg of arguments_) {
    const attackers = arg.incomingEdges
      .filter((e) => e.type === "ATTACK" || e.type === "REBUT" || e.type === "UNDERCUT")
      .map((e) => e.fromArgumentId);
    attackedBy.set(arg.id, attackers);
  }

  // Simple grounded semantics: acceptable if not attacked, or all attackers are defeated
  // Iterate until fixed point
  let changed = true;
  while (changed) {
    changed = false;
    for (const arg of arguments_) {
      const attackers = attackedBy.get(arg.id) || [];
      
      if (attackers.length === 0) {
        // No attackers = acceptable
        if (!acceptability.has(arg.id)) {
          acceptability.set(arg.id, true);
          changed = true;
        }
      } else {
        // Check if all attackers are defeated
        const allAttackersDefeated = attackers.every(
          (attackerId) => acceptability.get(attackerId) === false
        );
        const anyAttackerAcceptable = attackers.some(
          (attackerId) => acceptability.get(attackerId) === true
        );

        if (anyAttackerAcceptable && !acceptability.has(arg.id)) {
          acceptability.set(arg.id, false);
          changed = true;
        } else if (allAttackersDefeated && !acceptability.has(arg.id)) {
          acceptability.set(arg.id, true);
          changed = true;
        }
      }
    }
  }

  // Mark remaining as acceptable (no clear defeat)
  for (const arg of arguments_) {
    if (!acceptability.has(arg.id)) {
      acceptability.set(arg.id, true);
    }
  }

  return acceptability;
}

/**
 * Build attack graph from arguments
 */
export function buildAttackGraph(
  arguments_: Array<{
    id: string;
    conclusion?: { id: string; text: string } | null;
    outgoingEdges: Array<{ toArgumentId: string; type: string }>;
  }>
): AttackGraphSnapshot {
  const nodes: AttackGraphSnapshot["nodes"] = [];
  const edges: AttackGraphSnapshot["edges"] = [];
  const seenNodes = new Set<string>();

  for (const arg of arguments_) {
    // Add argument node
    if (!seenNodes.has(arg.id)) {
      nodes.push({
        id: arg.id,
        type: "argument",
        label: `Arg ${arg.id.slice(-4)}`,
      });
      seenNodes.add(arg.id);
    }

    // Add conclusion as claim node and support edge
    if (arg.conclusion && !seenNodes.has(arg.conclusion.id)) {
      nodes.push({
        id: arg.conclusion.id,
        type: "claim",
        label: arg.conclusion.text.slice(0, 50),
      });
      seenNodes.add(arg.conclusion.id);
    }

    if (arg.conclusion) {
      edges.push({
        from: arg.id,
        to: arg.conclusion.id,
        type: "support",
      });
    }

    // Add attack edges
    for (const edge of arg.outgoingEdges) {
      if (edge.type === "ATTACK" || edge.type === "REBUT") {
        edges.push({
          from: arg.id,
          to: edge.toArgumentId,
          type: "attack",
        });
      } else if (edge.type === "UNDERCUT") {
        edges.push({
          from: arg.id,
          to: edge.toArgumentId,
          type: "undercut",
        });
      }
    }
  }

  return { nodes, edges };
}

// ─────────────────────────────────────────────────────────
// Stats Snapshot Generation
// ─────────────────────────────────────────────────────────

/**
 * Generate a combined stats snapshot
 */
export async function generateStatsSnapshot(
  deliberationId: string,
  claimSnapshot?: ClaimSnapshot,
  argumentSnapshot?: ArgumentSnapshot
): Promise<StatsSnapshot> {
  // Generate snapshots if not provided
  const claims = claimSnapshot || await generateClaimSnapshot(deliberationId);
  const args = argumentSnapshot || await generateArgumentSnapshot(deliberationId);

  // Count unique participants
  const participantIds = new Set<string>();
  claims.claims.forEach((c) => participantIds.add(c.createdById));
  args.arguments.forEach((a) => participantIds.add(a.createdById));

  return {
    claims: claims.stats,
    arguments: args.stats,
    participants: participantIds.size,
    generatedAt: new Date().toISOString(),
  };
}
