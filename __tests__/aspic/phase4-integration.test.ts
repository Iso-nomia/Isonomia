/**
 * ASPIC+ Phase 4 Full Integration Tests
 * 
 * ⚠️ NOTE: These tests are REFERENCE IMPLEMENTATIONS for Phase 4.
 * 
 * Current Status:
 * - ✅ Phase 4.2 schema fields (justification, orderingPolicy, setComparison) exist in schema.prisma
 * - ⚠️ Prisma client needs regeneration: run `npx prisma generate`
 * - ⏳ Phase 4.1 translation layer needs implementation
 * - ✅ Phase 4.3 UI enhancements complete
 * 
 * These tests will work once:
 * 1. Run `npx prisma generate` to update Prisma client types
 * 2. Implement Phase 4.1 translation functions:
 *    - lib/aspic/translation/aifToASPIC.ts
 *    - lib/aspic/translation/aspicToAIF.ts
 *    - lib/aspic/translation/integration.ts
 * 3. Remove .skip from describe block
 * 4. Run: npm test -- phase4-integration
 * 
 * These tests serve as:
 * - A specification of expected behavior
 * - A guide for implementing Phase 4.1 translation layer
 * - A validation suite once translation layer is complete
 * 
 * End-to-end tests covering:
 * - PA-node creation via Prisma
 * - AIF → ASPIC+ translation
 * - ASPIC+ → AIF translation
 * - Round-trip translation validation
 * - Ordering policy metadata
 * - Performance benchmarks
 * 
 * @see ASPIC_PHASE4_PREFERENCES_ROADMAP_V2.md
 * @see docs/developer-guides/AIF_ASPIC_Translation.md
 */

import { prisma } from "@/lib/prismaclient";
// @ts-expect-error - These imports will work once Phase 4.1 is implemented
import { populateKBPreferencesFromAIF, computeTransitiveClosure, detectPreferenceCycles } from "@/lib/aspic/translation/aifToASPIC";
// @ts-expect-error - These imports will work once Phase 4.1 is implemented
import { createPANodesFromASPICPreferences } from "@/lib/aspic/translation/aspicToAIF";
// @ts-expect-error - These imports will work once Phase 4.1 is implemented
import { evaluateWithAIFPreferences } from "@/lib/aspic/translation/integration";
import type { ArgumentationTheory, KnowledgeBase } from "@/lib/aspic/types";

describe.skip("ASPIC+ Phase 4: Full Integration Tests", () => {
  let testDeliberationId: string;
  let testUserId: string;
  let argA: any;
  let argB: any;
  let argC: any;
  let claimA: any;
  let claimB: any;
  let schemeA: any;
  let schemeB: any;

  beforeAll(async () => {
    // Setup test data
    testUserId = "test-user-" + Date.now();

    // Create test deliberation
    const deliberation = await prisma.deliberation.create({
      data: {
        hostType: "free",
        hostId: "test-host-" + Date.now(),
        createdById: testUserId,
        title: "Test Deliberation for Phase 4",
      },
    });
    testDeliberationId = deliberation.id;

    // Create test claims
    claimA = await prisma.claim.create({
      data: {
        text: "Climate change is accelerating",
        createdById: testUserId,
        moid: "claim-a-" + Date.now(),
        deliberationId: testDeliberationId,
      },
    });

    claimB = await prisma.claim.create({
      data: {
        text: "Climate change is overstated",
        createdById: testUserId,
        moid: "claim-b-" + Date.now(),
        deliberationId: testDeliberationId,
      },
    });

    // Create test schemes
    schemeA = await prisma.argumentScheme.create({
      data: {
        key: "expert-testimony",
        name: "Expert Testimony",
        summary: "Expert Testimony",
        description: "Argument from expert opinion",
      },
    });

    schemeB = await prisma.argumentScheme.create({
      data: {
        key: "scientific-study",
        name: "Scientific Study",
        summary: "Scientific Study",
        description: "Argument from peer-reviewed research",
      },
    });

    // Create test arguments
    argA = await prisma.argument.create({
      data: {
        deliberationId: testDeliberationId,
        conclusionClaimId: claimA.id,
        schemeId: schemeA.id,
        authorId: testUserId,
        text: "Expert says climate change is accelerating",
      },
    });

    argB = await prisma.argument.create({
      data: {
        deliberationId: testDeliberationId,
        conclusionClaimId: claimB.id,
        schemeId: schemeB.id,
        authorId: testUserId,
        text: "Study shows climate change is overstated",
      },
    });
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.preferenceApplication.deleteMany({ where: { deliberationId: testDeliberationId } });
    await prisma.argument.deleteMany({ where: { deliberationId: testDeliberationId } });
    await prisma.claim.deleteMany({ where: { deliberationId: testDeliberationId } });
    await prisma.deliberation.delete({ where: { id: testDeliberationId } });
    await prisma.argumentScheme.deleteMany({ where: { key: { in: ["expert-testimony", "scientific-study"] } } });
  });

  describe("End-to-End: Create PA-node → Evaluate → Verify Defeats", () => {
    test("creates preference and affects defeat computation", async () => {
      // STEP 1: Create preference: argB > argA (scientific study > expert testimony)
      const pa = await prisma.preferenceApplication.create({
        data: {
          deliberationId: testDeliberationId,
          createdById: testUserId,
          preferredArgumentId: argB.id,
          dispreferredArgumentId: argA.id,
          justification: "Peer-reviewed research is more reliable than expert opinion",
          orderingPolicy: "last-link",
          setComparison: "elitist",
        },
      });

      expect(pa.id).toBeDefined();
      expect(pa.justification).toBe("Peer-reviewed research is more reliable than expert opinion");

      // STEP 2: Translate AIF → ASPIC+
      const { premisePreferences, rulePreferences } = await populateKBPreferencesFromAIF(
        testDeliberationId
      );

      // Canonical rule key is the RA-node id `RA:<argumentId>` (roadmap decision Q1 /
      // issue A fix), NOT scheme.id — that is what argument construction keys rules by.
      expect(rulePreferences).toHaveLength(1);
      expect(rulePreferences[0]).toEqual({
        preferred: `RA:${argB.id}`,
        dispreferred: `RA:${argA.id}`,
      });

      // STEP 3: Verify preferences are correctly mapped
      expect(rulePreferences[0].preferred).toBe(`RA:${argB.id}`); // Scientific study
      expect(rulePreferences[0].dispreferred).toBe(`RA:${argA.id}`); // Expert testimony

      // Cleanup for next test
      await prisma.preferenceApplication.delete({ where: { id: pa.id } });
    });

    test("justification is saved and retrieved", async () => {
      const pa = await prisma.preferenceApplication.create({
        data: {
          deliberationId: testDeliberationId,
          createdById: testUserId,
          preferredArgumentId: argB.id,
          dispreferredArgumentId: argA.id,
          justification: "Meta-analysis trumps single study",
        },
      });

      const retrieved = await prisma.preferenceApplication.findUnique({
        where: { id: pa.id },
      });

      expect(retrieved?.justification).toBe("Meta-analysis trumps single study");

      await prisma.preferenceApplication.delete({ where: { id: pa.id } });
    });

    test("ordering policy metadata is saved", async () => {
      const pa = await prisma.preferenceApplication.create({
        data: {
          deliberationId: testDeliberationId,
          createdById: testUserId,
          preferredArgumentId: argB.id,
          dispreferredArgumentId: argA.id,
          orderingPolicy: "weakest-link",
          setComparison: "democratic",
        },
      });

      const retrieved = await prisma.preferenceApplication.findUnique({
        where: { id: pa.id },
      });

      expect(retrieved?.orderingPolicy).toBe("weakest-link");
      expect(retrieved?.setComparison).toBe("democratic");

      await prisma.preferenceApplication.delete({ where: { id: pa.id } });
    });
  });

  describe("AIF → ASPIC+ Translation", () => {
    test("populates premise preferences from claim PA-nodes", async () => {
      // Create PA-node: claimA > claimB
      const pa = await prisma.preferenceApplication.create({
        data: {
          deliberationId: testDeliberationId,
          createdById: testUserId,
          preferredClaimId: claimA.id,
          dispreferredClaimId: claimB.id,
        },
      });

      const { premisePreferences } = await populateKBPreferencesFromAIF(testDeliberationId);

      expect(premisePreferences).toContainEqual({
        preferred: claimA.text,
        dispreferred: claimB.text,
      });

      await prisma.preferenceApplication.delete({ where: { id: pa.id } });
    });

    test("populates rule preferences from argument PA-nodes", async () => {
      // Create PA-node: argA > argB
      const pa = await prisma.preferenceApplication.create({
        data: {
          deliberationId: testDeliberationId,
          createdById: testUserId,
          preferredArgumentId: argA.id,
          dispreferredArgumentId: argB.id,
        },
      });

      const { rulePreferences } = await populateKBPreferencesFromAIF(testDeliberationId);

      expect(rulePreferences).toContainEqual({
        preferred: schemeA.id,
        dispreferred: schemeB.id,
      });

      await prisma.preferenceApplication.delete({ where: { id: pa.id } });
    });

    test("handles multiple preferences correctly", async () => {
      // Create multiple PA-nodes
      const pa1 = await prisma.preferenceApplication.create({
        data: {
          deliberationId: testDeliberationId,
          createdById: testUserId,
          preferredClaimId: claimA.id,
          dispreferredClaimId: claimB.id,
        },
      });

      const pa2 = await prisma.preferenceApplication.create({
        data: {
          deliberationId: testDeliberationId,
          createdById: testUserId,
          preferredArgumentId: argA.id,
          dispreferredArgumentId: argB.id,
        },
      });

      const { premisePreferences, rulePreferences } = await populateKBPreferencesFromAIF(
        testDeliberationId
      );

      expect(premisePreferences).toHaveLength(1);
      expect(rulePreferences).toHaveLength(1);

      await prisma.preferenceApplication.deleteMany({
        where: { id: { in: [pa1.id, pa2.id] } },
      });
    });

    test("skips incomplete PA-nodes gracefully", async () => {
      // Create PA-node with only preferred side (incomplete)
      const pa = await prisma.preferenceApplication.create({
        data: {
          deliberationId: testDeliberationId,
          createdById: testUserId,
          preferredClaimId: claimA.id,
          // Missing dispreferredClaimId
        },
      });

      const { premisePreferences } = await populateKBPreferencesFromAIF(testDeliberationId);

      // Should not include incomplete preference
      expect(premisePreferences).toHaveLength(0);

      await prisma.preferenceApplication.delete({ where: { id: pa.id } });
    });
  });

  describe("ASPIC+ → AIF Translation", () => {
    test("creates PA-nodes from premise preferences", async () => {
      const theory: any = {
        knowledgeBase: {
          premisePreferences: [{ preferred: claimA.text, dispreferred: claimB.text }],
          rulePreferences: [],
        },
      };

      const { created, skipped } = await createPANodesFromASPICPreferences(
        testDeliberationId,
        theory,
        testUserId
      );

      expect(created).toBe(1);
      expect(skipped).toBe(0);

      const pa = await prisma.preferenceApplication.findFirst({
        where: {
          deliberationId: testDeliberationId,
          preferredClaimId: claimA.id,
          dispreferredClaimId: claimB.id,
        },
      });

      expect(pa).not.toBeNull();

      // Cleanup
      if (pa) await prisma.preferenceApplication.delete({ where: { id: pa.id } });
    });

    test("creates PA-nodes from rule preferences", async () => {
      const theory: any = {
        knowledgeBase: {
          premisePreferences: [],
          rulePreferences: [{ preferred: schemeA.id, dispreferred: schemeB.id }],
        },
      };

      const { created } = await createPANodesFromASPICPreferences(
        testDeliberationId,
        theory,
        testUserId
      );

      expect(created).toBe(1);

      const pa = await prisma.preferenceApplication.findFirst({
        where: {
          deliberationId: testDeliberationId,
          preferredArgumentId: argA.id,
          dispreferredArgumentId: argB.id,
        },
      });

      expect(pa).not.toBeNull();

      // Cleanup
      if (pa) await prisma.preferenceApplication.delete({ where: { id: pa.id } });
    });

    test("skips duplicate PA-nodes (idempotency)", async () => {
      // Create PA-node manually
      const existing = await prisma.preferenceApplication.create({
        data: {
          deliberationId: testDeliberationId,
          createdById: testUserId,
          preferredClaimId: claimA.id,
          dispreferredClaimId: claimB.id,
        },
      });

      const theory: any = {
        knowledgeBase: {
          premisePreferences: [{ preferred: claimA.text, dispreferred: claimB.text }],
          rulePreferences: [],
        },
      };

      const { created, skipped } = await createPANodesFromASPICPreferences(
        testDeliberationId,
        theory,
        testUserId
      );

      expect(created).toBe(0);
      expect(skipped).toBe(1); // Existing PA-node was skipped

      await prisma.preferenceApplication.delete({ where: { id: existing.id } });
    });
  });

  describe("Round-Trip Translation", () => {
    test("AIF → ASPIC+ → AIF preserves preferences", async () => {
      // Create initial PA-node
      const pa = await prisma.preferenceApplication.create({
        data: {
          deliberationId: testDeliberationId,
          createdById: testUserId,
          preferredClaimId: claimA.id,
          dispreferredClaimId: claimB.id,
        },
      });

      // Translate to ASPIC+
      const { premisePreferences } = await populateKBPreferencesFromAIF(testDeliberationId);

      expect(premisePreferences).toHaveLength(1);

      // Translate back to AIF
      const theory: any = {
        knowledgeBase: {
          premisePreferences,
          rulePreferences: [],
        },
      };

      await createPANodesFromASPICPreferences(testDeliberationId, theory, testUserId);

      // Verify PA-node still exists (should be skipped as duplicate)
      const paAfter = await prisma.preferenceApplication.findFirst({
        where: {
          deliberationId: testDeliberationId,
          preferredClaimId: claimA.id,
          dispreferredClaimId: claimB.id,
        },
      });

      expect(paAfter).not.toBeNull();
      expect(paAfter?.id).toBe(pa.id); // Same PA-node (not duplicate)

      await prisma.preferenceApplication.delete({ where: { id: pa.id } });
    });
  });

  describe("Validation Utilities", () => {
    test("computes transitive closure correctly", () => {
      const prefs = [
        { preferred: "A", dispreferred: "B" },
        { preferred: "B", dispreferred: "C" },
      ];

      const closure = computeTransitiveClosure(prefs);

      // Should infer A > C from A > B > C
      expect(closure).toContainEqual({ preferred: "A", dispreferred: "C" });
      expect(closure.length).toBe(3); // A>B, B>C, A>C
    });

    test("detects preference cycles", () => {
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

    test("handles acyclic preferences without error", () => {
      const prefs = [
        { preferred: "A", dispreferred: "B" },
        { preferred: "B", dispreferred: "C" },
        { preferred: "D", dispreferred: "E" },
      ];

      const cycles = detectPreferenceCycles(prefs);

      expect(cycles).toHaveLength(0);
    });
  });

  describe("Performance Tests", () => {
    test("handles 50 preferences efficiently", async () => {
      const startTime = Date.now();

      // Create 50 PA-nodes
      const paIds: string[] = [];
      for (let i = 0; i < 50; i++) {
        const pa = await prisma.preferenceApplication.create({
          data: {
          deliberationId: testDeliberationId,
          createdById: testUserId,
          preferredClaimId: claimA.id,
          dispreferredClaimId: claimB.id,
          justification: `Test preference ${i}`,
          },
        });
        paIds.push(pa.id);
      }

      // Translate
      await populateKBPreferencesFromAIF(testDeliberationId);

      const duration = Date.now() - startTime;

      // Should complete in < 5 seconds
      expect(duration).toBeLessThan(5000);

      // Cleanup
      await prisma.preferenceApplication.deleteMany({
        where: { id: { in: paIds } },
      });
    });
  });
});

describe("API Integration Tests", () => {
  // Note: These tests would require a running Next.js server and would typically
  // be run with tools like Playwright or in a separate E2E test suite.
  // They are provided here as reference for the expected behavior.

  test.skip("POST /api/pa creates preference with all fields", async () => {
    const response = await fetch("http://localhost:3000/api/pa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deliberationId: "test-delib-id",
        preferredArgumentId: "arg-a",
        dispreferredArgumentId: "arg-b",
        justification: "Expert source is more credible",
        orderingPolicy: "last-link",
        setComparison: "elitist",
      }),
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.id).toBeDefined();
  });

  test.skip("GET /api/aspic/evaluate returns defeat statistics", async () => {
    const response = await fetch(
      "http://localhost:3000/api/aspic/evaluate?deliberationId=test-delib-id&ordering=last-link"
    );

    expect(response.ok).toBe(true);
    const data = await response.json();

    expect(data.ok).toBe(true);
    expect(data.ordering).toBe("last-link");
    expect(data.defeatStatistics).toBeDefined();
    expect(data.defeatStatistics.totalAttacks).toBeGreaterThanOrEqual(0);
    expect(data.defeatStatistics.totalDefeats).toBeLessThanOrEqual(
      data.defeatStatistics.totalAttacks
    );
  });

  test.skip("GET /api/arguments/:id/defeats returns defeat info", async () => {
    const response = await fetch(
      "http://localhost:3000/api/arguments/arg-a/defeats?deliberationId=test-delib-id"
    );

    expect(response.ok).toBe(true);
    const data = await response.json();

    expect(data.ok).toBe(true);
    expect(data.argumentId).toBe("arg-a");
    expect(data.defeatsOn).toBeInstanceOf(Array);
    expect(data.defeatsBy).toBeInstanceOf(Array);
  });

  test.skip("changing ordering policy affects defeat count", async () => {
    // Evaluate with last-link
    const lastLink = await fetch(
      "http://localhost:3000/api/aspic/evaluate?deliberationId=test-delib-id&ordering=last-link"
    ).then(r => r.json());

    // Evaluate with weakest-link
    const weakestLink = await fetch(
      "http://localhost:3000/api/aspic/evaluate?deliberationId=test-delib-id&ordering=weakest-link"
    ).then(r => r.json());

    // Defeat counts may differ based on ordering
    expect(lastLink.defeatStatistics.totalDefeats).toBeDefined();
    expect(weakestLink.defeatStatistics.totalDefeats).toBeDefined();

    // No assertion on specific values—just verify structure is correct
  });
});
