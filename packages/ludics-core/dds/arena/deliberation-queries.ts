/**
 * Deliberation Query Functions
 * 
 * Prisma queries for fetching deliberation structure with all necessary
 * relations for arena construction.
 * 
 * @module
 */

import { prisma } from "@/lib/prismaclient";
import type { Prisma } from "@prisma/client";

// ============================================================================
// QUERY TYPES
// ============================================================================

/**
 * Include specification for full deliberation fetch
 */
export const deliberationWithRelationsInclude = {
  arguments: {
    include: {
      conclusion: {
        include: {
          edgesFrom: true,
          edgesTo: true,
        },
      },
      premises: {
        include: {
          claim: true,
        },
      },
      outgoingEdges: true,
      incomingEdges: true,
      scheme: true,
      argumentSchemes: {
        include: {
          scheme: true,
        },
      },
    },
  },
  Claim: {
    include: {
      edgesFrom: true,
      edgesTo: true,
      asPremiseOf: {
        select: {
          argumentId: true,
        },
      },
      asConclusion: {
        select: {
          id: true,
        },
      },
    },
  },
  edges: true,
  ClaimEdge: true,
} satisfies Prisma.DeliberationInclude;

/**
 * Type for deliberation with all relations loaded
 */
export type DeliberationWithRelations = Prisma.DeliberationGetPayload<{
  include: typeof deliberationWithRelationsInclude;
}>;

/**
 * Type for argument with relations
 */
export type ArgumentWithRelations = DeliberationWithRelations["arguments"][number];

/**
 * Type for claim with relations
 */
export type ClaimWithRelations = NonNullable<
  DeliberationWithRelations["Claim"]
>[number];

// ============================================================================
// QUERY FUNCTIONS
// ============================================================================

/**
 * Fetch a deliberation with all relations needed for arena construction
 * 
 * Includes:
 * - All arguments with conclusions, premises, and edges
 * - All claims with their edges
 * - All argument edges (attacks)
 * - All claim edges (supports/rebuts)
 */
export async function fetchDeliberationWithRelations(
  deliberationId: string
): Promise<DeliberationWithRelations | null> {
  return prisma.deliberation.findUnique({
    where: { id: deliberationId },
    include: deliberationWithRelationsInclude,
  });
}

/**
 * Fetch multiple deliberations with relations
 */
export async function fetchDeliberationsWithRelations(
  deliberationIds: string[]
): Promise<DeliberationWithRelations[]> {
  return prisma.deliberation.findMany({
    where: { id: { in: deliberationIds } },
    include: deliberationWithRelationsInclude,
  });
}

/**
 * Fetch deliberation with minimal relations (for quick checks)
 */
export async function fetchDeliberationBasic(deliberationId: string) {
  return prisma.deliberation.findUnique({
    where: { id: deliberationId },
    include: {
      arguments: {
        select: {
          id: true,
          conclusionClaimId: true,
          text: true,
        },
      },
      Claim: {
        select: {
          id: true,
          text: true,
        },
      },
    },
  });
}

/**
 * Fetch argument graph edges for a deliberation
 */
export async function fetchArgumentEdges(deliberationId: string) {
  return prisma.argumentEdge.findMany({
    where: { deliberationId },
    include: {
      from: {
        select: {
          id: true,
          text: true,
          conclusionClaimId: true,
        },
      },
      to: {
        select: {
          id: true,
          text: true,
          conclusionClaimId: true,
        },
      },
    },
  });
}

/**
 * Fetch claim edges for a deliberation
 */
export async function fetchClaimEdges(deliberationId: string) {
  return prisma.claimEdge.findMany({
    where: { deliberationId },
    include: {
      from: {
        select: {
          id: true,
          text: true,
        },
      },
      to: {
        select: {
          id: true,
          text: true,
        },
      },
    },
  });
}

/**
 * Count elements in a deliberation (for quick stats)
 */
export async function countDeliberationElements(deliberationId: string) {
  const [arguments_, claims, argumentEdges, claimEdges] = await Promise.all([
    prisma.argument.count({ where: { deliberationId } }),
    prisma.claim.count({ where: { deliberationId } }),
    prisma.argumentEdge.count({ where: { deliberationId } }),
    prisma.claimEdge.count({ where: { deliberationId } }),
  ]);

  return {
    arguments: arguments_,
    claims,
    argumentEdges,
    claimEdges,
    total: arguments_ + claims,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if a deliberation exists
 */
export async function deliberationExists(
  deliberationId: string
): Promise<boolean> {
  const count = await prisma.deliberation.count({
    where: { id: deliberationId },
  });
  return count > 0;
}

/**
 * Get deliberation ID from various sources
 */
export async function resolveDeliberationId(source: {
  deliberationId?: string;
  argumentId?: string;
  claimId?: string;
}): Promise<string | null> {
  if (source.deliberationId) {
    return source.deliberationId;
  }

  if (source.argumentId) {
    const arg = await prisma.argument.findUnique({
      where: { id: source.argumentId },
      select: { deliberationId: true },
    });
    return arg?.deliberationId ?? null;
  }

  if (source.claimId) {
    const claim = await prisma.claim.findUnique({
      where: { id: source.claimId },
      select: { deliberationId: true },
    });
    return claim?.deliberationId ?? null;
  }

  return null;
}

// ============================================================================
// CONVERSION HELPERS
// ============================================================================

/**
 * Convert Prisma query result to input format for address builder
 */
export function toDeliberationInput(
  deliberation: DeliberationWithRelations
): import("./deliberation-address").DeliberationInput {
  return {
    id: deliberation.id,
    arguments: deliberation.arguments.map((arg) => ({
      id: arg.id,
      text: arg.text,
      deliberationId: arg.deliberationId,
      conclusionClaimId: arg.conclusionClaimId,
      conclusion: arg.conclusion
        ? {
            id: arg.conclusion.id,
            text: arg.conclusion.text,
            deliberationId: arg.conclusion.deliberationId,
            edgesFrom: arg.conclusion.edgesFrom.map((e) => ({
              toClaimId: e.toClaimId,
              type: e.type,
            })),
            edgesTo: arg.conclusion.edgesTo.map((e) => ({
              fromClaimId: e.fromClaimId,
              type: e.type,
            })),
          }
        : null,
      premises: arg.premises.map((p) => ({
        argumentId: p.argumentId,
        claimId: p.claimId,
        isImplicit: p.isImplicit,
        isAxiom: p.isAxiom,
        claim: p.claim
          ? {
              id: p.claim.id,
              text: p.claim.text,
              deliberationId: p.claim.deliberationId,
            }
          : undefined,
      })),
      outgoingEdges: arg.outgoingEdges.map((e) => ({
        id: e.id,
        fromArgumentId: e.fromArgumentId,
        toArgumentId: e.toArgumentId,
        type: e.type,
        attackType: e.attackType,
        targetScope: e.targetScope,
        targetPremiseId: e.targetPremiseId,
      })),
      incomingEdges: arg.incomingEdges.map((e) => ({
        id: e.id,
        fromArgumentId: e.fromArgumentId,
        toArgumentId: e.toArgumentId,
        type: e.type,
        attackType: e.attackType,
        targetScope: e.targetScope,
        targetPremiseId: e.targetPremiseId,
      })),
      schemeId: arg.schemeId,
    })),
    Claim: deliberation.Claim?.map((claim) => ({
      id: claim.id,
      text: claim.text,
      deliberationId: claim.deliberationId,
      edgesFrom: claim.edgesFrom.map((e) => ({
        toClaimId: e.toClaimId,
        type: e.type,
      })),
      edgesTo: claim.edgesTo.map((e) => ({
        fromClaimId: e.fromClaimId,
        type: e.type,
      })),
      asPremiseOf: claim.asPremiseOf.map((p) => ({
        argumentId: p.argumentId,
      })),
      asConclusion: claim.asConclusion.map((a) => ({
        id: a.id,
      })),
    })),
    edges: deliberation.edges.map((e) => ({
      id: e.id,
      fromArgumentId: e.fromArgumentId,
      toArgumentId: e.toArgumentId,
      type: e.type,
      attackType: e.attackType,
      targetScope: e.targetScope,
      targetPremiseId: e.targetPremiseId,
    })),
    ClaimEdge: deliberation.ClaimEdge?.map((e) => ({
      id: e.id,
      fromClaimId: e.fromClaimId,
      toClaimId: e.toClaimId,
      type: e.type,
    })),
  };
}
