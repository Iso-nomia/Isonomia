/**
 * Phase 3.1: Canonical Claim Service
 * Manages cross-deliberation claim identity and tracking
 */

import { prisma } from "@/lib/prismaclient";
import {
  CanonicalClaimSummary,
  ClaimInstanceSummary,
  CanonicalClaimWithInstances,
  LinkClaimToCanonicalOptions,
  CreateCanonicalClaimOptions,
  ClaimInstanceType,
  ConsensusStatus,
} from "./types";
import { createHash } from "crypto";

// ─────────────────────────────────────────────────────────
// Canonical Claim Management
// ─────────────────────────────────────────────────────────

/**
 * Create a new canonical claim
 */
export async function createCanonicalClaim(
  options: CreateCanonicalClaimOptions
): Promise<CanonicalClaimSummary> {
  const { slug, title, summary, representativeText, semanticHash } = options;

  // Check for duplicate slug
  const existing = await prisma.canonicalClaim.findUnique({
    where: { slug },
  });

  if (existing) {
    throw new Error(`Canonical claim with slug "${slug}" already exists`);
  }

  const canonical = await prisma.canonicalClaim.create({
    data: {
      slug,
      title,
      summary,
      representativeText,
      semanticHash: semanticHash || generateSemanticHash(representativeText || title),
      totalInstances: 0,
      totalChallenges: 0,
      globalStatus: "UNDETERMINED",
    },
  });

  return {
    id: canonical.id,
    slug: canonical.slug,
    title: canonical.title,
    summary: canonical.summary || undefined,
    representativeText: canonical.representativeText || undefined,
    totalInstances: canonical.totalInstances,
    totalChallenges: canonical.totalChallenges,
    globalStatus: canonical.globalStatus as ConsensusStatus,
    createdAt: canonical.createdAt,
    lastActivityAt: canonical.lastActivityAt,
  };
}

/**
 * Get a canonical claim by ID
 */
export async function getCanonicalClaim(
  canonicalId: string
): Promise<CanonicalClaimSummary | null> {
  const canonical = await prisma.canonicalClaim.findUnique({
    where: { id: canonicalId },
  });

  if (!canonical) return null;

  return {
    id: canonical.id,
    slug: canonical.slug,
    title: canonical.title,
    summary: canonical.summary || undefined,
    representativeText: canonical.representativeText || undefined,
    totalInstances: canonical.totalInstances,
    totalChallenges: canonical.totalChallenges,
    globalStatus: canonical.globalStatus as ConsensusStatus,
    createdAt: canonical.createdAt,
    lastActivityAt: canonical.lastActivityAt,
  };
}

/**
 * Get a canonical claim by slug
 */
export async function getCanonicalClaimBySlug(
  slug: string
): Promise<CanonicalClaimSummary | null> {
  const canonical = await prisma.canonicalClaim.findUnique({
    where: { slug },
  });

  if (!canonical) return null;

  return {
    id: canonical.id,
    slug: canonical.slug,
    title: canonical.title,
    summary: canonical.summary || undefined,
    representativeText: canonical.representativeText || undefined,
    totalInstances: canonical.totalInstances,
    totalChallenges: canonical.totalChallenges,
    globalStatus: canonical.globalStatus as ConsensusStatus,
    createdAt: canonical.createdAt,
    lastActivityAt: canonical.lastActivityAt,
  };
}

/**
 * Get a canonical claim with all its instances
 */
export async function getCanonicalClaimWithInstances(
  canonicalId: string
): Promise<CanonicalClaimWithInstances | null> {
  const canonical = await prisma.canonicalClaim.findUnique({
    where: { id: canonicalId },
    include: {
      instances: {
        include: {
          claim: {
            select: { id: true, text: true },
          },
          deliberation: {
            select: { id: true, title: true },
          },
        },
        orderBy: { linkedAt: "desc" },
      },
    },
  });

  if (!canonical) return null;

  const instances: ClaimInstanceSummary[] = canonical.instances.map((inst) => ({
    id: inst.id,
    claimId: inst.claimId,
    claimText: inst.claim.text,
    deliberationId: inst.deliberationId,
    deliberationTitle: inst.deliberation.title || undefined,
    instanceType: inst.instanceType as ClaimInstanceType,
    localStatus: inst.localStatus as ConsensusStatus,
    linkedAt: inst.linkedAt,
    linkedById: inst.linkedById,
  }));

  return {
    id: canonical.id,
    slug: canonical.slug,
    title: canonical.title,
    summary: canonical.summary || undefined,
    representativeText: canonical.representativeText || undefined,
    totalInstances: canonical.totalInstances,
    totalChallenges: canonical.totalChallenges,
    globalStatus: canonical.globalStatus as ConsensusStatus,
    createdAt: canonical.createdAt,
    lastActivityAt: canonical.lastActivityAt,
    instances,
  };
}

/**
 * Update a canonical claim
 */
export async function updateCanonicalClaim(
  canonicalId: string,
  updates: Partial<CreateCanonicalClaimOptions>
): Promise<CanonicalClaimSummary> {
  const data: Record<string, unknown> = {};

  if (updates.title !== undefined) data.title = updates.title;
  if (updates.summary !== undefined) data.summary = updates.summary;
  if (updates.representativeText !== undefined) {
    data.representativeText = updates.representativeText;
    data.semanticHash = generateSemanticHash(updates.representativeText);
  }

  data.lastActivityAt = new Date();

  const canonical = await prisma.canonicalClaim.update({
    where: { id: canonicalId },
    data,
  });

  return {
    id: canonical.id,
    slug: canonical.slug,
    title: canonical.title,
    summary: canonical.summary || undefined,
    representativeText: canonical.representativeText || undefined,
    totalInstances: canonical.totalInstances,
    totalChallenges: canonical.totalChallenges,
    globalStatus: canonical.globalStatus as ConsensusStatus,
    createdAt: canonical.createdAt,
    lastActivityAt: canonical.lastActivityAt,
  };
}

// ─────────────────────────────────────────────────────────
// Claim Instance Linking
// ─────────────────────────────────────────────────────────

/**
 * Link a claim to a canonical claim
 */
export async function linkClaimToCanonical(
  options: LinkClaimToCanonicalOptions,
  userId: string
): Promise<ClaimInstanceSummary> {
  const { claimId, canonicalClaimId, deliberationId, instanceType } = options;

  // Verify claim exists
  const claim = await prisma.claim.findUnique({
    where: { id: claimId },
    select: { id: true, text: true, consensusStatus: true },
  });

  if (!claim) {
    throw new Error("Claim not found");
  }

  // Verify canonical claim exists
  const canonical = await prisma.canonicalClaim.findUnique({
    where: { id: canonicalClaimId },
  });

  if (!canonical) {
    throw new Error("Canonical claim not found");
  }

  // Check if already linked
  const existing = await prisma.claimInstance.findUnique({
    where: {
      canonicalClaimId_claimId: { canonicalClaimId, claimId },
    },
  });

  if (existing) {
    throw new Error("Claim is already linked to this canonical claim");
  }

  // Create the instance link in a transaction
  const instance = await prisma.$transaction(async (tx) => {
    // Create the instance
    const inst = await tx.claimInstance.create({
      data: {
        canonicalClaimId,
        claimId,
        deliberationId,
        instanceType,
        localStatus: claim.consensusStatus,
        linkedById: userId,
      },
      include: {
        claim: {
          select: { id: true, text: true },
        },
        deliberation: {
          select: { id: true, title: true },
        },
      },
    });

    // Update claim with canonical ID
    await tx.claim.update({
      where: { id: claimId },
      data: { canonicalClaimId },
    });

    // Update canonical claim metrics
    await tx.canonicalClaim.update({
      where: { id: canonicalClaimId },
      data: {
        totalInstances: { increment: 1 },
        lastActivityAt: new Date(),
      },
    });

    return inst;
  });

  return {
    id: instance.id,
    claimId: instance.claimId,
    claimText: instance.claim.text,
    deliberationId: instance.deliberationId,
    deliberationTitle: instance.deliberation.title || undefined,
    instanceType: instance.instanceType as ClaimInstanceType,
    localStatus: instance.localStatus as ConsensusStatus,
    linkedAt: instance.linkedAt,
    linkedById: instance.linkedById,
  };
}

/**
 * Unlink a claim from a canonical claim
 */
export async function unlinkClaimFromCanonical(
  claimId: string,
  canonicalClaimId: string
): Promise<void> {
  const instance = await prisma.claimInstance.findUnique({
    where: {
      canonicalClaimId_claimId: { canonicalClaimId, claimId },
    },
  });

  if (!instance) {
    throw new Error("Claim is not linked to this canonical claim");
  }

  await prisma.$transaction(async (tx) => {
    // Delete the instance
    await tx.claimInstance.delete({
      where: { id: instance.id },
    });

    // Update claim
    await tx.claim.update({
      where: { id: claimId },
      data: { canonicalClaimId: null },
    });

    // Update canonical claim metrics
    await tx.canonicalClaim.update({
      where: { id: canonicalClaimId },
      data: {
        totalInstances: { decrement: 1 },
        lastActivityAt: new Date(),
      },
    });
  });
}

/**
 * Get all instances of a canonical claim
 */
export async function getCanonicalClaimInstances(
  canonicalClaimId: string
): Promise<ClaimInstanceSummary[]> {
  const instances = await prisma.claimInstance.findMany({
    where: { canonicalClaimId },
    include: {
      claim: {
        select: { id: true, text: true },
      },
      deliberation: {
        select: { id: true, title: true },
      },
    },
    orderBy: { linkedAt: "desc" },
  });

  return instances.map((inst) => ({
    id: inst.id,
    claimId: inst.claimId,
    claimText: inst.claim.text,
    deliberationId: inst.deliberationId,
    deliberationTitle: inst.deliberation.title || undefined,
    instanceType: inst.instanceType as ClaimInstanceType,
    localStatus: inst.localStatus as ConsensusStatus,
    linkedAt: inst.linkedAt,
    linkedById: inst.linkedById,
  }));
}

/**
 * Get canonical claims for a claim
 */
export async function getCanonicalClaimsForClaim(
  claimId: string
): Promise<CanonicalClaimSummary | null> {
  const claim = await prisma.claim.findUnique({
    where: { id: claimId },
    include: {
      canonical: true,
    },
  });

  if (!claim?.canonical) return null;

  const canonical = claim.canonical;

  return {
    id: canonical.id,
    slug: canonical.slug,
    title: canonical.title,
    summary: canonical.summary || undefined,
    representativeText: canonical.representativeText || undefined,
    totalInstances: canonical.totalInstances,
    totalChallenges: canonical.totalChallenges,
    globalStatus: canonical.globalStatus as ConsensusStatus,
    createdAt: canonical.createdAt,
    lastActivityAt: canonical.lastActivityAt,
  };
}

// ─────────────────────────────────────────────────────────
// Global Status Calculation
// ─────────────────────────────────────────────────────────

/**
 * Recalculate global status for a canonical claim based on all instances
 */
export async function recalculateGlobalStatus(
  canonicalClaimId: string
): Promise<ConsensusStatus> {
  const instances = await prisma.claimInstance.findMany({
    where: { canonicalClaimId },
    select: { localStatus: true },
  });

  if (instances.length === 0) {
    await prisma.canonicalClaim.update({
      where: { id: canonicalClaimId },
      data: { globalStatus: "UNDETERMINED" },
    });
    return "UNDETERMINED";
  }

  // Count statuses
  const statusCounts: Record<string, number> = {};
  for (const inst of instances) {
    statusCounts[inst.localStatus] = (statusCounts[inst.localStatus] || 0) + 1;
  }

  // Determine global status based on majority
  let globalStatus: ConsensusStatus = "UNDETERMINED";
  const total = instances.length;

  if (statusCounts["ACCEPTED"] && statusCounts["ACCEPTED"] > total * 0.5) {
    globalStatus = "ACCEPTED";
  } else if (statusCounts["REJECTED"] && statusCounts["REJECTED"] > total * 0.5) {
    globalStatus = "REJECTED";
  } else if (statusCounts["CONTESTED"] && statusCounts["CONTESTED"] > 0) {
    globalStatus = "CONTESTED";
  } else if (statusCounts["EMERGING"] && statusCounts["EMERGING"] > 0) {
    globalStatus = "EMERGING";
  }

  await prisma.canonicalClaim.update({
    where: { id: canonicalClaimId },
    data: { globalStatus, lastActivityAt: new Date() },
  });

  return globalStatus;
}

/**
 * Sync local status changes to canonical claim
 * Call this when a claim's consensus status changes
 */
export async function syncLocalStatusToCanonical(claimId: string): Promise<void> {
  const claim = await prisma.claim.findUnique({
    where: { id: claimId },
    select: { id: true, consensusStatus: true, canonicalClaimId: true },
  });

  if (!claim?.canonicalClaimId) return;

  // Update instance local status
  await prisma.claimInstance.updateMany({
    where: {
      claimId,
      canonicalClaimId: claim.canonicalClaimId,
    },
    data: {
      localStatus: claim.consensusStatus,
    },
  });

  // Recalculate global status
  await recalculateGlobalStatus(claim.canonicalClaimId);
}

// ─────────────────────────────────────────────────────────
// Search & Discovery
// ─────────────────────────────────────────────────────────

/**
 * Search canonical claims by text
 */
export async function searchCanonicalClaims(
  query: string,
  options?: {
    limit?: number;
    status?: ConsensusStatus | ConsensusStatus[];
  }
): Promise<CanonicalClaimSummary[]> {
  const whereClause: Record<string, unknown> = {
    OR: [
      { title: { contains: query, mode: "insensitive" } },
      { summary: { contains: query, mode: "insensitive" } },
      { representativeText: { contains: query, mode: "insensitive" } },
    ],
  };

  if (options?.status) {
    whereClause.globalStatus = Array.isArray(options.status)
      ? { in: options.status }
      : options.status;
  }

  const canonicals = await prisma.canonicalClaim.findMany({
    where: whereClause,
    take: options?.limit || 20,
    orderBy: [{ totalInstances: "desc" }, { lastActivityAt: "desc" }],
  });

  return canonicals.map((c) => ({
    id: c.id,
    slug: c.slug,
    title: c.title,
    summary: c.summary || undefined,
    representativeText: c.representativeText || undefined,
    totalInstances: c.totalInstances,
    totalChallenges: c.totalChallenges,
    globalStatus: c.globalStatus as ConsensusStatus,
    createdAt: c.createdAt,
    lastActivityAt: c.lastActivityAt,
  }));
}

/**
 * Find semantically similar canonical claims
 */
export async function findSimilarCanonicalClaims(
  text: string,
  limit: number = 5
): Promise<CanonicalClaimSummary[]> {
  const hash = generateSemanticHash(text);

  // For now, we'll use exact hash matching
  // In production, this would use vector similarity or fuzzy matching
  const exact = await prisma.canonicalClaim.findFirst({
    where: { semanticHash: hash },
  });

  if (exact) {
    return [
      {
        id: exact.id,
        slug: exact.slug,
        title: exact.title,
        summary: exact.summary || undefined,
        representativeText: exact.representativeText || undefined,
        totalInstances: exact.totalInstances,
        totalChallenges: exact.totalChallenges,
        globalStatus: exact.globalStatus as ConsensusStatus,
        createdAt: exact.createdAt,
        lastActivityAt: exact.lastActivityAt,
      },
    ];
  }

  // Fallback to text search
  return searchCanonicalClaims(text.substring(0, 100), { limit });
}

/**
 * Get or create a canonical claim for a given text
 */
export async function getOrCreateCanonicalClaim(
  text: string,
  title?: string
): Promise<CanonicalClaimSummary> {
  const hash = generateSemanticHash(text);

  // Check for existing
  const existing = await prisma.canonicalClaim.findFirst({
    where: { semanticHash: hash },
  });

  if (existing) {
    return {
      id: existing.id,
      slug: existing.slug,
      title: existing.title,
      summary: existing.summary || undefined,
      representativeText: existing.representativeText || undefined,
      totalInstances: existing.totalInstances,
      totalChallenges: existing.totalChallenges,
      globalStatus: existing.globalStatus as ConsensusStatus,
      createdAt: existing.createdAt,
      lastActivityAt: existing.lastActivityAt,
    };
  }

  // Create new
  const slug = generateSlug(title || text);
  return createCanonicalClaim({
    slug,
    title: title || text.substring(0, 100),
    representativeText: text,
    semanticHash: hash,
  });
}

// ─────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────

/**
 * Generate a semantic hash for text (normalized)
 */
function generateSemanticHash(text: string): string {
  const normalized = text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return createHash("sha256").update(normalized).digest("hex").substring(0, 32);
}

/**
 * Generate a URL-safe slug from text
 */
function generateSlug(text: string): string {
  const base = text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .substring(0, 50)
    .replace(/-+$/, "");

  const timestamp = Date.now().toString(36);
  return `${base}-${timestamp}`;
}

/**
 * Get statistics for canonical claims
 */
export async function getCanonicalClaimStats(): Promise<{
  total: number;
  byStatus: Record<string, number>;
  avgInstances: number;
  mostInstances: { slug: string; count: number } | null;
}> {
  const total = await prisma.canonicalClaim.count();

  const byStatusRaw = await prisma.canonicalClaim.groupBy({
    by: ["globalStatus"],
    _count: true,
  });

  const byStatus: Record<string, number> = {};
  for (const row of byStatusRaw) {
    byStatus[row.globalStatus] = row._count;
  }

  const avgResult = await prisma.canonicalClaim.aggregate({
    _avg: { totalInstances: true },
  });

  const topInstance = await prisma.canonicalClaim.findFirst({
    orderBy: { totalInstances: "desc" },
    select: { slug: true, totalInstances: true },
  });

  return {
    total,
    byStatus,
    avgInstances: avgResult._avg.totalInstances || 0,
    mostInstances: topInstance
      ? { slug: topInstance.slug, count: topInstance.totalInstances }
      : null,
  };
}
