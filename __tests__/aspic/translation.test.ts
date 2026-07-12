/**
 * Translation Layer Tests
 * 
 * Tests for bidirectional AIF ↔ ASPIC+ preference translation
 * Based on Phase 4.1 requirements from roadmap
 */

import { describe, test, expect, beforeAll, afterAll } from "@jest/globals";
import { prisma } from "@/lib/prismaclient";
import {
  populateKBPreferencesFromAIF,
  computeTransitiveClosure,
  detectPreferenceCycles,
  preferenceExists,
} from "@/lib/aspic/translation/aifToASPIC";
import {
  createPANodesFromASPICPreferences,
  batchCreatePANodesFromASPICPreferences,
} from "@/lib/aspic/translation/aspicToAIF";
import {
  evaluateWithAIFPreferences,
  syncPreferencesToAIF,
  validateRoundTripTranslation,
  getPreferenceStatistics,
} from "@/lib/aspic/translation/integration";
import type { KnowledgeBase } from "@/lib/aspic/types";

// Test fixtures
let testDelibId: string;
let testUserId: string;
let claimA: any;
let claimB: any;
let claimC: any;
let argA: any;
let argB: any;
let schemeId: string;

describe("Phase 4.1: Translation Layer", () => {
  beforeAll(async () => {
    testUserId = "test-user-translation";

    // Create test deliberation
    const delib = await prisma.deliberation.create({
      data: {
        title: "Test Deliberation for Translation Layer",
        hostType: "free",
        hostId: "test-host",
        createdById: testUserId,
      },
    });
    testDelibId = delib.id;

    // Create test claims
    claimA = await prisma.claim.create({
      data: {
        deliberationId: testDelibId,
        text: "Claim A: Expert testimony is reliable",
        createdById: testUserId,
        moid: `claim-a-${Date.now()}`,
      },
    });

    claimB = await prisma.claim.create({
      data: {
        deliberationId: testDelibId,
        text: "Claim B: Statistical evidence is reliable",
        createdById: testUserId,
        moid: `claim-b-${Date.now()}`,
      },
    });

    claimC = await prisma.claim.create({
      data: {
        deliberationId: testDelibId,
        text: "Claim C: Conclusion follows from evidence",
        createdById: testUserId,
        moid: `claim-c-${Date.now()}`,
      },
    });

    // Get or create test scheme
    const scheme = await prisma.argumentScheme.findFirst({
      where: { key: "expert-opinion" },
    });
    schemeId = scheme?.id ?? "test-scheme-id";

    // Create test arguments
    argA = await prisma.argument.create({
      data: {
        deliberationId: testDelibId,
        authorId: testUserId,
        text: "Argument A text",
        conclusion: claimA.text,
        schemeId: schemeId,
      },
    });

    argB = await prisma.argument.create({
      data: {
        deliberationId: testDelibId,
        authorId: testUserId,
        text: "Argument B text",
        conclusion: claimB.text,
        schemeId: schemeId,
      },
    });
  });

  afterAll(async () => {
    // Cleanup
    if (testDelibId) {
      await prisma.preferenceApplication.deleteMany({
        where: { deliberationId: testDelibId },
      });
      await prisma.argument.deleteMany({
        where: { deliberationId: testDelibId },
      });
      await prisma.claim.deleteMany({
        where: { deliberationId: testDelibId },
      });
      await prisma.deliberation.delete({
        where: { id: testDelibId },
      });
    }
  });

  describe("AIF → ASPIC+ Translation", () => {
    test("populates premise preferences from claim PA-nodes", async () => {
      // Create PA-node: Claim A > Claim B
      await prisma.preferenceApplication.create({
        data: {
          deliberationId: testDelibId,
          preferredClaimId: claimA.id,
          dispreferredClaimId: claimB.id,
          createdById: testUserId,
        },
      });

      const { premisePreferences } = await populateKBPreferencesFromAIF(testDelibId);

      expect(premisePreferences).toContainEqual({
        preferred: claimA.text,
        dispreferred: claimB.text,
      });
    });

    test("populates rule preferences from argument PA-nodes", async () => {
      // Create PA-node: Argument A > Argument B
      await prisma.preferenceApplication.create({
        data: {
          deliberationId: testDelibId,
          preferredArgumentId: argA.id,
          dispreferredArgumentId: argB.id,
          createdById: testUserId,
        },
      });

      const { rulePreferences } = await populateKBPreferencesFromAIF(testDelibId);

      expect(rulePreferences.length).toBeGreaterThan(0);
      // Rule preferences should use scheme IDs
      const hasSchemePreference = rulePreferences.some(
        pref => pref.preferred === schemeId || pref.dispreferred === schemeId
      );
      expect(hasSchemePreference).toBe(true);
    });

    test("handles missing claims gracefully", async () => {
      // Create PA-node with non-existent claim IDs
      await prisma.preferenceApplication.create({
        data: {
          deliberationId: testDelibId,
          preferredClaimId: "non-existent-claim-1",
          dispreferredClaimId: "non-existent-claim-2",
          createdById: testUserId,
        },
      });

      const { premisePreferences } = await populateKBPreferencesFromAIF(testDelibId);

      // Should not include the invalid preference
      const hasInvalidPref = premisePreferences.some(
        pref => pref.preferred === null || pref.dispreferred === null
      );
      expect(hasInvalidPref).toBe(false);
    });

    test("preferenceExists checks for existing preferences", async () => {
      const exists = await preferenceExists(
        testDelibId,
        claimA.id,
        claimB.id,
        "claim"
      );

      expect(exists).toBe(true);

      const notExists = await preferenceExists(
        testDelibId,
        "fake-id-1",
        "fake-id-2",
        "claim"
      );

      expect(notExists).toBe(false);
    });
  });

  describe("ASPIC+ → AIF Translation", () => {
    test("creates PA-nodes from premise preferences", async () => {
      // Clear existing PA-nodes for clean test
      await prisma.preferenceApplication.deleteMany({
        where: {
          deliberationId: testDelibId,
          preferredClaimId: claimB.id,
          dispreferredClaimId: claimC.id,
        },
      });

      const kb: KnowledgeBase = {
        axioms: new Set(),
        premises: new Set(),
        assumptions: new Set(),
        premisePreferences: [{ preferred: claimB.text, dispreferred: claimC.text }],
        rulePreferences: [],
      };

      const { created } = await createPANodesFromASPICPreferences(
        testDelibId,
        kb,
        testUserId
      );

      expect(created).toBe(1);

      const pa = await prisma.preferenceApplication.findFirst({
        where: {
          deliberationId: testDelibId,
          preferredClaimId: claimB.id,
          dispreferredClaimId: claimC.id,
        },
      });

      expect(pa).not.toBeNull();
    });

    test("skips duplicate PA-nodes", async () => {
      // First creation
      const kb: KnowledgeBase = {
        axioms: new Set(),
        premises: new Set(),
        assumptions: new Set(),
        premisePreferences: [{ preferred: claimA.text, dispreferred: claimC.text }],
        rulePreferences: [],
      };

      await createPANodesFromASPICPreferences(testDelibId, kb, testUserId);

      // Second creation (should skip)
      const { created, skipped } = await createPANodesFromASPICPreferences(
        testDelibId,
        kb,
        testUserId
      );

      expect(created).toBe(0);
      expect(skipped).toBe(1);
    });

    test("batch creation works efficiently", async () => {
      // Clear all PA-nodes
      await prisma.preferenceApplication.deleteMany({
        where: { deliberationId: testDelibId },
      });

      const kb: KnowledgeBase = {
        axioms: new Set(),
        premises: new Set(),
        assumptions: new Set(),
        premisePreferences: [
          { preferred: claimA.text, dispreferred: claimB.text },
          { preferred: claimB.text, dispreferred: claimC.text },
        ],
        rulePreferences: [],
      };

      const { created } = await batchCreatePANodesFromASPICPreferences(
        testDelibId,
        kb,
        testUserId
      );

      expect(created).toBe(2);

      // Verify both were created
      const paCount = await prisma.preferenceApplication.count({
        where: { deliberationId: testDelibId },
      });

      expect(paCount).toBe(2);
    });
  });

  describe("Transitive Closure", () => {
    test("computes transitive closure correctly", () => {
      const prefs = [
        { preferred: "A", dispreferred: "B" },
        { preferred: "B", dispreferred: "C" },
      ];

      const closure = computeTransitiveClosure(prefs);

      // Should include A < C (transitive)
      expect(closure).toContainEqual({ preferred: "A", dispreferred: "C" });
      // Should still include original preferences
      expect(closure).toContainEqual({ preferred: "A", dispreferred: "B" });
      expect(closure).toContainEqual({ preferred: "B", dispreferred: "C" });
    });

    test("handles complex transitive chains", () => {
      const prefs = [
        { preferred: "A", dispreferred: "B" },
        { preferred: "B", dispreferred: "C" },
        { preferred: "C", dispreferred: "D" },
      ];

      const closure = computeTransitiveClosure(prefs);

      // Should include all transitive relationships
      expect(closure).toContainEqual({ preferred: "A", dispreferred: "D" });
      expect(closure).toContainEqual({ preferred: "B", dispreferred: "D" });
      expect(closure.length).toBeGreaterThanOrEqual(6); // A>B, A>C, A>D, B>C, B>D, C>D
    });
  });

  describe("Cycle Detection", () => {
    test("detects simple cycles", () => {
      const prefs = [
        { preferred: "A", dispreferred: "B" },
        { preferred: "B", dispreferred: "C" },
        { preferred: "C", dispreferred: "A" }, // Cycle!
      ];

      const cycles = detectPreferenceCycles(prefs);

      expect(cycles.length).toBeGreaterThan(0);
      expect(cycles[0]).toContain("A");
      expect(cycles[0]).toContain("B");
      expect(cycles[0]).toContain("C");
    });

    test("returns empty array for acyclic preferences", () => {
      const prefs = [
        { preferred: "A", dispreferred: "B" },
        { preferred: "B", dispreferred: "C" },
        { preferred: "A", dispreferred: "C" },
      ];

      const cycles = detectPreferenceCycles(prefs);

      expect(cycles.length).toBe(0);
    });
  });

  describe("Round-Trip Translation", () => {
    test("AIF → ASPIC+ → AIF preserves preferences", async () => {
      // Clear all preferences
      await prisma.preferenceApplication.deleteMany({
        where: { deliberationId: testDelibId },
      });

      // Create initial PA-node
      await prisma.preferenceApplication.create({
        data: {
          deliberationId: testDelibId,
          preferredClaimId: claimA.id,
          dispreferredClaimId: claimB.id,
          createdById: testUserId,
        },
      });

      // Validate round-trip
      const validation = await validateRoundTripTranslation(testDelibId, testUserId);

      expect(validation.success).toBe(true);
      expect(validation.premisePreferencesPreserved).toBe(true);
    });
  });

  describe("Integration Functions", () => {
    test("getPreferenceStatistics returns correct counts", async () => {
      // Clear and create known state
      await prisma.preferenceApplication.deleteMany({
        where: { deliberationId: testDelibId },
      });

      await prisma.preferenceApplication.create({
        data: {
          deliberationId: testDelibId,
          preferredClaimId: claimA.id,
          dispreferredClaimId: claimB.id,
          createdById: testUserId,
        },
      });

      const stats = await getPreferenceStatistics(testDelibId);

      expect(stats.totalPreferences).toBeGreaterThanOrEqual(1);
      expect(stats.premisePreferences).toBeGreaterThanOrEqual(1);
    });

    test("syncPreferencesToAIF creates PA-nodes", async () => {
      const theory: any = {
        system: {
          language: new Set(),
          contraries: new Map(),
          strictRules: [],
          defeasibleRules: [],
          ruleNames: new Map(),
        },
        knowledgeBase: {
          axioms: new Set(),
          premises: new Set(),
          assumptions: new Set(),
          premisePreferences: [{ preferred: claimA.text, dispreferred: claimC.text }],
          rulePreferences: [],
        },
      };

      const result = await syncPreferencesToAIF(testDelibId, theory, testUserId);

      expect(result.created + result.skipped).toBeGreaterThanOrEqual(1);
    });
  });
});

describe("Transitive Closure Edge Cases", () => {
  test("handles empty preference list", () => {
    const closure = computeTransitiveClosure([]);
    expect(closure).toEqual([]);
  });

  test("handles single preference", () => {
    const prefs = [{ preferred: "A", dispreferred: "B" }];
    const closure = computeTransitiveClosure(prefs);
    expect(closure).toContainEqual({ preferred: "A", dispreferred: "B" });
    expect(closure.length).toBe(1);
  });

  test("handles disconnected preferences", () => {
    const prefs = [
      { preferred: "A", dispreferred: "B" },
      { preferred: "C", dispreferred: "D" },
    ];
    const closure = computeTransitiveClosure(prefs);
    // Should have both original preferences, no transitive connections
    expect(closure.length).toBe(2);
  });
});

describe("Cycle Detection Edge Cases", () => {
  test("handles empty preference list", () => {
    const cycles = detectPreferenceCycles([]);
    expect(cycles).toEqual([]);
  });

  test("handles self-loops", () => {
    const prefs = [{ preferred: "A", dispreferred: "A" }];
    const cycles = detectPreferenceCycles(prefs);
    expect(cycles.length).toBeGreaterThan(0);
  });
});
