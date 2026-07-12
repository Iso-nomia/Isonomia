/**
 * Phase 3.3: Canonical Registry Service
 * Manages canonical claim registry for cross-deliberation mapping.
 * 
 * This service builds on top of the existing canonicalClaimService in lib/provenance/
 * and adds cross-deliberation specific operations like equivalence mapping,
 * field-aware search, and global status aggregation.
 */

import { prisma } from "@/lib/prismaclient";
import crypto from "crypto";
import {
  CanonicalClaimSummary,
  CanonicalClaimSearchParams,
  EquivalenceType,
  ClaimEquivalenceSummary,
} from "./types";

// ─────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────

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
 * Generate semantic hash for similarity matching
 */
function generateSemanticHash(text: string): string {
  const normalized = text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 32);
}

// ─────────────────────────────────────────────────────────
// Canonical Claim Registration
// ─────────────────────────────────────────────────────────

/**
 * Register or find a canonical claim from an existing claim.
 * Links the claim to a canonical representation for cross-deliberation tracking.
 */
export async function findOrCreateCanonicalClaim(
  claimId: string,
  userId: string,
  field?: string
): Promise<CanonicalClaimSummary> {
  const claim = await prisma.claim.findUnique({
    where: { id: claimId },
    include: {
      deliberation: { select: { id: true, title: true } },
    },
  });

  if (!claim) throw new Error("Claim not found");

  // Check if already linked to a canonical claim
  if (claim.canonicalClaimId) {
    const existing = await prisma.canonicalClaim.findUnique({
      where: { id: claim.canonicalClaimId },
      include: {
        instances: {
          include: {
            claim: { select: { id: true, text: true, consensusStatus: true } },
            deliberation: { select: { id: true, title: true } },
          },
          take: 5,
        },
      },
    });
    if (existing) return formatCanonicalSummary(existing, existing.instances);
  }

  // Check for similar existing canonical claims via semantic hash
  const semanticHash = generateSemanticHash(claim.text);
  const similar = await prisma.canonicalClaim.findFirst({
    where: { semanticHash },
  });

  if (similar) {
    // Link this claim to the existing canonical
    await linkClaimToCanonical(claimId, similar.id, "EQUIVALENT", userId);
    const refreshed = await prisma.canonicalClaim.findUnique({
      where: { id: similar.id },
      include: {
        instances: {
          include: {
            claim: { select: { id: true, text: true, consensusStatus: true } },
            deliberation: { select: { id: true, title: true } },
          },
          take: 5,
        },
      },
    });
    return formatCanonicalSummary(refreshed!, refreshed!.instances);
  }

  // Create a new canonical claim
  const slug = generateSlug(claim.text);

  const canonical = await prisma.$transaction(async (tx) => {
    const created = await tx.canonicalClaim.create({
      data: {
        slug,
        title: claim.text.substring(0, 100),
        representativeText: claim.text,
        semanticHash,
        primaryField: field,
        totalInstances: 1,
      },
    });

    // Update the local claim
    await tx.claim.update({
      where: { id: claimId },
      data: { canonicalClaimId: created.id },
    });

    // Create the first instance record
    await tx.claimInstance.create({
      data: {
        canonicalClaimId: created.id,
        claimId,
        deliberationId: claim.deliberationId!,
        instanceType: "ORIGINAL",
        localStatus: claim.consensusStatus || "UNDETERMINED",
        linkedById: userId,
      },
    });

    return created;
  });

  return formatCanonicalSummary(canonical, [
    {
      id: "initial",
      claim: { id: claim.id, text: claim.text, consensusStatus: claim.consensusStatus },
      deliberation: claim.deliberation!,
      instanceType: "ORIGINAL",
      localStatus: claim.consensusStatus || "UNDETERMINED",
    },
  ]);
}

/**
 * Link an existing claim to an existing canonical claim
 */
export async function linkClaimToCanonical(
  claimId: string,
  canonicalClaimId: string,
  instanceType: "EQUIVALENT" | "IMPORTED" | "FORKED" | "DERIVED",
  userId: string,
  variationNotes?: string
) {
  const claim = await prisma.claim.findUnique({
    where: { id: claimId },
    include: { deliberation: { select: { id: true } } },
  });

  if (!claim) throw new Error("Claim not found");

  const canonical = await prisma.canonicalClaim.findUnique({
    where: { id: canonicalClaimId },
  });

  if (!canonical) throw new Error("Canonical claim not found");

  // Check for existing link
  const existingLink = await prisma.claimInstance.findFirst({
    where: { claimId, canonicalClaimId: canonical.id },
  });

  if (existingLink) {
    return existingLink;
  }

  return prisma.$transaction(async (tx) => {
    // Update the local claim
    await tx.claim.update({
      where: { id: claimId },
      data: { canonicalClaimId: canonical.id },
    });

    // Create instance record
    const instance = await tx.claimInstance.create({
      data: {
        canonicalClaimId: canonical.id,
        claimId,
        deliberationId: claim.deliberationId!,
        instanceType,
        localStatus: claim.consensusStatus || "UNDETERMINED",
        linkedById: userId,
        variationNotes,
      },
    });

    // Update canonical metrics
    await tx.canonicalClaim.update({
      where: { id: canonical.id },
      data: {
        totalInstances: { increment: 1 },
        lastActivityAt: new Date(),
      },
    });

    return instance;
  });
}

// ─────────────────────────────────────────────────────────
// Search & Discovery
// ─────────────────────────────────────────────────────────

/**
 * Search canonical claims with field/status filtering
 */
export async function searchCanonicalClaims(
  params: CanonicalClaimSearchParams,
  limit = 20
): Promise<CanonicalClaimSummary[]> {
  const where: Record<string, unknown> = {};

  if (params.query) {
    where.OR = [
      { title: { contains: params.query, mode: "insensitive" } },
      { representativeText: { contains: params.query, mode: "insensitive" } },
    ];
  }

  if (params.field) {
    where.primaryField = params.field;
  }

  if (params.globalStatus) {
    where.globalStatus = params.globalStatus;
  }

  if (params.minInstances) {
    where.totalInstances = { gte: params.minInstances };
  }

  const canonicals = await prisma.canonicalClaim.findMany({
    where,
    include: {
      instances: {
        include: {
          claim: {
            select: {
              id: true,
              text: true,
              consensusStatus: true,
            },
          },
          deliberation: {
            select: {
              id: true,
              title: true,
            },
          },
        },
        take: 5,
      },
    },
    orderBy: { totalInstances: "desc" },
    take: limit,
  });

  return canonicals.map((c) => formatCanonicalSummary(c, c.instances));
}

/**
 * Find claims similar to given text
 */
export async function findSimilarClaims(
  text: string,
  excludeDeliberationId?: string,
  limit = 10
): Promise<CanonicalClaimSummary[]> {
  const semanticHash = generateSemanticHash(text);

  // First try exact semantic match
  const exactMatches = await prisma.canonicalClaim.findMany({
    where: {
      semanticHash,
      instances: excludeDeliberationId
        ? { none: { deliberationId: excludeDeliberationId } }
        : undefined,
    },
    include: {
      instances: {
        include: {
          claim: { select: { id: true, text: true, consensusStatus: true } },
          deliberation: { select: { id: true, title: true } },
        },
        take: 5,
      },
    },
    take: limit,
  });

  if (exactMatches.length >= limit) {
    return exactMatches.map((c) => formatCanonicalSummary(c, c.instances));
  }

  // Fall back to text search
  const textMatches = await prisma.canonicalClaim.findMany({
    where: {
      AND: [
        {
          OR: [
            { title: { contains: text.substring(0, 50), mode: "insensitive" } },
            { representativeText: { contains: text.substring(0, 50), mode: "insensitive" } },
          ],
        },
        { NOT: { semanticHash } },
      ],
    },
    include: {
      instances: {
        include: {
          claim: { select: { id: true, text: true, consensusStatus: true } },
          deliberation: { select: { id: true, title: true } },
        },
        take: 5,
      },
    },
    take: limit - exactMatches.length,
  });

  return [...exactMatches, ...textMatches].map((c) =>
    formatCanonicalSummary(c, c.instances)
  );
}

// ─────────────────────────────────────────────────────────
// Claim Equivalence Management
// ─────────────────────────────────────────────────────────

/**
 * Create equivalence between two canonical claims
 */
export async function createClaimEquivalence(
  primaryCanonicalId: string,
  equivalentCanonicalId: string,
  equivalenceType: EquivalenceType,
  userId: string,
  notes?: string,
  confidence = 0.5
) {
  // Verify both canonical claims exist
  const [primary, equivalent] = await Promise.all([
    prisma.canonicalClaim.findUnique({ where: { id: primaryCanonicalId } }),
    prisma.canonicalClaim.findUnique({ where: { id: equivalentCanonicalId } }),
  ]);

  if (!primary || !equivalent) {
    throw new Error("One or both canonical claims not found");
  }

  return (prisma as any).claimEquivalence.create({
    data: {
      primaryClaimId: primary.id,
      equivalentClaimId: equivalent.id,
      equivalenceType,
      confidence,
      notes,
      createdById: userId,
    },
  });
}

/**
 * Get equivalences for a canonical claim
 */
export async function getClaimEquivalences(
  canonicalClaimId: string
): Promise<ClaimEquivalenceSummary[]> {
  const [asSource, asTarget] = await Promise.all([
    (prisma as any).claimEquivalence.findMany({
      where: { primaryClaimId: canonicalClaimId },
      include: {
        equivalentClaim: {
          select: { id: true, slug: true, representativeText: true, globalStatus: true },
        },
      },
    }),
    (prisma as any).claimEquivalence.findMany({
      where: { equivalentClaimId: canonicalClaimId },
      include: {
        primaryClaim: {
          select: { id: true, slug: true, representativeText: true, globalStatus: true },
        },
      },
    }),
  ]);

  const results: ClaimEquivalenceSummary[] = [];

  for (const eq of asSource) {
    results.push({
      id: eq.id,
      equivalenceType: eq.equivalenceType as EquivalenceType,
      confidence: eq.confidence,
      isVerified: eq.isVerified,
      notes: eq.notes || undefined,
      claim: {
        id: eq.equivalentClaim.id,
        slug: eq.equivalentClaim.slug,
        representativeText: eq.equivalentClaim.representativeText || undefined,
        globalStatus: eq.equivalentClaim.globalStatus,
      },
    });
  }

  for (const eq of asTarget) {
    results.push({
      id: eq.id,
      equivalenceType: eq.equivalenceType as EquivalenceType,
      confidence: eq.confidence,
      isVerified: eq.isVerified,
      notes: eq.notes || undefined,
      claim: {
        id: eq.primaryClaim.id,
        slug: eq.primaryClaim.slug,
        representativeText: eq.primaryClaim.representativeText || undefined,
        globalStatus: eq.primaryClaim.globalStatus,
      },
    });
  }

  return results;
}

// ─────────────────────────────────────────────────────────
// Global Status Aggregation
// ─────────────────────────────────────────────────────────

/**
 * Update global status based on all instances across deliberations
 */
export async function updateGlobalStatus(canonicalClaimId: string) {
  const canonical = await prisma.canonicalClaim.findUnique({
    where: { id: canonicalClaimId },
    include: {
      instances: {
        include: {
          claim: { select: { consensusStatus: true, challengeCount: true } },
        },
      },
    },
  });

  if (!canonical) return;

  const statuses = canonical.instances.map(
    (i) => i.claim.consensusStatus || "UNDETERMINED"
  );
  const totalChallenges = canonical.instances.reduce(
    (sum, i) => sum + (i.claim.challengeCount || 0),
    0
  );

  // Determine global status
  let globalStatus = "UNDETERMINED";
  const acceptedCount = statuses.filter((s) => s === "ACCEPTED").length;
  const rejectedCount = statuses.filter((s) => s === "REJECTED").length;
  const contestedCount = statuses.filter((s) => s === "CONTESTED").length;
  const total = statuses.length;

  if (total === 0) {
    globalStatus = "UNDETERMINED";
  } else if (contestedCount > 0 || (acceptedCount > 0 && rejectedCount > 0)) {
    globalStatus = "CONTESTED";
  } else if (acceptedCount === total) {
    globalStatus = "ACCEPTED";
  } else if (rejectedCount === total) {
    globalStatus = "REJECTED";
  } else if (acceptedCount > rejectedCount) {
    globalStatus = "EMERGING";
  }

  await prisma.canonicalClaim.update({
    where: { id: canonicalClaimId },
    data: {
      globalStatus: globalStatus as "UNDETERMINED" | "EMERGING" | "ACCEPTED" | "CONTESTED" | "REJECTED" | "SUPERSEDED",
      totalChallenges,
      lastActivityAt: new Date(),
    },
  });
}

// ─────────────────────────────────────────────────────────
// Formatting
// ─────────────────────────────────────────────────────────

/**
 * Format canonical claim for API response
 */
function formatCanonicalSummary(
  canonical: {
    id: string;
    slug: string;
    title: string;
    representativeText: string | null;
    globalStatus: string;
    totalInstances: number;
    totalChallenges: number;
    primaryField?: string | null;
  },
  instances: Array<{
    id?: string;
    claimId?: string;
    claim?: { id: string; text: string; consensusStatus?: string | null };
    deliberation?: { id: string; title: string | null } | null;
    instanceType: string;
    localStatus?: string | null;
    variationNotes?: string | null;
  }>
): CanonicalClaimSummary {
  return {
    id: canonical.id,
    slug: canonical.slug,
    title: canonical.title,
    representativeText: canonical.representativeText || undefined,
    globalStatus: canonical.globalStatus,
    totalInstances: canonical.totalInstances,
    totalChallenges: canonical.totalChallenges,
    primaryField: canonical.primaryField || undefined,
    instances: instances.map((inst) => ({
      id: inst.id || inst.claim?.id || "",
      claimId: inst.claimId || inst.claim?.id || "",
      claimText: inst.claim?.text || "",
      deliberation: {
        id: inst.deliberation?.id || "",
        title: inst.deliberation?.title || "",
      },
      instanceType: inst.instanceType,
      localStatus: inst.localStatus || inst.claim?.consensusStatus || undefined,
      variationNotes: inst.variationNotes || undefined,
    })),
  };
}
