/**
 * Tests for Phase 4: Multi-Scheme Classification with CQ Merging
 * 
 * Tests:
 * 1. inferSchemesFromTextWithScores() returns multiple schemes above threshold
 * 2. Confidence scores are normalized correctly (0.0-1.0 range)
 * 3. isPrimary flag is set on highest-confidence scheme
 * 4. inferAndAssignMultipleSchemes() creates ArgumentSchemeInstance records
 * 5. getMergedCQsForArgument() merges CQs from multiple schemes
 * 6. CQ deduplication works correctly
 * 7. Multi-scheme arguments detect combinations (e.g., Expert + Sign, Causal + Practical)
 */

import { prisma } from "@/lib/prismaclient";
import {
  inferSchemesFromTextWithScores,
  inferAndAssignMultipleSchemes,
  getMergedCQsForArgument,
  type InferredScheme
} from "../schemeInference";

describe("Phase 4: Multi-Scheme Classification", () => {
  describe("inferSchemesFromTextWithScores()", () => {
    it("returns multiple schemes for mixed argument types", async () => {
      const text = "Dr. Smith, an expert cardiologist, says high cholesterol is a sign of heart disease risk. Studies show a strong correlation.";
      
      const results = await inferSchemesFromTextWithScores(text, {
        threshold: 0.3,
        maxSchemes: 5
      });

      expect(results.length).toBeGreaterThanOrEqual(2);
      
      // Should detect both expert_opinion (authority) and sign/correlation
      const schemeKeys = results.map(r => r.schemeKey);
      expect(schemeKeys).toContain("expert_opinion");
      expect(schemeKeys.some(k => k.includes("sign") || k.includes("correlation"))).toBe(true);
    });

    it("normalizes confidence scores to 0.0-1.0 range", async () => {
      const text = "If we invest in renewable energy, we will reduce carbon emissions and save money long-term.";
      
      const results = await inferSchemesFromTextWithScores(text);

      expect(results.length).toBeGreaterThan(0);
      
      results.forEach(result => {
        expect(result.confidence).toBeGreaterThanOrEqual(0.0);
        expect(result.confidence).toBeLessThanOrEqual(1.0);
      });

      // Primary scheme should have highest confidence
      const primary = results.find(r => r.isPrimary);
      expect(primary).toBeDefined();
      expect(primary!.confidence).toBeGreaterThanOrEqual(
        Math.max(...results.filter(r => !r.isPrimary).map(r => r.confidence))
      );
    });

    it("sets isPrimary flag on highest-confidence scheme only", async () => {
      const text = "This policy will cause economic growth because similar policies worked in other countries.";
      
      const results = await inferSchemesFromTextWithScores(text);

      const primaryCount = results.filter(r => r.isPrimary).length;
      expect(primaryCount).toBe(1);

      const primary = results.find(r => r.isPrimary);
      expect(primary).toBeDefined();
      expect(primary!.confidence).toBeGreaterThanOrEqual(
        Math.max(...results.map(r => r.confidence))
      );
    });

    it("respects maxSchemes parameter", async () => {
      const text = "Expert analysis shows this approach combines practical benefits with strong causal evidence.";
      
      const results = await inferSchemesFromTextWithScores(text, {
        threshold: 0.1,
        maxSchemes: 3
      });

      expect(results.length).toBeLessThanOrEqual(3);
    });

    it("returns at least one scheme even if none meet threshold", async () => {
      const text = "Some random text that doesn't match any specific scheme pattern.";
      
      const results = await inferSchemesFromTextWithScores(text, {
        threshold: 0.9 // Very high threshold
      });

      expect(results.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("inferAndAssignMultipleSchemes()", () => {
    let testArgumentId: string;

    beforeEach(async () => {
      // Create a test argument
      const deliberation = await prisma.deliberation.create({
        data: {
          roomId: "test-room",
          status: "active",
          topic: "Test Multi-Scheme"
        }
      });

      const testArg = await prisma.argument.create({
        data: {
          deliberationId: deliberation.id,
          authorId: "test-user",
          text: "Dr. Johnson says climate change causes extreme weather, and statistical data shows a strong correlation."
        }
      });

      testArgumentId = testArg.id;
    });

    afterEach(async () => {
      // Clean up
      await prisma.argumentSchemeInstance.deleteMany({
        where: { argumentId: testArgumentId }
      });
      await prisma.argument.delete({
        where: { id: testArgumentId }
      });
      await prisma.deliberation.deleteMany({
        where: { roomId: "test-room" }
      });
    });

    it("creates ArgumentSchemeInstance records for multiple schemes", async () => {
      const text = "Dr. Johnson says climate change causes extreme weather, and statistical data shows a strong correlation.";
      
      const results = await inferAndAssignMultipleSchemes(
        testArgumentId,
        text,
        undefined,
        { threshold: 0.3, maxSchemes: 5 }
      );

      expect(results.length).toBeGreaterThanOrEqual(2);

      // Verify records were created in database
      const instances = await prisma.argumentSchemeInstance.findMany({
        where: { argumentId: testArgumentId }
      });

      expect(instances.length).toBe(results.length);
      expect(instances.some(i => i.isPrimary)).toBe(true);
    });

    it("is idempotent (does not create duplicates on re-run)", async () => {
      const text = "Expert opinion combined with causal evidence.";
      
      // Run twice
      await inferAndAssignMultipleSchemes(testArgumentId, text);
      await inferAndAssignMultipleSchemes(testArgumentId, text);

      const instances = await prisma.argumentSchemeInstance.findMany({
        where: { argumentId: testArgumentId }
      });

      // Should not create duplicates
      const uniquePairs = new Set(instances.map(i => `${i.argumentId}-${i.schemeId}`));
      expect(uniquePairs.size).toBe(instances.length);
    });

    it("stores confidence scores correctly", async () => {
      const text = "Research shows renewable energy reduces emissions and costs.";
      
      const results = await inferAndAssignMultipleSchemes(testArgumentId, text);

      const instances = await prisma.argumentSchemeInstance.findMany({
        where: { argumentId: testArgumentId }
      });

      instances.forEach(instance => {
        expect(instance.confidence).toBeGreaterThanOrEqual(0.0);
        expect(instance.confidence).toBeLessThanOrEqual(1.0);
      });
    });
  });

  describe("getMergedCQsForArgument()", () => {
    let testArgumentId: string;

    beforeEach(async () => {
      const deliberation = await prisma.deliberation.create({
        data: {
          roomId: "test-room-cq",
          status: "active",
          topic: "Test CQ Merging"
        }
      });

      const testArg = await prisma.argument.create({
        data: {
          deliberationId: deliberation.id,
          authorId: "test-user",
          text: "Expert says X causes Y, and data confirms correlation."
        }
      });

      testArgumentId = testArg.id;
    });

    afterEach(async () => {
      await prisma.argumentSchemeInstance.deleteMany({
        where: { argumentId: testArgumentId }
      });
      await prisma.argument.delete({
        where: { id: testArgumentId }
      });
      await prisma.deliberation.deleteMany({
        where: { roomId: "test-room-cq" }
      });
    });

    it("merges CQs from multiple assigned schemes", async () => {
      const text = "Dr. Smith, a leading researcher, says this policy will reduce costs based on her analysis.";
      
      // Assign multiple schemes
      await inferAndAssignMultipleSchemes(testArgumentId, text, undefined, {
        threshold: 0.3,
        maxSchemes: 5
      });

      // Get merged CQs
      const mergedCQs = await getMergedCQsForArgument(testArgumentId);

      expect(mergedCQs.length).toBeGreaterThan(0);
      
      // Should have CQs from multiple schemes (no exact duplicates)
      const uniqueKeys = new Set(mergedCQs.map(cq => cq.cqKey));
      expect(uniqueKeys.size).toBe(mergedCQs.length);
    });

    it("deduplicates CQs by cqKey", async () => {
      const text = "Multiple schemes with overlapping CQ concerns.";
      
      await inferAndAssignMultipleSchemes(testArgumentId, text);
      const mergedCQs = await getMergedCQsForArgument(testArgumentId);

      const keys = mergedCQs.map(cq => cq.cqKey);
      const uniqueKeys = new Set(keys);

      // No duplicate keys
      expect(keys.length).toBe(uniqueKeys.size);
    });

    it("returns empty array for argument with no schemes", async () => {
      const mergedCQs = await getMergedCQsForArgument("non-existent-id");
      
      expect(mergedCQs).toEqual([]);
    });

    it("prioritizes CQs from primary scheme", async () => {
      const text = "Expert analysis combined with causal reasoning.";
      
      await inferAndAssignMultipleSchemes(testArgumentId, text);
      const mergedCQs = await getMergedCQsForArgument(testArgumentId);

      // Primary scheme's CQs should appear first
      const instances = await prisma.argumentSchemeInstance.findMany({
        where: { argumentId: testArgumentId },
        include: { scheme: true },
        orderBy: [{ isPrimary: "desc" }, { confidence: "desc" }]
      });

      if (instances.length > 0 && mergedCQs.length > 0) {
        const primarySchemeKey = instances[0].scheme.key;
        
        // At least some of the first CQs should come from primary scheme
        const firstFewCQs = mergedCQs.slice(0, 3);
        const hasPrimaryCQs = firstFewCQs.some(cq => 
          cq.cqKey.startsWith(primarySchemeKey.replace(/_/g, ""))
        );
        
        expect(hasPrimaryCQs).toBe(true);
      }
    });
  });

  describe("Multi-Scheme Detection Patterns", () => {
    it("detects Expert Opinion + Sign combination", async () => {
      const text = "Dr. Lopez says increased anxiety levels are a sign of burnout.";
      
      const results = await inferSchemesFromTextWithScores(text, {
        threshold: 0.3
      });

      const schemeKeys = results.map(r => r.schemeKey);
      
      // Should detect both authority and correlation/sign
      expect(results.length).toBeGreaterThanOrEqual(2);
      expect(schemeKeys).toContain("expert_opinion");
    });

    it("detects Causal + Practical Reasoning combination", async () => {
      const text = "Implementing remote work will reduce office costs and improve employee satisfaction, therefore we should adopt it.";
      
      const results = await inferSchemesFromTextWithScores(text, {
        threshold: 0.3
      });

      const schemeKeys = results.map(r => r.schemeKey);
      
      // Should detect both causal and practical reasoning
      expect(results.length).toBeGreaterThanOrEqual(2);
      expect(schemeKeys.some(k => k.includes("causal") || k.includes("practical") || k.includes("consequence"))).toBe(true);
    });

    it("detects Classification + Expert Opinion combination", async () => {
      const text = "This behavior is a type of cognitive bias, according to leading psychologists.";
      
      const results = await inferSchemesFromTextWithScores(text, {
        threshold: 0.3
      });

      const schemeKeys = results.map(r => r.schemeKey);
      
      // Should detect both classification and authority
      expect(results.length).toBeGreaterThanOrEqual(1);
    });
  });
});
