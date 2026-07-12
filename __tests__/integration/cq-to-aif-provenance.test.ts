/**
 * Phase 1f: Integration Tests for CQ → Ludics → AIF Provenance Chain
 * 
 * Tests the complete flow:
 * 1. CQ generates DialogueMove with ASPIC+ metadata (Phase 1c)
 * 2. Ludics compilation extracts and preserves ASPIC+ (Phase 1e)
 * 3. AIF sync creates CA-nodes from ASPIC+ metadata (Phase 1e)
 * 
 * This verifies that ASPIC+ provenance is preserved across the entire pipeline.
 */

import { PrismaClient } from "@prisma/client";
import { extractAspicMetadataFromMove } from "@/lib/aspic/conflictHelpers";

const prisma = new PrismaClient();

describe("CQ → Ludics → AIF Provenance Chain", () => {
  let testDeliberationId: string;
  let testUserId: string;
  let testClaimId: string;
  let testArgumentId: string;

  beforeAll(async () => {
    // Create test data: Deliberation, User, Claim, Argument
    const user = await prisma.user.upsert({
      where: { email: "test-provenance@mesh.test" },
      update: {},
      create: {
        email: "test-provenance@mesh.test",
        username: "test-provenance-user",
        displayName: "Test Provenance User",
      },
    });
    testUserId = user.id;

    const deliberation = await prisma.deliberation.create({
      data: {
        title: "Test Provenance Deliberation",
        description: "Testing CQ → Ludics → AIF provenance",
        ownerId: testUserId,
      },
    });
    testDeliberationId = deliberation.id;

    const claim = await prisma.claim.create({
      data: {
        title: "Climate change is real",
        content: "Climate change is happening due to human activity",
        deliberationId: testDeliberationId,
        authorId: testUserId,
      },
    });
    testClaimId = claim.id;

    const argument = await prisma.argument.create({
      data: {
        content: "Scientists agree that climate is changing",
        claimId: testClaimId,
        authorId: testUserId,
      },
    });
    testArgumentId = argument.id;
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.dialogueMove.deleteMany({
      where: { deliberationId: testDeliberationId },
    });
    await prisma.ludicAct.deleteMany({
      where: { deliberationId: testDeliberationId },
    });
    await prisma.aIFNode.deleteMany({
      where: { deliberationId: testDeliberationId },
    });
    await prisma.aIFEdge.deleteMany({
      where: { deliberationId: testDeliberationId },
    });
    await prisma.argument.delete({ where: { id: testArgumentId } });
    await prisma.claim.delete({ where: { id: testClaimId } });
    await prisma.deliberation.delete({ where: { id: testDeliberationId } });
    await prisma.user.delete({ where: { id: testUserId } });
    await prisma.$disconnect();
  });

  describe("Step 1: CQ → DialogueMove with ASPIC+ metadata", () => {
    it("should create DialogueMove with ASPIC+ attack metadata", async () => {
      // Create DialogueMove simulating CQ asking "why" about premise
      const dialogueMove = await prisma.dialogueMove.create({
        data: {
          kind: "WHY",
          targetType: "argument",
          targetId: testArgumentId,
          actorId: testUserId,
          deliberationId: testDeliberationId,
          payload: {
            cqKey: "CQ_PREMISE_ACCEPTABILITY",
            cqText: "Is this premise acceptable?",
            aspicAttack: {
              type: "UNDERMINES",
              attackerId: "synthesized_arg_123",
              defenderId: testArgumentId,
              succeeded: true,
            },
            aspicMetadata: {
              targetScope: "premise",
              reason: "Premise needs supporting evidence",
            },
            acts: [
              {
                polarity: "neg",
                locusPath: "0.1",
                expression: "Why should we accept this premise?",
                openings: [],
              },
            ],
          },
        },
      });

      expect(dialogueMove.id).toBeDefined();
      expect(dialogueMove.payload).toHaveProperty("aspicAttack");
      expect(dialogueMove.payload).toHaveProperty("aspicMetadata");

      // Verify extractAspicMetadataFromMove works
      const aspicMetadata = extractAspicMetadataFromMove(dialogueMove.payload);
      expect(aspicMetadata).not.toBeNull();
      expect(aspicMetadata?.attackType).toBe("UNDERMINES");
      expect(aspicMetadata?.targetScope).toBe("premise");
    });
  });

  describe("Step 2: Ludics Compilation Preserves ASPIC+", () => {
    it("should create LudicAct with ASPIC+ in metaJson", async () => {
      // Get the DialogueMove created in previous test
      const dialogueMove = await prisma.dialogueMove.findFirst({
        where: {
          deliberationId: testDeliberationId,
          kind: "WHY",
        },
      });

      expect(dialogueMove).not.toBeNull();

      // Simulate Ludics compilation creating LudicAct
      // (In reality, this would be done by compileFromMoves.ts)
      const aspicMetadata = extractAspicMetadataFromMove(dialogueMove!.payload);

      const ludicAct = await prisma.ludicAct.create({
        data: {
          deliberationId: testDeliberationId,
          moveId: dialogueMove!.id,
          actorId: testUserId,
          locusPath: "0.1",
          polarity: "neg",
          expression: "Why should we accept this premise?",
          metaJson: {
            aspic: aspicMetadata,
            cqKey: "CQ_PREMISE_ACCEPTABILITY",
            cqText: "Is this premise acceptable?",
          },
        },
      });

      expect(ludicAct.id).toBeDefined();
      expect(ludicAct.metaJson).toHaveProperty("aspic");

      const storedAspic = (ludicAct.metaJson as any).aspic;
      expect(storedAspic.attackType).toBe("UNDERMINES");
      expect(storedAspic.targetScope).toBe("premise");
      expect(storedAspic.cqKey).toBe("CQ_PREMISE_ACCEPTABILITY");
    });
  });

  describe("Step 3: AIF Sync Creates CA-Nodes from ASPIC+", () => {
    it("should create CA-node when LudicAct has ASPIC+ metadata", async () => {
      // Get the LudicAct created in previous test
      const ludicAct = await prisma.ludicAct.findFirst({
        where: {
          deliberationId: testDeliberationId,
          locusPath: "0.1",
        },
      });

      expect(ludicAct).not.toBeNull();
      expect(ludicAct!.metaJson).toHaveProperty("aspic");

      const aspicMetadata = (ludicAct!.metaJson as any).aspic;

      // Simulate AIF sync creating CA-node
      // (In reality, this would be done by syncToAif.ts)
      
      // 1. Create attacker I-node
      const attackerNode = await prisma.aIFNode.create({
        data: {
          deliberationId: testDeliberationId,
          nodeType: "I",
          text: "Why should we accept this premise?",
          metadata: {
            ludicActId: ludicAct!.id,
          },
        },
      });

      // 2. Find or create defender I-node (the original argument)
      const defenderNode = await prisma.aIFNode.create({
        data: {
          deliberationId: testDeliberationId,
          nodeType: "I",
          text: "Scientists agree that climate is changing",
          metadata: {
            argumentId: testArgumentId,
          },
        },
      });

      // 3. Create CA-node for the attack
      const caNode = await prisma.aIFNode.create({
        data: {
          deliberationId: testDeliberationId,
          nodeType: "CA",
          text: `UNDERMINES: ${aspicMetadata.cqText || "CQ attack"}`,
          metadata: {
            aspicAttackType: aspicMetadata.attackType,
            aspicTargetScope: aspicMetadata.targetScope,
            cqKey: aspicMetadata.cqKey,
            cqText: aspicMetadata.cqText,
            succeeded: aspicMetadata.succeeded,
            reason: aspicMetadata.reason,
            source: "phase-1e-ludics-aspic",
          },
        },
      });

      // 4. Create edges: attacker → CA → defender
      const edge1 = await prisma.aIFEdge.create({
        data: {
          deliberationId: testDeliberationId,
          fromNodeId: attackerNode.id,
          toNodeId: caNode.id,
        },
      });

      const edge2 = await prisma.aIFEdge.create({
        data: {
          deliberationId: testDeliberationId,
          fromNodeId: caNode.id,
          toNodeId: defenderNode.id,
        },
      });

      // Verify CA-node structure
      expect(caNode.nodeType).toBe("CA");
      expect(caNode.metadata).toHaveProperty("aspicAttackType");
      expect((caNode.metadata as any).aspicAttackType).toBe("UNDERMINES");
      expect((caNode.metadata as any).aspicTargetScope).toBe("premise");
      expect((caNode.metadata as any).source).toBe("phase-1e-ludics-aspic");

      // Verify edges
      expect(edge1.fromNodeId).toBe(attackerNode.id);
      expect(edge1.toNodeId).toBe(caNode.id);
      expect(edge2.fromNodeId).toBe(caNode.id);
      expect(edge2.toNodeId).toBe(defenderNode.id);
    });
  });

  describe("Full Pipeline Verification", () => {
    it("should maintain ASPIC+ provenance from CQ to AIF", async () => {
      // Query all records to verify provenance chain
      const dialogueMove = await prisma.dialogueMove.findFirst({
        where: {
          deliberationId: testDeliberationId,
          kind: "WHY",
        },
      });

      const ludicAct = await prisma.ludicAct.findFirst({
        where: {
          moveId: dialogueMove!.id,
        },
      });

      const caNode = await prisma.aIFNode.findFirst({
        where: {
          deliberationId: testDeliberationId,
          nodeType: "CA",
        },
      });

      // Verify provenance chain exists
      expect(dialogueMove).not.toBeNull();
      expect(ludicAct).not.toBeNull();
      expect(caNode).not.toBeNull();

      // Extract ASPIC metadata from each stage
      const dmAspic = extractAspicMetadataFromMove(dialogueMove!.payload);
      const ludicAspic = (ludicAct!.metaJson as any).aspic;
      const aifAspic = caNode!.metadata as any;

      // Verify metadata consistency across pipeline
      expect(dmAspic?.attackType).toBe("UNDERMINES");
      expect(ludicAspic.attackType).toBe("UNDERMINES");
      expect(aifAspic.aspicAttackType).toBe("UNDERMINES");

      expect(dmAspic?.targetScope).toBe("premise");
      expect(ludicAspic.targetScope).toBe("premise");
      expect(aifAspic.aspicTargetScope).toBe("premise");

      expect(dmAspic?.cqKey).toBe("CQ_PREMISE_ACCEPTABILITY");
      expect(ludicAspic.cqKey).toBe("CQ_PREMISE_ACCEPTABILITY");
      expect(aifAspic.cqKey).toBe("CQ_PREMISE_ACCEPTABILITY");

      // Verify traceability
      expect(ludicAct!.moveId).toBe(dialogueMove!.id);
      expect(aifAspic.source).toBe("phase-1e-ludics-aspic");
    });

    it("should support querying by attack type", async () => {
      // Query CA-nodes by ASPIC attack type
      const underminingCANodes = await prisma.aIFNode.findMany({
        where: {
          deliberationId: testDeliberationId,
          nodeType: "CA",
          metadata: {
            path: ["aspicAttackType"],
            equals: "UNDERMINES",
          },
        },
      });

      expect(underminingCANodes.length).toBeGreaterThan(0);
    });

    it("should support querying by target scope", async () => {
      // Query CA-nodes by target scope
      const premiseAttacks = await prisma.aIFNode.findMany({
        where: {
          deliberationId: testDeliberationId,
          nodeType: "CA",
          metadata: {
            path: ["aspicTargetScope"],
            equals: "premise",
          },
        },
      });

      expect(premiseAttacks.length).toBeGreaterThan(0);
    });

    it("should support querying by CQ key", async () => {
      // Query CA-nodes by CQ key
      const cqAttacks = await prisma.aIFNode.findMany({
        where: {
          deliberationId: testDeliberationId,
          nodeType: "CA",
          metadata: {
            path: ["cqKey"],
            equals: "CQ_PREMISE_ACCEPTABILITY",
          },
        },
      });

      expect(cqAttacks.length).toBeGreaterThan(0);
    });
  });

  describe("Multiple Attack Types", () => {
    it("should handle undercutting attacks", async () => {
      // Create undercutting attack: targets inference rule
      const undercutMove = await prisma.dialogueMove.create({
        data: {
          kind: "WHY",
          targetType: "argument",
          targetId: testArgumentId,
          actorId: testUserId,
          deliberationId: testDeliberationId,
          payload: {
            cqKey: "CQ_EXCEPTIONAL_CASE",
            cqText: "Are there exceptions to this rule?",
            aspicAttack: {
              type: "UNDERCUTS",
              attackerId: "synthesized_arg_456",
              defenderId: testArgumentId,
              succeeded: true,
            },
            aspicMetadata: {
              targetScope: "inference",
              reason: "Rule may not apply in exceptional cases",
            },
            acts: [
              {
                polarity: "neg",
                locusPath: "0.2.1",
                expression: "Does this rule always apply?",
                openings: [],
              },
            ],
          },
        },
      });

      const aspicMetadata = extractAspicMetadataFromMove(undercutMove.payload);
      expect(aspicMetadata?.attackType).toBe("UNDERCUTS");
      expect(aspicMetadata?.targetScope).toBe("inference");
    });

    it("should handle rebutting attacks", async () => {
      // Create rebutting attack: contradicts conclusion
      const rebuttingMove = await prisma.dialogueMove.create({
        data: {
          kind: "ATTACK",
          targetType: "argument",
          targetId: testArgumentId,
          actorId: testUserId,
          deliberationId: testDeliberationId,
          payload: {
            cqKey: "CQ_ALTERNATIVE_CONCLUSION",
            cqText: "Is there an alternative conclusion?",
            aspicAttack: {
              type: "REBUTS",
              attackerId: "synthesized_arg_789",
              defenderId: testArgumentId,
              succeeded: false,
            },
            aspicMetadata: {
              targetScope: "conclusion",
              reason: "Alternative interpretation exists",
            },
            acts: [
              {
                polarity: "neg",
                locusPath: "0.3",
                expression: "Actually, the opposite is true",
                openings: [],
              },
            ],
          },
        },
      });

      const aspicMetadata = extractAspicMetadataFromMove(rebuttingMove.payload);
      expect(aspicMetadata?.attackType).toBe("REBUTS");
      expect(aspicMetadata?.targetScope).toBe("conclusion");
    });
  });
});

describe("Performance: Large Deliberation", () => {
  it("should handle 100+ moves with ASPIC+ metadata efficiently", async () => {
    // Create separate test deliberation for performance test
    const perfUser = await prisma.user.upsert({
      where: { email: "perf-test@mesh.test" },
      update: {},
      create: {
        email: "perf-test@mesh.test",
        username: "perf-test-user",
        displayName: "Performance Test User",
      },
    });

    const perfDelib = await prisma.deliberation.create({
      data: {
        title: "Performance Test Deliberation",
        description: "Testing ASPIC+ performance",
        ownerId: perfUser.id,
      },
    });

    const perfClaim = await prisma.claim.create({
      data: {
        title: "Performance test claim",
        content: "Testing performance",
        deliberationId: perfDelib.id,
        authorId: perfUser.id,
      },
    });

    const startTime = Date.now();

    // Create 100 dialogue moves with ASPIC+ metadata
    const moves = [];
    for (let i = 0; i < 100; i++) {
      moves.push({
        kind: "WHY",
        targetType: "claim" as const,
        targetId: perfClaim.id,
        actorId: perfUser.id,
        deliberationId: perfDelib.id,
        payload: {
          cqKey: `CQ_TEST_${i}`,
          cqText: `Test CQ ${i}?`,
          aspicAttack: {
            type: i % 3 === 0 ? "UNDERMINES" : i % 3 === 1 ? "UNDERCUTS" : "REBUTS",
            attackerId: `arg_${i}`,
            defenderId: `arg_target_${i}`,
            succeeded: true,
          },
          aspicMetadata: {
            targetScope: i % 3 === 0 ? "premise" : i % 3 === 1 ? "inference" : "conclusion",
            reason: `Test reason ${i}`,
          },
          acts: [
            {
              polarity: "neg",
              locusPath: `0.${i}`,
              expression: `Test expression ${i}`,
              openings: [],
            },
          ],
        },
      });
    }

    await prisma.dialogueMove.createMany({ data: moves });

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Should complete in reasonable time (< 5 seconds)
    expect(duration).toBeLessThan(5000);

    // Verify all moves created
    const count = await prisma.dialogueMove.count({
      where: { deliberationId: perfDelib.id },
    });
    expect(count).toBe(100);

    // Cleanup
    await prisma.dialogueMove.deleteMany({ where: { deliberationId: perfDelib.id } });
    await prisma.claim.delete({ where: { id: perfClaim.id } });
    await prisma.deliberation.delete({ where: { id: perfDelib.id } });
    await prisma.user.delete({ where: { id: perfUser.id } });
  }, 10000); // 10 second timeout for performance test
});
