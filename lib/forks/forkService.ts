/**
 * Fork Service - Create and manage deliberation forks
 * 
 * Phase 2.2: Fork/Branch/Merge for Deliberations
 * 
 * Enables scholars to fork deliberations to explore alternative assumptions.
 */

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  ForkOptions,
  ForkResult,
  ForkSummary,
  ForkTreeNode,
  ImportedClaimInfo,
  SyncStatus,
} from "./types";

// ─────────────────────────────────────────────────────────
// Create Fork
// ─────────────────────────────────────────────────────────

/**
 * Create a fork of a deliberation
 */
export async function createFork(
  options: ForkOptions,
  userId: string
): Promise<ForkResult> {
  const {
    parentDeliberationId,
    forkReason,
    forkType,
    title,
    description,
    claimIdsToImport,
    argumentIdsToImport,
    importAllClaims = true,
    importAllArguments = true,
    fromReleaseId,
  } = options;

  // 1. Get parent deliberation with claims and arguments
  const parent = await prisma.deliberation.findUnique({
    where: { id: parentDeliberationId },
    include: {
      Claim: {
        select: {
          id: true,
          text: true,
          claimType: true,
          sourceId: true,
          academicClaimType: true,
        },
      },
      arguments: {
        select: {
          id: true,
          text: true,
          schemeId: true,
          conclusionClaimId: true,
          premises: {
            select: { claimId: true },
          },
        },
      },
      releases: {
        where: fromReleaseId ? { id: fromReleaseId } : { isLatest: true },
        take: 1,
        select: { id: true, version: true },
      },
    },
  });

  if (!parent) {
    throw new Error(`Parent deliberation not found: ${parentDeliberationId}`);
  }

  // 2. Determine which claims to import
  let claimsToImport = parent.Claim;
  if (!importAllClaims && claimIdsToImport && claimIdsToImport.length > 0) {
    const importSet = new Set(claimIdsToImport);
    claimsToImport = parent.Claim.filter((c) => importSet.has(c.id));
  }

  // 3. Determine which arguments to import
  let argumentsToImport = parent.arguments;
  if (!importAllArguments && argumentIdsToImport && argumentIdsToImport.length > 0) {
    const importSet = new Set(argumentIdsToImport);
    argumentsToImport = parent.arguments.filter((a) => importSet.has(a.id));
  }

  // 4. Get release info if forking from a specific release
  const forkFromRelease = parent.releases[0];

  // 5. Create fork in transaction
  const result = await prisma.$transaction(async (tx) => {
    // 5a. Create the forked deliberation
    const forkedDelib = await tx.deliberation.create({
      data: {
        title,
        hostType: "free", // Default, could be passed in options
        hostId: "", // Will be set based on context
        forkedFromId: parentDeliberationId,
        forkedAtReleaseId: forkFromRelease?.id,
        forkReason,
        forkType: forkType as Prisma.Enumerable<any>,
        createdById: userId,
      },
    });

    // 5b. Create claim copies and track imports
    const claimIdMap = new Map<string, string>(); // original -> new
    
    for (const claim of claimsToImport) {
      const newClaim = await tx.claim.create({
        data: {
          text: claim.text,
          claimType: claim.claimType,
          deliberationId: forkedDelib.id,
          sourceId: claim.sourceId,
          academicClaimType: claim.academicClaimType,
          createdById: userId,
          moid: `fork-${forkedDelib.id}-${claim.id}`, // Unique moid for fork
        },
      });

      claimIdMap.set(claim.id, newClaim.id);

      // Track the import
      await tx.importedClaim.create({
        data: {
          deliberationId: forkedDelib.id,
          originalClaimId: claim.id,
          localClaimId: newClaim.id,
          importedById: userId,
          syncStatus: "SYNCED",
          lastSyncedAt: new Date(),
        },
      });
    }

    // 5c. Create argument copies (only if their premises are imported)
    let importedArgumentsCount = 0;
    
    for (const arg of argumentsToImport) {
      // Check if all premises are available in the fork
      const premisesMapped = arg.premises.every((p) =>
        claimIdMap.has(p.claimId)
      );
      const conclusionMapped =
        !arg.conclusionClaimId || claimIdMap.has(arg.conclusionClaimId);

      if (!premisesMapped || !conclusionMapped) {
        // Skip arguments with missing dependencies
        continue;
      }

      // Create the argument
      const newArg = await tx.argument.create({
        data: {
          text: arg.text,
          deliberationId: forkedDelib.id,
          authorId: userId,
          schemeId: arg.schemeId,
          conclusionClaimId: arg.conclusionClaimId
            ? claimIdMap.get(arg.conclusionClaimId)
            : null,
        },
      });

      // Create premises
      for (const premise of arg.premises) {
        const newPremiseClaimId = claimIdMap.get(premise.claimId);
        if (newPremiseClaimId) {
          await tx.argumentPremise.create({
            data: {
              argumentId: newArg.id,
              claimId: newPremiseClaimId,
            },
          });
        }
      }

      // Track the import
      await tx.importedArgument.create({
        data: {
          deliberationId: forkedDelib.id,
          originalArgumentId: arg.id,
          localArgumentId: newArg.id,
          importedById: userId,
          syncStatus: "SYNCED",
        },
      });

      importedArgumentsCount++;
    }

    return {
      id: forkedDelib.id,
      title: forkedDelib.title || title,
      forkReason,
      forkType,
      parentId: parentDeliberationId,
      parentTitle: parent.title || "Untitled",
      forkedFromVersion: forkFromRelease?.version,
      importedClaimsCount: claimIdMap.size,
      importedArgumentsCount,
      createdAt: forkedDelib.createdAt,
    };
  });

  return result;
}

// ─────────────────────────────────────────────────────────
// List Forks
// ─────────────────────────────────────────────────────────

/**
 * List all forks of a deliberation
 */
export async function listForks(parentDeliberationId: string): Promise<ForkSummary[]> {
  const forks = await prisma.deliberation.findMany({
    where: { forkedFromId: parentDeliberationId },
    include: {
      _count: {
        select: {
          Claim: true,
          arguments: true,
          importedClaims: true,
          outgoingMerges: true,
        },
      },
      releases: {
        where: { isLatest: true },
        take: 1,
        select: { version: true },
      },
      importedClaims: {
        where: { syncStatus: "DIVERGED" },
        select: { id: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Get creator info separately to avoid complex joins
  const creatorIds = [...new Set(forks.map((f) => f.createdById))];
  const creators = await prisma.user.findMany({
    where: { id: { in: creatorIds.map((id) => BigInt(id)) } },
    select: { id: true, name: true, image: true },
  });
  const creatorMap = new Map(creators.map((c) => [c.id.toString(), c]));

  return forks.map((fork) => {
    const creator = creatorMap.get(fork.createdById);
    return {
      id: fork.id,
      title: fork.title || "Untitled Fork",
      forkReason: fork.forkReason || "",
      forkType: (fork.forkType as ForkSummary["forkType"]) || "ASSUMPTION_VARIANT",
      forkedAt: fork.createdAt,
      forkedBy: {
        id: fork.createdById,
        name: creator?.name || "Unknown",
        image: creator?.image || undefined,
      },
      parentTitle: "", // Would need to fetch parent
      parentId: fork.forkedFromId || "",
      claimCount: fork._count.Claim,
      argumentCount: fork._count.arguments,
      importedClaimCount: fork._count.importedClaims,
      divergedClaimCount: fork.importedClaims.length,
      hasMergeRequest: fork._count.outgoingMerges > 0,
      latestVersion: fork.releases[0]?.version,
    };
  });
}

// ─────────────────────────────────────────────────────────
// Get Fork Tree
// ─────────────────────────────────────────────────────────

/**
 * Get the full fork tree for a deliberation (including parent and children)
 */
export async function getForkTree(deliberationId: string): Promise<ForkTreeNode> {
  // Find the root (walk up the parent chain)
  let rootId = deliberationId;
  let current = await prisma.deliberation.findUnique({
    where: { id: deliberationId },
    select: { id: true, forkedFromId: true },
  });

  while (current?.forkedFromId) {
    rootId = current.forkedFromId;
    current = await prisma.deliberation.findUnique({
      where: { id: current.forkedFromId },
      select: { id: true, forkedFromId: true },
    });
  }

  // Build tree from root
  return buildForkTreeNode(rootId, 0);
}

async function buildForkTreeNode(
  deliberationId: string,
  depth: number
): Promise<ForkTreeNode> {
  const delib = await prisma.deliberation.findUnique({
    where: { id: deliberationId },
    include: {
      _count: {
        select: { Claim: true, arguments: true },
      },
      forks: {
        select: { id: true },
      },
      releases: {
        where: { isLatest: true },
        take: 1,
        select: { version: true },
      },
    },
  });

  if (!delib) {
    throw new Error(`Deliberation not found: ${deliberationId}`);
  }

  // Recursively build children
  const children: ForkTreeNode[] = [];
  for (const fork of delib.forks) {
    children.push(await buildForkTreeNode(fork.id, depth + 1));
  }

  return {
    id: delib.id,
    title: delib.title || "Untitled",
    forkReason: delib.forkReason || undefined,
    forkType: (delib.forkType as ForkTreeNode["forkType"]) || undefined,
    depth,
    children,
    claimCount: delib._count.Claim,
    argumentCount: delib._count.arguments,
    forkedAt: delib.forkedFromId ? delib.createdAt : undefined,
    latestVersion: delib.releases[0]?.version,
  };
}

// ─────────────────────────────────────────────────────────
// Get Imported Claims
// ─────────────────────────────────────────────────────────

/**
 * Get imported claims with sync status for a forked deliberation
 */
export async function getImportedClaims(
  deliberationId: string
): Promise<ImportedClaimInfo[]> {
  const imports = await prisma.importedClaim.findMany({
    where: { deliberationId },
    include: {
      originalClaim: {
        select: { id: true, text: true, consensusUpdatedAt: true },
      },
      localClaim: {
        select: { id: true, text: true, consensusUpdatedAt: true },
      },
    },
    orderBy: { importedAt: "desc" },
  });

  // Get importer info
  const importerIds = [...new Set(imports.map((i) => i.importedById))];
  const importers = await prisma.user.findMany({
    where: { id: { in: importerIds.map((id) => BigInt(id)) } },
    select: { id: true, name: true },
  });
  const importerMap = new Map(importers.map((u) => [u.id.toString(), u]));

  return imports.map((imp) => {
    const importer = importerMap.get(imp.importedById);
    const hasLocalChanges = imp.localClaim.text !== imp.originalClaim.text;
    const originalUpdatedSinceImport =
      imp.lastSyncedAt &&
      imp.originalClaim.consensusUpdatedAt &&
      imp.originalClaim.consensusUpdatedAt > imp.lastSyncedAt;

    return {
      id: imp.id,
      originalClaimId: imp.originalClaimId,
      localClaimId: imp.localClaimId,
      originalText: imp.originalClaim.text,
      localText: imp.localClaim.text,
      syncStatus: imp.syncStatus as SyncStatus,
      importedAt: imp.importedAt,
      importedBy: {
        id: imp.importedById,
        name: importer?.name || "Unknown",
      },
      hasLocalChanges,
      originalUpdated: originalUpdatedSinceImport || false,
    };
  });
}

// ─────────────────────────────────────────────────────────
// Update Sync Status
// ─────────────────────────────────────────────────────────

/**
 * Mark an imported claim as diverged (local modifications made)
 */
export async function markClaimDiverged(importedClaimId: string): Promise<void> {
  await prisma.importedClaim.update({
    where: { id: importedClaimId },
    data: { syncStatus: "DIVERGED" },
  });
}

/**
 * Detach an imported claim from its original (stop tracking)
 */
export async function detachImportedClaim(importedClaimId: string): Promise<void> {
  await prisma.importedClaim.update({
    where: { id: importedClaimId },
    data: { syncStatus: "DETACHED" },
  });
}

/**
 * Re-sync an imported claim with its original
 */
export async function resyncImportedClaim(
  importedClaimId: string,
  strategy: "KEEP_LOCAL" | "TAKE_ORIGINAL"
): Promise<void> {
  const imported = await prisma.importedClaim.findUnique({
    where: { id: importedClaimId },
    include: {
      originalClaim: { select: { text: true } },
      localClaim: { select: { id: true } },
    },
  });

  if (!imported) {
    throw new Error(`Imported claim not found: ${importedClaimId}`);
  }

  if (strategy === "TAKE_ORIGINAL") {
    // Update local claim to match original
    await prisma.claim.update({
      where: { id: imported.localClaimId },
      data: { text: imported.originalClaim.text },
    });
  }

  // Mark as synced
  await prisma.importedClaim.update({
    where: { id: importedClaimId },
    data: {
      syncStatus: "SYNCED",
      lastSyncedAt: new Date(),
    },
  });
}
