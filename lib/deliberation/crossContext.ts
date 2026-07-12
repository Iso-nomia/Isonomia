/**
 * CrossDeliberationContext — Track AI-EPI Pt. 4 §7.
 *
 * Cold-start defense. A thin local deliberation can borrow density from
 * cross-room appearances of the same canonical claim. This module
 * exposes a *read-only, structured projection* of the canonical-claim
 * registry for one deliberation; full plexus-edge typing is deferred to
 * sprint 2 (roadmap §10).
 *
 * Hard invariants (matches the rest of the Pt. 4 substrate):
 *   - No free-prose fields. `aggregateAcceptance` is a deterministic
 *     fold over `localStatus` enums; the consumer (DeliberationStateCard,
 *     SyntheticReadout, MCP) reads it without reinterpreting.
 *   - Empty arrays / zero counts are *first-class results*, not errors.
 *     A deliberation with no canonical-claim links returns
 *     `canonicalFamilies: []`. Consumers must distinguish "no link" from
 *     "link exists but appears only here".
 *
 * Author: AI-EPI Pt. 4 §7
 */

import { prisma } from "@/lib/prismaclient";
import type { ConsensusStatus } from "@prisma/client";

// ============================================================
// TYPES
// ============================================================

/**
 * Five-valued aggregate over `localStatus` across all sibling
 * appearances of a canonical claim.
 *
 *   - `consistent-IN`  every sibling is ACCEPTED or EMERGING
 *   - `consistent-OUT` every sibling is REJECTED
 *   - `contested`      siblings disagree (any IN ↔ any OUT, or any CONTESTED)
 *   - `undecided`      every sibling is UNDETERMINED or SUPERSEDED
 */
export type CrossAggregateAcceptance =
  | "consistent-IN"
  | "consistent-OUT"
  | "contested"
  | "undecided";

export interface CanonicalAppearance {
  deliberationId: string;
  deliberationTitle: string | null;
  claimId: string;
  /** The local label this room used for the canonical claim. */
  localLabel: string;
  /** Local consensus status, or "unknown" if absent. */
  localStatus: ConsensusStatus | "unknown";
}

export interface CanonicalFamilyEntry {
  canonicalClaimId: string;
  canonicalSlug: string;
  canonicalTitle: string;
  /** The local claim id in *this* deliberation that anchors the family. */
  localClaimId: string;
  /** The local label used in this deliberation. */
  localLabel: string;
  /** Local status in this deliberation. */
  localStatus: ConsensusStatus | "unknown";
  /** Sibling appearances (excludes the local instance). */
  appearances: CanonicalAppearance[];
  /** Deterministic fold across all appearances *including* the local one. */
  aggregateAcceptance: CrossAggregateAcceptance;
}

export interface CrossDeliberationContext {
  deliberationId: string;
  /** Empty if no claim in this deliberation links to a canonical claim. */
  canonicalFamilies: CanonicalFamilyEntry[];
  /**
   * Rough count of cross-deliberation argument-import edges touching
   * this room. Source: `ArgumentImport`. Includes both materialized and
   * virtual imports.
   */
  plexusEdgesIn: {
    incomingImports: number;
    outgoingImports: number;
  };
  /**
   * Counts of argument-imports keyed by sibling deliberation id.
   * Useful for the consumer to surface a "borrowed from" list.
   */
  argumentImports: {
    incomingByDeliberationId: Record<string, number>;
    outgoingByDeliberationId: Record<string, number>;
  };
  /**
   * Fold over sibling deliberations' scheme distributions. Counts how
   * many *sibling* arguments use each scheme key; tells the consumer
   * which catalog moves the canonical-claim family has already
   * exercised elsewhere.
   */
  schemeReuseAcrossRooms: Record<string, number>;
  /** ISO timestamp this projection was materialized. */
  computedAt: string;
}

// ============================================================
// HELPERS
// ============================================================

function statusBucket(s: ConsensusStatus | "unknown"): "in" | "out" | "contested" | "undecided" {
  switch (s) {
    case "ACCEPTED":
    case "EMERGING":
      return "in";
    case "REJECTED":
      return "out";
    case "CONTESTED":
      return "contested";
    default:
      return "undecided";
  }
}

function aggregateOver(
  statuses: Array<ConsensusStatus | "unknown">,
): CrossAggregateAcceptance {
  if (statuses.length === 0) return "undecided";
  const buckets = new Set(statuses.map(statusBucket));
  if (buckets.has("contested")) return "contested";
  const hasIn = buckets.has("in");
  const hasOut = buckets.has("out");
  if (hasIn && hasOut) return "contested";
  if (hasIn && !hasOut) return "consistent-IN";
  if (hasOut && !hasIn) return "consistent-OUT";
  return "undecided";
}

// ============================================================
// MAIN
// ============================================================

export async function computeCrossDeliberationContext(
  deliberationId: string,
): Promise<CrossDeliberationContext | null> {
  // Verify the deliberation exists (matches sibling modules' contract:
  // null result = 404 at the route layer).
  const exists = await prisma.deliberation.findUnique({
    where: { id: deliberationId },
    select: { id: true },
  });
  if (!exists) return null;

  // ────────────────────────────────────────────────────────────
  // Step 1 — local claims with a canonical-claim link.
  // ────────────────────────────────────────────────────────────
  const localLinkedClaims = await prisma.claim.findMany({
    where: {
      deliberationId,
      canonicalClaimId: { not: null },
    },
    select: {
      id: true,
      text: true,
      consensusStatus: true,
      canonicalClaimId: true,
    },
  });

  const canonicalIds = Array.from(
    new Set(
      localLinkedClaims
        .map((c) => c.canonicalClaimId)
        .filter((x): x is string => !!x),
    ),
  );

  // ────────────────────────────────────────────────────────────
  // Step 2 — fetch canonical-claim families and all their instances.
  // ────────────────────────────────────────────────────────────
  const canonicalFamilies: CanonicalFamilyEntry[] = [];
  let siblingDeliberationIds = new Set<string>();

  if (canonicalIds.length > 0) {
    const canonicalRows = await prisma.canonicalClaim.findMany({
      where: { id: { in: canonicalIds } },
      select: {
        id: true,
        slug: true,
        title: true,
        instances: {
          select: {
            claimId: true,
            deliberationId: true,
            localStatus: true,
            claim: { select: { text: true, consensusStatus: true } },
            deliberation: { select: { title: true } },
          },
        },
      },
    });

    const localByCanonical = new Map<
      string,
      { id: string; text: string; consensusStatus: ConsensusStatus }
    >();
    for (const c of localLinkedClaims) {
      if (c.canonicalClaimId) {
        localByCanonical.set(c.canonicalClaimId, {
          id: c.id,
          text: c.text,
          consensusStatus: c.consensusStatus,
        });
      }
    }

    for (const fam of canonicalRows) {
      const local = localByCanonical.get(fam.id);
      if (!local) continue; // shouldn't happen

      const appearances: CanonicalAppearance[] = [];
      const allStatuses: Array<ConsensusStatus | "unknown"> = [
        local.consensusStatus,
      ];

      for (const inst of fam.instances) {
        if (inst.claimId === local.id) continue; // skip self
        siblingDeliberationIds.add(inst.deliberationId);
        const status: ConsensusStatus | "unknown" =
          inst.claim?.consensusStatus ?? inst.localStatus ?? "unknown";
        allStatuses.push(status);
        appearances.push({
          deliberationId: inst.deliberationId,
          deliberationTitle: inst.deliberation?.title ?? null,
          claimId: inst.claimId,
          localLabel: inst.claim?.text ?? "",
          localStatus: status,
        });
      }

      canonicalFamilies.push({
        canonicalClaimId: fam.id,
        canonicalSlug: fam.slug,
        canonicalTitle: fam.title,
        localClaimId: local.id,
        localLabel: local.text,
        localStatus: local.consensusStatus,
        appearances,
        aggregateAcceptance: aggregateOver(allStatuses),
      });
    }
  }

  // ────────────────────────────────────────────────────────────
  // Step 3 — plexus edges in/out via ArgumentImport.
  // ────────────────────────────────────────────────────────────
  const [incomingImports, outgoingImports] = await Promise.all([
    prisma.argumentImport.findMany({
      where: { toDeliberationId: deliberationId },
      select: { fromDeliberationId: true },
    }),
    prisma.argumentImport.findMany({
      where: { fromDeliberationId: deliberationId },
      select: { toDeliberationId: true },
    }),
  ]);

  const incomingByDeliberationId: Record<string, number> = {};
  for (const r of incomingImports) {
    incomingByDeliberationId[r.fromDeliberationId] =
      (incomingByDeliberationId[r.fromDeliberationId] ?? 0) + 1;
    siblingDeliberationIds.add(r.fromDeliberationId);
  }
  const outgoingByDeliberationId: Record<string, number> = {};
  for (const r of outgoingImports) {
    outgoingByDeliberationId[r.toDeliberationId] =
      (outgoingByDeliberationId[r.toDeliberationId] ?? 0) + 1;
    siblingDeliberationIds.add(r.toDeliberationId);
  }

  // Drop the local id if it leaked in.
  siblingDeliberationIds.delete(deliberationId);

  // ────────────────────────────────────────────────────────────
  // Step 4 — schemeReuseAcrossRooms across sibling deliberations.
  // ────────────────────────────────────────────────────────────
  const schemeReuseAcrossRooms: Record<string, number> = {};
  if (siblingDeliberationIds.size > 0) {
    const siblingArgs = await prisma.argument.findMany({
      where: { deliberationId: { in: Array.from(siblingDeliberationIds) } },
      select: { id: true },
    });
    const siblingArgIds = siblingArgs.map((a) => a.id);
    if (siblingArgIds.length > 0) {
      const siblingSchemes = await prisma.argumentSchemeInstance.findMany({
        where: { argumentId: { in: siblingArgIds } },
        select: { scheme: { select: { key: true } } },
      });
      for (const s of siblingSchemes) {
        const key = s.scheme?.key ?? "unknown";
        schemeReuseAcrossRooms[key] = (schemeReuseAcrossRooms[key] ?? 0) + 1;
      }
    }
  }

  return {
    deliberationId,
    canonicalFamilies,
    plexusEdgesIn: {
      incomingImports: incomingImports.length,
      outgoingImports: outgoingImports.length,
    },
    argumentImports: {
      incomingByDeliberationId,
      outgoingByDeliberationId,
    },
    schemeReuseAcrossRooms,
    computedAt: new Date().toISOString(),
  };
}
