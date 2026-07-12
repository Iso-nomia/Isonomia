/**
 * Merge Service - Handle merge requests between forks and parents
 * 
 * Phase 2.2: Fork/Branch/Merge for Deliberations
 * 
 * Provides Git-like merge functionality for deliberations.
 */

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { resolveDeliberationName } from "@/lib/deliberations/resolveName";
import {
  MergeOptions,
  MergeClaimSelection,
  MergeArgumentSelection,
  MergeAnalysis,
  MergeConflict,
  MergeRequestSummary,
  MergeRequestDetail,
  MergeStatus,
  MergeStrategy,
} from "./types";

// ─────────────────────────────────────────────────────────
// Create Merge Request
// ─────────────────────────────────────────────────────────

export interface CreateMergeRequestInput {
  sourceDeliberationId: string;
  targetDeliberationId: string;
  title: string;
  description?: string;
  claimsToMerge: MergeClaimSelection[];
  argumentsToMerge: MergeArgumentSelection[];
}

/**
 * Create a new merge request
 */
export async function createMergeRequest(
  input: CreateMergeRequestInput,
  authorId: string
): Promise<MergeRequestSummary> {
  // Verify source and target exist
  const [source, target] = await Promise.all([
    prisma.deliberation.findUnique({
      where: { id: input.sourceDeliberationId },
      select: { id: true, title: true, forkedFromId: true },
    }),
    prisma.deliberation.findUnique({
      where: { id: input.targetDeliberationId },
      select: { id: true, title: true },
    }),
  ]);

  if (!source) {
    throw new Error(`Source deliberation not found: ${input.sourceDeliberationId}`);
  }
  if (!target) {
    throw new Error(`Target deliberation not found: ${input.targetDeliberationId}`);
  }

  // Create the merge request
  const mergeRequest = await prisma.mergeRequest.create({
    data: {
      sourceDeliberationId: input.sourceDeliberationId,
      targetDeliberationId: input.targetDeliberationId,
      title: input.title,
      description: input.description,
      claimsToMerge: input.claimsToMerge as unknown as Prisma.InputJsonValue,
      argumentsToMerge: input.argumentsToMerge as unknown as Prisma.InputJsonValue,
      authorId,
      status: "OPEN",
    },
  });

  return {
    id: mergeRequest.id,
    title: mergeRequest.title,
    description: mergeRequest.description || undefined,
    status: mergeRequest.status as MergeStatus,
    sourceDeliberation: {
      id: source.id,
      title: source.title || "Untitled",
    },
    targetDeliberation: {
      id: target.id,
      title: target.title || "Untitled",
    },
    author: {
      id: authorId,
      name: "", // Fetched separately
    },
    claimsToMergeCount: input.claimsToMerge.length,
    argumentsToMergeCount: input.argumentsToMerge.length,
    commentCount: 0,
    createdAt: mergeRequest.createdAt,
    updatedAt: mergeRequest.updatedAt,
  };
}

// ─────────────────────────────────────────────────────────
// Analyze Merge
// ─────────────────────────────────────────────────────────

/**
 * Analyze a proposed merge for conflicts and provide statistics
 */
export async function analyzeMerge(
  sourceDeliberationId: string,
  targetDeliberationId: string,
  claimsToMerge: MergeClaimSelection[],
  argumentsToMerge: MergeArgumentSelection[]
): Promise<MergeAnalysis> {
  const conflicts: MergeConflict[] = [];
  const warnings: string[] = [];

  // Get source claims
  const sourceClaimIds = claimsToMerge.map((c) => c.claimId);
  const sourceClaims = await prisma.claim.findMany({
    where: {
      id: { in: sourceClaimIds },
      deliberationId: sourceDeliberationId,
    },
    select: { id: true, text: true },
  });

  const sourceClaimMap = new Map(sourceClaims.map((c) => [c.id, c]));

  // Get target claims to check for duplicates
  const targetClaims = await prisma.claim.findMany({
    where: { deliberationId: targetDeliberationId },
    select: { id: true, text: true },
  });

  const targetClaimTexts = new Set(targetClaims.map((c) => c.text.toLowerCase().trim()));

  // Check each claim for conflicts
  let newClaims = 0;
  let updatedClaims = 0;

  for (const selection of claimsToMerge) {
    const sourceClaim = sourceClaimMap.get(selection.claimId);
    if (!sourceClaim) {
      conflicts.push({
        type: "DELETED_IN_TARGET",
        sourceId: selection.claimId,
        description: `Claim not found in source deliberation`,
        suggestedResolution: "SKIP",
      });
      continue;
    }

    if (selection.strategy === "ADD_NEW") {
      // Check for duplicate text
      if (targetClaimTexts.has(sourceClaim.text.toLowerCase().trim())) {
        conflicts.push({
          type: "CLAIM_EXISTS",
          sourceId: selection.claimId,
          description: `A claim with similar text already exists in target: "${sourceClaim.text.slice(0, 50)}..."`,
          suggestedResolution: "SKIP",
        });
      } else {
        newClaims++;
      }
    } else if (selection.strategy === "REPLACE") {
      if (!selection.targetClaimId) {
        conflicts.push({
          type: "CLAIM_EXISTS",
          sourceId: selection.claimId,
          description: `REPLACE strategy requires a target claim ID`,
          suggestedResolution: "ADD_NEW",
        });
      } else {
        updatedClaims++;
      }
    }
  }

  // Check arguments for orphaned premises
  let newArguments = 0;
  const mergedClaimIds = new Set(
    claimsToMerge
      .filter((c) => c.strategy !== "SKIP")
      .map((c) => c.claimId)
  );

  for (const selection of argumentsToMerge) {
    // Get argument with premises
    const arg = await prisma.argument.findUnique({
      where: { id: selection.argumentId },
      include: {
        premises: { select: { claimId: true } },
      },
    });

    if (!arg) {
      warnings.push(`Argument ${selection.argumentId} not found, will be skipped`);
      continue;
    }

    // Check if all premises will be available
    const missingPremises = arg.premises.filter(
      (p) => !mergedClaimIds.has(p.claimId)
    );

    if (missingPremises.length > 0 && !selection.includeWithClaims) {
      conflicts.push({
        type: "ARGUMENT_ORPHAN",
        sourceId: selection.argumentId,
        description: `Argument has ${missingPremises.length} premise(s) not included in merge`,
        suggestedResolution: "SKIP",
      });
    } else {
      newArguments++;
    }
  }

  return {
    canMerge: conflicts.length === 0,
    conflicts,
    newClaims,
    newArguments,
    updatedClaims,
    warnings,
  };
}

// ─────────────────────────────────────────────────────────
// Execute Merge
// ─────────────────────────────────────────────────────────

/**
 * Execute a merge request
 */
export async function executeMerge(
  mergeRequestId: string,
  executorId: string
): Promise<{ mergedClaims: number; mergedArguments: number }> {
  // Get merge request
  const mergeRequest = await prisma.mergeRequest.findUnique({
    where: { id: mergeRequestId },
    include: {
      sourceDeliberation: {
        include: {
          Claim: true,
          arguments: {
            include: {
              premises: true,
            },
          },
        },
      },
    },
  });

  if (!mergeRequest) {
    throw new Error(`Merge request not found: ${mergeRequestId}`);
  }

  if (mergeRequest.status !== "APPROVED" && mergeRequest.status !== "OPEN") {
    throw new Error(`Merge request is not in a mergeable state: ${mergeRequest.status}`);
  }

  const claimsToMerge = mergeRequest.claimsToMerge as unknown as MergeClaimSelection[];
  const argumentsToMerge = mergeRequest.argumentsToMerge as unknown as MergeArgumentSelection[];
  const targetDelibId = mergeRequest.targetDeliberationId;

  // Execute in transaction
  const result = await prisma.$transaction(async (tx) => {
    const claimIdMap = new Map<string, string>(); // source -> target
    let mergedClaims = 0;
    let mergedArguments = 0;

    // 1. Merge claims
    for (const selection of claimsToMerge) {
      if (selection.strategy === "SKIP") continue;

      const sourceClaim = mergeRequest.sourceDeliberation.Claim.find(
        (c) => c.id === selection.claimId
      );
      if (!sourceClaim) continue;

      if (selection.strategy === "ADD_NEW") {
        // Create new claim in target
        const newClaim = await tx.claim.create({
          data: {
            text: sourceClaim.text,
            claimType: sourceClaim.claimType,
            deliberationId: targetDelibId,
            sourceId: sourceClaim.sourceId,
            academicClaimType: sourceClaim.academicClaimType,
            createdById: executorId,
            moid: `merge-${mergeRequestId}-${sourceClaim.id}`,
          },
        });
        claimIdMap.set(sourceClaim.id, newClaim.id);
        mergedClaims++;
      } else if (selection.strategy === "REPLACE" && selection.targetClaimId) {
        // Update existing claim
        await tx.claim.update({
          where: { id: selection.targetClaimId },
          data: { text: sourceClaim.text },
        });
        claimIdMap.set(sourceClaim.id, selection.targetClaimId);
        mergedClaims++;
      } else if (selection.strategy === "LINK_SUPPORT" && selection.targetClaimId) {
        // Create new claim and link as support
        const newClaim = await tx.claim.create({
          data: {
            text: sourceClaim.text,
            claimType: sourceClaim.claimType,
            deliberationId: targetDelibId,
            createdById: executorId,
            moid: `merge-support-${mergeRequestId}-${sourceClaim.id}`,
          },
        });
        claimIdMap.set(sourceClaim.id, newClaim.id);

        // Create support edge
        await tx.claimEdge.create({
          data: {
            fromClaimId: newClaim.id,
            toClaimId: selection.targetClaimId,
            type: "supports",
            deliberationId: targetDelibId,
          },
        });
        mergedClaims++;
      } else if (selection.strategy === "LINK_CHALLENGE" && selection.targetClaimId) {
        // Create new claim and link as challenge
        const newClaim = await tx.claim.create({
          data: {
            text: sourceClaim.text,
            claimType: sourceClaim.claimType,
            deliberationId: targetDelibId,
            createdById: executorId,
            moid: `merge-challenge-${mergeRequestId}-${sourceClaim.id}`,
          },
        });
        claimIdMap.set(sourceClaim.id, newClaim.id);

        // Create attack edge
        await tx.claimEdge.create({
          data: {
            fromClaimId: newClaim.id,
            toClaimId: selection.targetClaimId,
            type: "rebuts",
            deliberationId: targetDelibId,
          },
        });
        mergedClaims++;
      }
    }

    // 2. Merge arguments
    for (const selection of argumentsToMerge) {
      const sourceArg = mergeRequest.sourceDeliberation.arguments.find(
        (a) => a.id === selection.argumentId
      );
      if (!sourceArg) continue;

      // Check if all premises are available
      const allPremisesAvailable = sourceArg.premises.every(
        (p) => claimIdMap.has(p.claimId)
      );

      if (!allPremisesAvailable && !selection.includeWithClaims) {
        continue; // Skip orphaned arguments
      }

      // Get conclusion mapping
      const conclusionId = sourceArg.conclusionClaimId
        ? claimIdMap.get(sourceArg.conclusionClaimId)
        : null;

      // Create argument
      const newArg = await tx.argument.create({
        data: {
          text: sourceArg.text,
          deliberationId: targetDelibId,
          authorId: executorId,
          schemeId: sourceArg.schemeId,
          conclusionClaimId: conclusionId,
        },
      });

      // Create premises
      for (const premise of sourceArg.premises) {
        const mappedClaimId = claimIdMap.get(premise.claimId);
        if (mappedClaimId) {
          await tx.argumentPremise.create({
            data: {
              argumentId: newArg.id,
              claimId: mappedClaimId,
            },
          });
        }
      }

      mergedArguments++;
    }

    // 3. Update merge request status
    await tx.mergeRequest.update({
      where: { id: mergeRequestId },
      data: {
        status: "MERGED",
        mergedAt: new Date(),
        mergedById: executorId,
      },
    });

    return { mergedClaims, mergedArguments };
  });

  return result;
}

// ─────────────────────────────────────────────────────────
// List Merge Requests
// ─────────────────────────────────────────────────────────

/**
 * List merge requests for a deliberation (as target)
 */
export async function listMergeRequests(
  deliberationId: string,
  options?: {
    status?: MergeStatus;
    asSource?: boolean;
  }
): Promise<MergeRequestSummary[]> {
  const where = options?.asSource
    ? { sourceDeliberationId: deliberationId }
    : { targetDeliberationId: deliberationId };

  if (options?.status) {
    Object.assign(where, { status: options.status });
  }

  const requests = await prisma.mergeRequest.findMany({
    where,
    include: {
      sourceDeliberation: { select: { id: true, title: true } },
      targetDeliberation: { select: { id: true, title: true } },
      _count: { select: { reviewComments: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Get author info
  const authorIds = [...new Set(requests.map((r) => r.authorId))];
  const authors = await prisma.user.findMany({
    where: { id: { in: authorIds.map((id) => BigInt(id)) } },
    select: { id: true, name: true, image: true },
  });
  const authorMap = new Map(authors.map((a) => [a.id.toString(), a]));

  return requests.map((req) => {
    const author = authorMap.get(req.authorId);
    const claimsToMerge = req.claimsToMerge as unknown as MergeClaimSelection[];
    const argumentsToMerge = req.argumentsToMerge as unknown as MergeArgumentSelection[];

    return {
      id: req.id,
      title: req.title,
      description: req.description || undefined,
      status: req.status as MergeStatus,
      sourceDeliberation: {
        id: req.sourceDeliberation.id,
        title: resolveDeliberationName(req.sourceDeliberation, { fallback: "Untitled" }),
      },
      targetDeliberation: {
        id: req.targetDeliberation.id,
        title: resolveDeliberationName(req.targetDeliberation, { fallback: "Untitled" }),
      },
      author: {
        id: req.authorId,
        name: author?.name || "Unknown",
        image: author?.image || undefined,
      },
      claimsToMergeCount: claimsToMerge.length,
      argumentsToMergeCount: argumentsToMerge.length,
      commentCount: req._count.reviewComments,
      createdAt: req.createdAt,
      updatedAt: req.updatedAt,
      mergedAt: req.mergedAt || undefined,
      closedAt: req.closedAt || undefined,
    };
  });
}

// ─────────────────────────────────────────────────────────
// Get Merge Request Detail
// ─────────────────────────────────────────────────────────

/**
 * Get full details of a merge request
 */
export async function getMergeRequest(
  mergeRequestId: string
): Promise<MergeRequestDetail | null> {
  const req = await prisma.mergeRequest.findUnique({
    where: { id: mergeRequestId },
    include: {
      sourceDeliberation: { select: { id: true, title: true } },
      targetDeliberation: { select: { id: true, title: true } },
      reviewComments: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!req) return null;

  // Get author and commenter info
  const userIds = [req.authorId, ...req.reviewComments.map((c) => c.authorId)];
  const users = await prisma.user.findMany({
    where: { id: { in: [...new Set(userIds)].map((id) => BigInt(id)) } },
    select: { id: true, name: true, image: true },
  });
  const userMap = new Map(users.map((u) => [u.id.toString(), u]));

  const author = userMap.get(req.authorId);
  const claimsToMerge = req.claimsToMerge as unknown as MergeClaimSelection[];
  const argumentsToMerge = req.argumentsToMerge as unknown as MergeArgumentSelection[];

  // Run analysis
  const analysis = await analyzeMerge(
    req.sourceDeliberationId,
    req.targetDeliberationId,
    claimsToMerge,
    argumentsToMerge
  );

  return {
    id: req.id,
    title: req.title,
    description: req.description || undefined,
    status: req.status as MergeStatus,
    sourceDeliberation: {
      id: req.sourceDeliberation.id,
      title: resolveDeliberationName(req.sourceDeliberation, { fallback: "Untitled" }),
    },
    targetDeliberation: {
      id: req.targetDeliberation.id,
      title: resolveDeliberationName(req.targetDeliberation, { fallback: "Untitled" }),
    },
    author: {
      id: req.authorId,
      name: author?.name || "Unknown",
      image: author?.image || undefined,
    },
    claimsToMergeCount: claimsToMerge.length,
    argumentsToMergeCount: argumentsToMerge.length,
    commentCount: req.reviewComments.length,
    createdAt: req.createdAt,
    updatedAt: req.updatedAt,
    mergedAt: req.mergedAt || undefined,
    closedAt: req.closedAt || undefined,
    claimsToMerge,
    argumentsToMerge,
    comments: req.reviewComments.map((c) => {
      const commenter = userMap.get(c.authorId);
      return {
        id: c.id,
        content: c.content,
        author: {
          id: c.authorId,
          name: commenter?.name || "Unknown",
          image: commenter?.image || undefined,
        },
        targetClaimId: c.targetClaimId || undefined,
        targetArgumentId: c.targetArgumentId || undefined,
        createdAt: c.createdAt,
      };
    }),
    analysis,
  };
}

// ─────────────────────────────────────────────────────────
// Update Merge Request Status
// ─────────────────────────────────────────────────────────

/**
 * Update the status of a merge request
 */
export async function updateMergeRequestStatus(
  mergeRequestId: string,
  status: MergeStatus,
  userId: string
): Promise<void> {
  const updates: Record<string, unknown> = { status };

  if (status === "CLOSED") {
    updates.closedAt = new Date();
  }

  await prisma.mergeRequest.update({
    where: { id: mergeRequestId },
    data: updates,
  });
}

// ─────────────────────────────────────────────────────────
// Add Comment
// ─────────────────────────────────────────────────────────

/**
 * Add a comment to a merge request
 */
export async function addMergeComment(
  mergeRequestId: string,
  content: string,
  authorId: string,
  options?: {
    targetClaimId?: string;
    targetArgumentId?: string;
  }
): Promise<{ id: string }> {
  const comment = await prisma.mergeComment.create({
    data: {
      mergeRequestId,
      content,
      authorId,
      targetClaimId: options?.targetClaimId,
      targetArgumentId: options?.targetArgumentId,
    },
  });

  return { id: comment.id };
}
