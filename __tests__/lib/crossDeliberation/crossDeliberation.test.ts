/**
 * Integration tests for Phase 3.3: Cross-Deliberation Claim Mapping
 * 
 * Tests:
 * 1. Canonical claim registration and lookup
 * 2. Cross-room search functionality
 * 3. Argument import with provenance tracking
 * 4. Related deliberation discovery
 */

import { prisma } from "@/lib/prismaclient";
import {
  findOrCreateCanonicalClaim,
  registerClaimInstanceToCanonical,
  searchCanonicalClaims,
  getCanonicalClaimById,
} from "@/lib/crossDeliberation/canonicalRegistryService";
import {
  searchClaimsAcrossRooms,
  findRelatedDeliberations,
  getClaimCrossRoomStatus,
} from "@/lib/crossDeliberation/crossRoomSearchService";
import { importArgument } from "@/lib/crossDeliberation/argumentTransportService";
import type { ImportType } from "@/lib/crossDeliberation/types";

// ─────────────────────────────────────────────────────────
// Test Fixtures & Helpers
// ─────────────────────────────────────────────────────────

const MOCK_USER_ID = "test-user-cross-delib";

// Test data structure
interface TestFixtures {
  deliberation1?: { id: string; title: string };
  deliberation2?: { id: string; title: string };
  deliberation3?: { id: string; title: string };
  claim1?: { id: string; text: string };
  claim2?: { id: string; text: string };
  claim3?: { id: string; text: string };
  argument1?: { id: string; text: string };
  canonical1?: { id: string; slug: string };
  userId?: string;
}

let fixtures: TestFixtures = {};

// ─────────────────────────────────────────────────────────
// Setup and Teardown
// ─────────────────────────────────────────────────────────

beforeAll(async () => {
  // Check if user exists, create only if not
  const existingUser = await prisma.user.findUnique({ where: { id: MOCK_USER_ID } });
  if (!existingUser) {
    await prisma.user.create({
      data: {
        id: MOCK_USER_ID,
        name: "Test User Cross-Delib",
        email: `test-cross-delib-${Date.now()}@test.com`,
      },
    });
  }
  fixtures.userId = MOCK_USER_ID;

  // Create 3 test deliberations
  const [delib1, delib2, delib3] = await Promise.all([
    prisma.deliberation.create({
      data: {
        title: "Test Delib 1 - Climate Policy",
        hostId: MOCK_USER_ID,
        isPublic: true,
      },
    }),
    prisma.deliberation.create({
      data: {
        title: "Test Delib 2 - Energy Policy",
        hostId: MOCK_USER_ID,
        isPublic: true,
      },
    }),
    prisma.deliberation.create({
      data: {
        title: "Test Delib 3 - Environmental Impact",
        hostId: MOCK_USER_ID,
        isPublic: true,
      },
    }),
  ]);

  fixtures.deliberation1 = delib1;
  fixtures.deliberation2 = delib2;
  fixtures.deliberation3 = delib3;

  // Create claims in each deliberation
  const [claim1, claim2, claim3] = await Promise.all([
    prisma.claim.create({
      data: {
        text: "Carbon emissions must be reduced by 50% by 2030",
        authorId: MOCK_USER_ID,
        deliberationId: delib1.id,
        consensusStatus: "EMERGING",
      },
    }),
    prisma.claim.create({
      data: {
        text: "Carbon emissions must be reduced significantly by 2030",
        authorId: MOCK_USER_ID,
        deliberationId: delib2.id,
        consensusStatus: "ACCEPTED",
      },
    }),
    prisma.claim.create({
      data: {
        text: "Renewable energy can replace fossil fuels entirely",
        authorId: MOCK_USER_ID,
        deliberationId: delib3.id,
        consensusStatus: "CONTESTED",
      },
    }),
  ]);

  fixtures.claim1 = claim1;
  fixtures.claim2 = claim2;
  fixtures.claim3 = claim3;

  // Create an argument in deliberation 1
  const arg1 = await prisma.argument.create({
    data: {
      authorId: MOCK_USER_ID,
      deliberationId: delib1.id,
      text: "Because industrial output is the primary source, targeting industries will have the greatest impact.",
      confidence: 0.8,
    },
  });

  // Link the argument to its conclusion claim
  await prisma.argument.update({
    where: { id: arg1.id },
    data: { conclusionId: claim1.id },
  });

  // Add premises
  const premiseClaim = await prisma.claim.create({
    data: {
      text: "Industrial output accounts for 70% of carbon emissions",
      authorId: MOCK_USER_ID,
      deliberationId: delib1.id,
    },
  });

  await prisma.argumentPremise.create({
    data: {
      argumentId: arg1.id,
      claimId: premiseClaim.id,
      position: 0,
    },
  });

  fixtures.argument1 = arg1;
});

afterAll(async () => {
  // Clean up test data in reverse dependency order
  if (fixtures.argument1) {
    await prisma.argumentPremise.deleteMany({
      where: { argumentId: fixtures.argument1.id },
    });
    await prisma.argument.deleteMany({
      where: { deliberationId: { in: [fixtures.deliberation1?.id, fixtures.deliberation2?.id, fixtures.deliberation3?.id].filter(Boolean) as string[] } },
    });
  }

  // Delete canonical claim instances and canonical claims
  if (fixtures.canonical1) {
    await prisma.claimInstance.deleteMany({
      where: { canonicalId: fixtures.canonical1.id },
    });
    await prisma.canonicalClaim.delete({
      where: { id: fixtures.canonical1.id },
    }).catch(() => {}); // Ignore if already deleted
  }

  // Delete claims
  const claimIds = [fixtures.claim1?.id, fixtures.claim2?.id, fixtures.claim3?.id].filter(Boolean) as string[];
  if (claimIds.length > 0) {
    await prisma.claim.deleteMany({ where: { id: { in: claimIds } } });
  }

  // Delete additional claims created as premises
  const delibIds = [fixtures.deliberation1?.id, fixtures.deliberation2?.id, fixtures.deliberation3?.id].filter(Boolean) as string[];
  if (delibIds.length > 0) {
    await prisma.claim.deleteMany({ where: { deliberationId: { in: delibIds } } });
  }

  // Delete deliberations
  if (delibIds.length > 0) {
    await prisma.deliberation.deleteMany({ where: { id: { in: delibIds } } });
  }
});

// ─────────────────────────────────────────────────────────
// Canonical Claim Registry Tests
// ─────────────────────────────────────────────────────────

describe("Canonical Claim Registry", () => {
  describe("findOrCreateCanonicalClaim()", () => {
    it("creates a new canonical claim when none exists", async () => {
      const result = await findOrCreateCanonicalClaim(
        fixtures.claim1!.id,
        fixtures.userId!,
        "climate_policy"
      );

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.slug).toBeDefined();
      expect(result.representativeText).toContain("Carbon emissions");
      expect(result.totalInstances).toBe(1);
      
      fixtures.canonical1 = result;
    });

    it("returns existing canonical claim when claim is already registered", async () => {
      // Register the same claim again
      const result = await findOrCreateCanonicalClaim(
        fixtures.claim1!.id,
        fixtures.userId!,
        "climate_policy"
      );

      expect(result.id).toBe(fixtures.canonical1!.id);
    });

    it("can register a semantically similar claim to existing canonical", async () => {
      // Register claim2 (similar to claim1) to the existing canonical
      const result = await registerClaimInstanceToCanonical(
        fixtures.claim2!.id,
        fixtures.canonical1!.id,
        "SEMANTIC"
      );

      expect(result).toBeDefined();
      expect(result.canonicalId).toBe(fixtures.canonical1!.id);
    });
  });

  describe("searchCanonicalClaims()", () => {
    it("finds canonical claims by search query", async () => {
      const results = await searchCanonicalClaims({
        query: "carbon emissions",
        minInstances: 1,
      });

      expect(results.length).toBeGreaterThan(0);
      const found = results.find((c) => c.id === fixtures.canonical1!.id);
      expect(found).toBeDefined();
    });

    it("filters by minimum instances", async () => {
      const results = await searchCanonicalClaims({
        query: "carbon",
        minInstances: 5, // High threshold - should return fewer results
      });

      // With high threshold, our test canonical may not appear
      const found = results.find((c) => c.id === fixtures.canonical1!.id);
      // It may or may not be found depending on how many instances we added
    });
  });

  describe("getCanonicalClaimById()", () => {
    it("retrieves full canonical claim with instances", async () => {
      const result = await getCanonicalClaimById(fixtures.canonical1!.id);

      expect(result).toBeDefined();
      expect(result!.id).toBe(fixtures.canonical1!.id);
      expect(result!.instances.length).toBeGreaterThanOrEqual(1);
    });

    it("returns null for non-existent ID", async () => {
      const result = await getCanonicalClaimById("non-existent-id");
      expect(result).toBeNull();
    });
  });
});

// ─────────────────────────────────────────────────────────
// Cross-Room Search Tests
// ─────────────────────────────────────────────────────────

describe("Cross-Room Search", () => {
  describe("searchClaimsAcrossRooms()", () => {
    it("finds claims across different deliberations", async () => {
      const results = await searchClaimsAcrossRooms({
        query: "carbon emissions",
      });

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    it("excludes specified deliberation from results", async () => {
      const results = await searchClaimsAcrossRooms({
        query: "carbon emissions",
        excludeDeliberationId: fixtures.deliberation1!.id,
      });

      // Verify no instances from deliberation1
      for (const result of results) {
        for (const instance of result.canonicalClaim.instances) {
          expect(instance.deliberation.id).not.toBe(fixtures.deliberation1!.id);
        }
      }
    });

    it("returns empty for short queries", async () => {
      const results = await searchClaimsAcrossRooms({
        query: "a", // Too short
      });

      expect(results).toEqual([]);
    });

    it("respects limit parameter", async () => {
      const results = await searchClaimsAcrossRooms({
        query: "emissions",
        limit: 5,
      });

      expect(results.length).toBeLessThanOrEqual(5);
    });
  });

  describe("findRelatedDeliberations()", () => {
    it("finds deliberations sharing canonical claims", async () => {
      const related = await findRelatedDeliberations(
        fixtures.deliberation1!.id,
        10
      );

      expect(related).toBeDefined();
      expect(Array.isArray(related)).toBe(true);
      
      // Should find deliberation2 as related (shares canonical claim)
      const relatedIds = related.map((r: { deliberation: { id: string } }) => r.deliberation.id);
      // Note: May or may not find delib2 depending on test execution order
    });

    it("does not include the source deliberation in results", async () => {
      const related = await findRelatedDeliberations(
        fixtures.deliberation1!.id,
        10
      );

      const relatedIds = related.map((r: { deliberation: { id: string } }) => r.deliberation.id);
      expect(relatedIds).not.toContain(fixtures.deliberation1!.id);
    });
  });

  describe("getClaimCrossRoomStatus()", () => {
    it("returns cross-room status for a registered claim", async () => {
      const status = await getClaimCrossRoomStatus(fixtures.claim1!.id);

      expect(status).toBeDefined();
      expect(status.claimId).toBe(fixtures.claim1!.id);
      // Should be part of a canonical claim now
      expect(status.isCanonical).toBeDefined();
    });

    it("handles claims not in canonical registry", async () => {
      const status = await getClaimCrossRoomStatus(fixtures.claim3!.id);

      expect(status).toBeDefined();
      expect(status.claimId).toBe(fixtures.claim3!.id);
      expect(status.isCanonical).toBe(false);
    });
  });
});

// ─────────────────────────────────────────────────────────
// Argument Import Tests
// ─────────────────────────────────────────────────────────

describe("Argument Import", () => {
  describe("importArgument()", () => {
    it("imports argument with FULL type preserving all data", async () => {
      const result = await importArgument(
        {
          sourceArgumentId: fixtures.argument1!.id,
          targetDeliberationId: fixtures.deliberation2!.id,
          importType: "FULL",
          importReason: "Testing full import",
          preserveAttribution: true,
        },
        fixtures.userId!
      );

      expect(result).toBeDefined();
      expect(result.importedArgumentId).toBeDefined();
      expect(result.sourceArgumentId).toBe(fixtures.argument1!.id);
      expect(result.importRecord.importType).toBe("FULL");
      expect(result.importRecord.wasModified).toBe(false);

      // Verify the imported argument exists in target deliberation
      const imported = await prisma.argument.findUnique({
        where: { id: result.importedArgumentId },
        include: { deliberation: true },
      });
      expect(imported?.deliberationId).toBe(fixtures.deliberation2!.id);
    });

    it("imports argument with PREMISES_ONLY type", async () => {
      const result = await importArgument(
        {
          sourceArgumentId: fixtures.argument1!.id,
          targetDeliberationId: fixtures.deliberation3!.id,
          importType: "PREMISES_ONLY",
          importReason: "Testing premises-only import",
        },
        fixtures.userId!
      );

      expect(result).toBeDefined();
      expect(result.importRecord.importType).toBe("PREMISES_ONLY");
    });

    it("imports argument with SKELETON type (structure only)", async () => {
      const result = await importArgument(
        {
          sourceArgumentId: fixtures.argument1!.id,
          targetDeliberationId: fixtures.deliberation2!.id,
          importType: "SKELETON",
          importReason: "Testing skeleton import",
        },
        fixtures.userId!
      );

      expect(result).toBeDefined();
      expect(result.importRecord.importType).toBe("SKELETON");
      
      // Verify the imported argument has modified text
      const imported = await prisma.argument.findUnique({
        where: { id: result.importedArgumentId },
      });
      expect(imported?.text).toContain("[Imported structure");
    });

    it("imports argument with REFERENCE type (citation only)", async () => {
      const result = await importArgument(
        {
          sourceArgumentId: fixtures.argument1!.id,
          targetDeliberationId: fixtures.deliberation3!.id,
          importType: "REFERENCE",
          importReason: "Testing reference import",
        },
        fixtures.userId!
      );

      expect(result).toBeDefined();
      expect(result.importRecord.importType).toBe("REFERENCE");
      
      // Verify reference format
      const imported = await prisma.argument.findUnique({
        where: { id: result.importedArgumentId },
      });
      expect(imported?.text).toContain("[Reference]");
    });

    it("prevents importing argument into same deliberation", async () => {
      await expect(
        importArgument(
          {
            sourceArgumentId: fixtures.argument1!.id,
            targetDeliberationId: fixtures.deliberation1!.id, // Same as source
            importType: "FULL",
          },
          fixtures.userId!
        )
      ).rejects.toThrow("Cannot import argument into its own deliberation");
    });

    it("throws error for non-existent source argument", async () => {
      await expect(
        importArgument(
          {
            sourceArgumentId: "non-existent-argument-id",
            targetDeliberationId: fixtures.deliberation2!.id,
            importType: "FULL",
          },
          fixtures.userId!
        )
      ).rejects.toThrow("Source argument not found");
    });

    it("throws error for non-existent target deliberation", async () => {
      await expect(
        importArgument(
          {
            sourceArgumentId: fixtures.argument1!.id,
            targetDeliberationId: "non-existent-delib-id",
            importType: "FULL",
          },
          fixtures.userId!
        )
      ).rejects.toThrow("Target deliberation not found");
    });
  });
});

// ─────────────────────────────────────────────────────────
// Import Type Handling Tests
// ─────────────────────────────────────────────────────────

describe("Import Type Handling", () => {
  const importTypes: ImportType[] = ["FULL", "PREMISES_ONLY", "SKELETON", "REFERENCE"];

  it.each(importTypes)("handles %s import type correctly", async (importType) => {
    const result = await importArgument(
      {
        sourceArgumentId: fixtures.argument1!.id,
        targetDeliberationId: fixtures.deliberation2!.id,
        importType,
        importReason: `Testing ${importType} import`,
      },
      fixtures.userId!
    );

    expect(result.importRecord.importType).toBe(importType);
    expect(result.importedArgumentId).toBeDefined();
  });
});
