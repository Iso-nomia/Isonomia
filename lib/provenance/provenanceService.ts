/**
 * Phase 3.1: Claim Provenance Service
 * Core functions for tracking claim lifecycle, versions, and consensus
 */

import { prisma } from "@/lib/prismaclient";
import {
  ClaimProvenance,
  CreateVersionOptions,
  ClaimVersionSummary,
  ClaimTimelineEvent,
  ClaimOrigin,
  ChallengeSummary,
  ConsensusStatus,
  ConsensusCalculationInput,
  ConsensusCalculationResult,
  VersionChangeType,
  ClaimVersionWithAuthor,
} from "./types";

// ─────────────────────────────────────────────────────────
// Provenance Retrieval
// ─────────────────────────────────────────────────────────

/**
 * Get full provenance for a claim including origin, versions, and challenge summary
 */
export async function getClaimProvenance(
  claimId: string
): Promise<ClaimProvenance | null> {
  const claim = await prisma.claim.findUnique({
    where: { id: claimId },
    include: {
      source: {
        select: { id: true, title: true, authorsJson: true },
      },
      versions: {
        orderBy: { versionNumber: "asc" },
      },
      currentVersion: true,
      deliberation: {
        select: { id: true },
      },
    },
  });

  if (!claim) return null;

  // Build origin info
  const origin: ClaimOrigin = {
    sourceId: claim.sourceId || undefined,
    sourceTitle: claim.source?.title || undefined,
    sourceAuthors: claim.source?.authorsJson ? (claim.source.authorsJson as unknown as string[]) : undefined,
    date: claim.originDate ?? claim.createdAt,
    authorId: claim.originAuthorId ?? claim.createdById,
  };

  // Map versions to summaries
  const versions: ClaimVersionSummary[] = claim.versions.map((v: (typeof claim.versions)[number]) => ({
    id: v.id,
    versionNumber: v.versionNumber,
    text: v.text,
    changeType: v.changeType as VersionChangeType,
    changeReason: v.changeReason || undefined,
    authorId: v.authorId,
    authorName: v.authorId, // Will be enriched by caller if needed
    createdAt: v.createdAt,
  }));

  // Build challenge summary from aggregated counts
  const challengeSummary: ChallengeSummary = {
    total: claim.challengeCount,
    open: claim.openChallenges,
    defended: claim.defendedCount,
    conceded: claim.concededCount,
    stalemate: 0, // Would need to count from attacks if needed
    partiallyDefended: 0,
    withdrawn: 0,
  };

  return {
    claimId: claim.id,
    canonicalId: claim.canonicalClaimId || undefined,
    deliberationId: claim.deliberationId || undefined,
    origin,
    versions,
    currentVersion: claim.currentVersion?.versionNumber || 1,
    consensusStatus: claim.consensusStatus as ConsensusStatus,
    challengeSummary,
  };
}

/**
 * Get provenance with enriched author names
 */
export async function getClaimProvenanceWithAuthors(
  claimId: string
): Promise<ClaimProvenance | null> {
  const provenance = await getClaimProvenance(claimId);
  if (!provenance) return null;

  // Get unique author IDs
  const authorIds = new Set<string>();
  if (provenance.origin.authorId) authorIds.add(provenance.origin.authorId);
  provenance.versions.forEach((v) => authorIds.add(v.authorId));

  // Fetch author names (auth_id -> name mapping)
  // Note: In this codebase, authorId is the auth_id string
  const users = await prisma.user.findMany({
    where: { auth_id: { in: Array.from(authorIds) } },
    select: { auth_id: true, name: true },
  });

  const nameMap = new Map(users.map((u) => [u.auth_id, u.name || "Unknown"]));

  // Enrich origin
  if (provenance.origin.authorId) {
    provenance.origin.authorName = nameMap.get(provenance.origin.authorId) || "Unknown";
  }

  // Enrich versions
  provenance.versions = provenance.versions.map((v) => ({
    ...v,
    authorName: nameMap.get(v.authorId) || "Unknown",
  }));

  return provenance;
}

// ─────────────────────────────────────────────────────────
// Version Management
// ─────────────────────────────────────────────────────────

/**
 * Create a new version of a claim
 */
export async function createClaimVersion(
  options: CreateVersionOptions,
  userId: string
): Promise<ClaimVersionWithAuthor> {
  const { claimId, text, claimType, changeType, changeReason } = options;

  // Get current claim state
  const claim = await prisma.claim.findUnique({
    where: { id: claimId },
    include: {
      currentVersion: true,
    },
  });

  if (!claim) {
    throw new Error("Claim not found");
  }

  const nextVersionNumber = (claim.currentVersion?.versionNumber || 0) + 1;

  // Determine what changed
  const changedFields = {
    text: text !== claim.text,
    claimType: claimType ? claimType !== claim.claimType : false,
  };

  // Create version in transaction
  const result = await prisma.$transaction(async (tx) => {
    // Create the new version
    const version = await tx.claimVersion.create({
      data: {
        claimId,
        text,
        claimType: claimType || claim.claimType,
        versionNumber: nextVersionNumber,
        changeType,
        changeReason,
        changedFields,
        previousVersionId: claim.currentVersionId,
        authorId: userId,
      },
    });

    // Update the claim with new text and version reference
    await tx.claim.update({
      where: { id: claimId },
      data: {
        text,
        claimType: claimType || claim.claimType,
        currentVersionId: version.id,
      },
    });

    return version;
  });

  return {
    ...result,
    changeType: result.changeType as VersionChangeType,
    changedFields: result.changedFields as Record<string, boolean> | null,
  };
}

/**
 * Get all versions of a claim
 */
export async function getClaimVersions(
  claimId: string
): Promise<ClaimVersionSummary[]> {
  const versions = await prisma.claimVersion.findMany({
    where: { claimId },
    orderBy: { versionNumber: "asc" },
  });

  // Get author names
  const authorIds: string[] = [...new Set(versions.map((v) => v.authorId))];
  const users = await prisma.user.findMany({
    where: { auth_id: { in: authorIds } },
    select: { auth_id: true, name: true },
  });
  const nameMap = new Map(users.map((u) => [u.auth_id, u.name || "Unknown"]));

  return versions.map((v) => ({
    id: v.id,
    versionNumber: v.versionNumber,
    text: v.text,
    changeType: v.changeType as VersionChangeType,
    changeReason: v.changeReason || undefined,
    authorId: v.authorId,
    authorName: nameMap.get(v.authorId) || "Unknown",
    createdAt: v.createdAt,
  }));
}

/**
 * Get a specific version of a claim
 */
export async function getClaimVersion(
  claimId: string,
  versionNumber: number
): Promise<ClaimVersionSummary | null> {
  const version = await prisma.claimVersion.findUnique({
    where: {
      claimId_versionNumber: { claimId, versionNumber },
    },
  });

  if (!version) return null;

  // Get author name
  const user = await prisma.user.findUnique({
    where: { auth_id: version.authorId },
    select: { name: true },
  });

  return {
    id: version.id,
    versionNumber: version.versionNumber,
    text: version.text,
    changeType: version.changeType as VersionChangeType,
    changeReason: version.changeReason || undefined,
    authorId: version.authorId,
    authorName: user?.name || "Unknown",
    createdAt: version.createdAt,
  };
}

/**
 * Compare two versions of a claim
 */
export async function compareClaimVersions(
  claimId: string,
  fromVersion: number,
  toVersion: number
): Promise<{
  from: ClaimVersionSummary | null;
  to: ClaimVersionSummary | null;
  textChanged: boolean;
  typeChanged: boolean;
}> {
  const [from, to] = await Promise.all([
    getClaimVersion(claimId, fromVersion),
    getClaimVersion(claimId, toVersion),
  ]);

  return {
    from,
    to,
    textChanged: from?.text !== to?.text,
    typeChanged: false, // Would compare claim types if stored in version
  };
}

// ─────────────────────────────────────────────────────────
// Origin Management
// ─────────────────────────────────────────────────────────

/**
 * Set claim origin information
 */
export async function setClaimOrigin(
  claimId: string,
  origin: {
    sourceId?: string;
    date?: Date;
    authorId?: string;
  }
) {
  return prisma.claim.update({
    where: { id: claimId },
    data: {
      sourceId: origin.sourceId,
      originDate: origin.date,
      originAuthorId: origin.authorId,
    },
  });
}

/**
 * Get claim origin information
 */
export async function getClaimOrigin(claimId: string): Promise<ClaimOrigin | null> {
  const claim = await prisma.claim.findUnique({
    where: { id: claimId },
    include: {
      source: {
        select: { id: true, title: true, authorsJson: true },
      },
    },
  });

  if (!claim) return null;

  // Get author name if we have an origin author
  let authorName: string | undefined;
  if (claim.originAuthorId) {
    const user = await prisma.user.findUnique({
      where: { auth_id: claim.originAuthorId },
      select: { name: true },
    });
    authorName = user?.name || undefined;
  }

  return {
    sourceId: claim.sourceId || undefined,
    sourceTitle: claim.source?.title || undefined,
    sourceAuthors: claim.source?.authorsJson ? (claim.source.authorsJson as unknown as string[]) : undefined,
    date: claim.originDate ?? claim.createdAt,
    authorId: claim.originAuthorId ?? claim.createdById,
    authorName,
  };
}

// ─────────────────────────────────────────────────────────
// Timeline
// ─────────────────────────────────────────────────────────

/**
 * Get claim timeline (all events in chronological order)
 */
export async function getClaimTimeline(
  claimId: string
): Promise<ClaimTimelineEvent[]> {
  const events: ClaimTimelineEvent[] = [];

  // Get versions
  const versions = await prisma.claimVersion.findMany({
    where: { claimId },
    orderBy: { createdAt: "asc" },
  });

  // Get attacks
  const attacks = await prisma.claimAttack.findMany({
    where: { targetClaimId: claimId },
    include: {
      attackingArgument: {
        select: { id: true, text: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // Get defenses
  const defenses = await prisma.claimDefense.findMany({
    where: { claimId },
    include: {
      defendingArgument: {
        select: { id: true, text: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // Collect all user IDs for name lookup
  const userIds = new Set<string>();
  versions.forEach((v) => userIds.add(v.authorId));
  attacks.forEach((a) => userIds.add(a.createdById));
  defenses.forEach((d) => userIds.add(d.createdById));

  // Get user names
  const users = await prisma.user.findMany({
    where: { auth_id: { in: Array.from(userIds) } },
    select: { auth_id: true, name: true },
  });
  const nameMap = new Map(users.map((u) => [u.auth_id, u.name || "Unknown"]));

  // Add version events
  for (const v of versions) {
    events.push({
      id: `version-${v.id}`,
      type: "version",
      date: v.createdAt,
      actor: {
        id: v.authorId,
        name: nameMap.get(v.authorId) || "Unknown",
      },
      description:
        v.versionNumber === 1
          ? "Claim created"
          : `Claim ${v.changeType.toLowerCase().replace("_", " ")}`,
      details: {
        versionNumber: v.versionNumber,
        changeType: v.changeType,
        changeReason: v.changeReason,
        text: v.text,
      },
    });
  }

  // Add attack events
  for (const a of attacks) {
    events.push({
      id: `attack-${a.id}`,
      type: "attack",
      date: a.createdAt,
      actor: {
        id: a.createdById,
        name: nameMap.get(a.createdById) || "Unknown",
      },
      description: `${a.attackType.toLowerCase()} attack`,
      details: {
        attackId: a.id,
        attackType: a.attackType,
        status: a.status,
        argumentId: a.attackingArgumentId,
        argumentText: a.attackingArgument.text.substring(0, 200),
      },
    });
  }

  // Add defense events
  for (const d of defenses) {
    events.push({
      id: `defense-${d.id}`,
      type: "defense",
      date: d.createdAt,
      actor: {
        id: d.createdById,
        name: nameMap.get(d.createdById) || "Unknown",
      },
      description: `${d.defenseType.toLowerCase().replace("_", " ")} defense`,
      details: {
        defenseId: d.id,
        defenseType: d.defenseType,
        outcome: d.outcome,
        attackId: d.attackId,
        argumentId: d.defendingArgumentId,
        argumentText: d.defendingArgument.text.substring(0, 200),
      },
    });
  }

  // Sort by date
  events.sort((a, b) => a.date.getTime() - b.date.getTime());

  return events;
}

// ─────────────────────────────────────────────────────────
// Consensus Status Management
// ─────────────────────────────────────────────────────────

/**
 * Calculate consensus status based on challenge counts
 */
export function calculateConsensusStatus(
  input: ConsensusCalculationInput
): ConsensusCalculationResult {
  const { challengeCount, openChallenges, defendedCount, concededCount } = input;
  const stalemateCount = input.stalemateCount || 0;

  // No challenges = undetermined
  if (challengeCount === 0) {
    return {
      status: "UNDETERMINED",
      confidence: 0.5,
      reasoning: "No challenges have been raised against this claim.",
    };
  }

  // Majority conceded = rejected
  if (concededCount > challengeCount * 0.5) {
    return {
      status: "REJECTED",
      confidence: concededCount / challengeCount,
      reasoning: `More than half of challenges (${concededCount}/${challengeCount}) have been conceded.`,
    };
  }

  // All defended = accepted
  if (defendedCount === challengeCount && openChallenges === 0) {
    return {
      status: "ACCEPTED",
      confidence: 0.9,
      reasoning: `All ${challengeCount} challenges have been successfully defended.`,
    };
  }

  // Has open challenges = contested
  if (openChallenges > 0) {
    return {
      status: "CONTESTED",
      confidence: openChallenges / challengeCount,
      reasoning: `${openChallenges} of ${challengeCount} challenges remain open.`,
    };
  }

  // More defended than conceded = emerging
  if (defendedCount > concededCount) {
    return {
      status: "EMERGING",
      confidence: defendedCount / challengeCount,
      reasoning: `More challenges defended (${defendedCount}) than conceded (${concededCount}).`,
    };
  }

  // Mixed or stalemate = contested
  return {
    status: "CONTESTED",
    confidence: 0.5,
    reasoning: `Mixed results: ${defendedCount} defended, ${concededCount} conceded, ${stalemateCount} stalemate.`,
  };
}

/**
 * Update consensus status for a claim based on its attacks
 */
export async function updateClaimConsensusStatus(claimId: string) {
  // Get attack statistics
  const attacks = await prisma.claimAttack.findMany({
    where: { targetClaimId: claimId },
    select: { status: true },
  });

  const total = attacks.length;
  const open = attacks.filter((a) => a.status === "OPEN" || a.status === "UNDER_REVIEW").length;
  const defended = attacks.filter((a) =>
    ["DEFENDED", "WITHDRAWN"].includes(a.status)
  ).length;
  const conceded = attacks.filter((a) => a.status === "CONCEDED").length;
  const stalemate = attacks.filter((a) => a.status === "STALEMATE").length;
  const partiallyDefended = attacks.filter((a) => a.status === "PARTIALLY_DEFENDED").length;

  // Calculate new status
  const result = calculateConsensusStatus({
    challengeCount: total,
    openChallenges: open,
    defendedCount: defended,
    concededCount: conceded,
    stalemateCount: stalemate,
  });

  // Update claim
  await prisma.claim.update({
    where: { id: claimId },
    data: {
      challengeCount: total,
      openChallenges: open,
      defendedCount: defended + partiallyDefended,
      concededCount: conceded,
      consensusStatus: result.status,
      consensusUpdatedAt: new Date(),
    },
  });

  return result;
}

/**
 * Get claims by consensus status in a deliberation
 */
export async function getClaimsByConsensusStatus(
  deliberationId: string,
  status: ConsensusStatus | ConsensusStatus[]
): Promise<Array<{ id: string; text: string; consensusStatus: ConsensusStatus }>> {
  const statuses = Array.isArray(status) ? status : [status];

  const claims = await prisma.claim.findMany({
    where: {
      deliberationId,
      consensusStatus: { in: statuses },
    },
    select: {
      id: true,
      text: true,
      consensusStatus: true,
    },
  });

  return claims.map((c) => ({
    ...c,
    consensusStatus: c.consensusStatus as ConsensusStatus,
  }));
}

// ─────────────────────────────────────────────────────────
// Version History Initialization
// ─────────────────────────────────────────────────────────

/**
 * Initialize version history for an existing claim that doesn't have versions
 */
export async function initializeClaimVersionHistory(
  claimId: string,
  userId: string
): Promise<ClaimVersionWithAuthor> {
  const claim = await prisma.claim.findUnique({
    where: { id: claimId },
    include: { versions: true },
  });

  if (!claim) {
    throw new Error("Claim not found");
  }

  if (claim.versions.length > 0) {
    throw new Error("Claim already has version history");
  }

  // Create initial version
  const version = await prisma.$transaction(async (tx) => {
    const v = await tx.claimVersion.create({
      data: {
        claimId,
        text: claim.text,
        claimType: claim.claimType,
        versionNumber: 1,
        changeType: "CREATED",
        authorId: claim.createdById || userId,
        createdAt: claim.createdAt, // Use original creation time
      },
    });

    // Link as current version
    await tx.claim.update({
      where: { id: claimId },
      data: { currentVersionId: v.id },
    });

    return v;
  });

  return {
    ...version,
    changeType: version.changeType as VersionChangeType,
    changedFields: version.changedFields as Record<string, boolean> | null,
  };
}

/**
 * Batch initialize version history for all claims in a deliberation
 */
export async function initializeDeliberationVersionHistory(
  deliberationId: string,
  userId: string
): Promise<{ initialized: number; skipped: number }> {
  // Get all claims without versions
  const claims = await prisma.claim.findMany({
    where: {
      deliberationId,
      currentVersionId: null,
    },
    select: { id: true },
  });

  let initialized = 0;
  let skipped = 0;

  for (const claim of claims) {
    try {
      await initializeClaimVersionHistory(claim.id, userId);
      initialized++;
    } catch {
      skipped++;
    }
  }

  return { initialized, skipped };
}

// ─────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────

/**
 * Check if a claim has any open challenges
 */
export async function hasOpenChallenges(claimId: string): Promise<boolean> {
  const count = await prisma.claimAttack.count({
    where: {
      targetClaimId: claimId,
      status: { in: ["OPEN", "UNDER_REVIEW"] },
    },
  });
  return count > 0;
}

/**
 * Get the current version number of a claim
 */
export async function getCurrentVersionNumber(claimId: string): Promise<number> {
  const claim = await prisma.claim.findUnique({
    where: { id: claimId },
    include: { currentVersion: true },
  });
  return claim?.currentVersion?.versionNumber || 0;
}

/**
 * Revert claim to a previous version
 */
export async function revertClaimToVersion(
  claimId: string,
  versionNumber: number,
  userId: string,
  reason?: string
): Promise<ClaimVersionWithAuthor> {
  const targetVersion = await prisma.claimVersion.findUnique({
    where: {
      claimId_versionNumber: { claimId, versionNumber },
    },
  });

  if (!targetVersion) {
    throw new Error(`Version ${versionNumber} not found for claim`);
  }

  // Create a new version that reverts to the old text
  return createClaimVersion(
    {
      claimId,
      text: targetVersion.text,
      claimType: targetVersion.claimType || undefined,
      changeType: "CORRECTED",
      changeReason: reason || `Reverted to version ${versionNumber}`,
    },
    userId
  );
}
