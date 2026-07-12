/**
 * Unit tests for scoped designs compilation
 * Tests computeScopes, computeArgumentRoots, and scoped compilation logic
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { prisma } from "@/lib/prismaclient";
import { compileFromMoves } from "../compileFromMoves";

describe("Scoped Designs - computeScopes", () => {
  let testDeliberationId: string;
  let testArgument1Id: string;
  let testArgument2Id: string;
  let testActorId1: string;
  let testActorId2: string;

  beforeAll(async () => {
    // Create test deliberation
    const delib = await prisma.deliberation.create({
      data: {
        title: "Test Deliberation for Scoped Designs",
        createdById: "test-user",
        visibility: "PUBLIC",
      },
    });
    testDeliberationId = delib.id;

    // Create test actors
    testActorId1 = "actor-1";
    testActorId2 = "actor-2";

    // Create test arguments (topics)
    const arg1 = await prisma.argument.create({
      data: {
        deliberationId: testDeliberationId,
        createdById: testActorId1,
        text: "topic 1: Should we implement feature X?",
      },
    });
    testArgument1Id = arg1.id;

    const arg2 = await prisma.argument.create({
      data: {
        deliberationId: testDeliberationId,
        createdById: testActorId2,
        text: "topic 2: What about performance concerns?",
      },
    });
    testArgument2Id = arg2.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.dialogueMove.deleteMany({
      where: { deliberationId: testDeliberationId },
    });
    await prisma.argument.deleteMany({
      where: { deliberationId: testDeliberationId },
    });
    await prisma.deliberation.delete({
      where: { id: testDeliberationId },
    });
  });

  describe("Legacy mode (backward compatibility)", () => {
    it("should create 2 designs with scope=null", async () => {
      // Create some moves
      await prisma.dialogueMove.create({
        data: {
          deliberationId: testDeliberationId,
          targetType: "argument",
          targetId: testArgument1Id,
          kind: "ASSERT",
          actorId: testActorId1,
          payload: { text: "I think we should" },
        },
      });

      await prisma.dialogueMove.create({
        data: {
          deliberationId: testDeliberationId,
          targetType: "argument",
          targetId: testArgument1Id,
          kind: "WHY",
          actorId: testActorId2,
          payload: { text: "Why do you think that?" },
        },
      });

      // Compile in legacy mode
      const result = await compileFromMoves(testDeliberationId, {
        scopingStrategy: "legacy",
      });

      expect(result.ok).toBe(true);
      expect(result.designs).toHaveLength(2);

      // Verify designs have scope=null
      const designs = await prisma.ludicDesign.findMany({
        where: { deliberationId: testDeliberationId },
      });

      expect(designs).toHaveLength(2);
      expect(designs.every(d => d.scope === null)).toBe(true);
      expect(designs.every(d => d.scopeType === null)).toBe(true);
      expect(designs.map(d => d.participantId).sort()).toEqual([
        "Opponent",
        "Proponent",
      ]);
    });
  });

  describe("topic-based scoping", () => {
    it("should create 2 designs per topic (P+O)", async () => {
      // Clear previous moves
      await prisma.ludicDesign.deleteMany({
        where: { deliberationId: testDeliberationId },
      });
      await prisma.dialogueMove.deleteMany({
        where: { deliberationId: testDeliberationId },
      });

      // Create moves for topic 1
      await prisma.dialogueMove.create({
        data: {
          deliberationId: testDeliberationId,
          targetType: "argument",
          targetId: testArgument1Id,
          kind: "ASSERT",
          actorId: testActorId1,
          payload: { text: "Feature X is important" },
        },
      });

      await prisma.dialogueMove.create({
        data: {
          deliberationId: testDeliberationId,
          targetType: "argument",
          targetId: testArgument1Id,
          kind: "WHY",
          actorId: testActorId2,
          payload: { text: "Why is it important?" },
        },
      });

      // Create moves for topic 2
      await prisma.dialogueMove.create({
        data: {
          deliberationId: testDeliberationId,
          targetType: "argument",
          targetId: testArgument2Id,
          kind: "ASSERT",
          actorId: testActorId2,
          payload: { text: "Performance matters" },
        },
      });

      await prisma.dialogueMove.create({
        data: {
          deliberationId: testDeliberationId,
          targetType: "argument",
          targetId: testArgument2Id,
          kind: "WHY",
          actorId: testActorId1,
          payload: { text: "How much slower?" },
        },
      });

      // Compile with topic scoping
      const result = await compileFromMoves(testDeliberationId, {
        scopingStrategy: "topic",
      });

      expect(result.ok).toBe(true);
      expect(result.designs).toHaveLength(4); // 2 topics × 2 polarities

      // Verify scopes
      const designs = await prisma.ludicDesign.findMany({
        where: { deliberationId: testDeliberationId },
        orderBy: { scope: "asc" },
      });

      expect(designs).toHaveLength(4);

      // Group by scope
      const scope1 = designs.filter(d => d.scope?.includes(testArgument1Id));
      const scope2 = designs.filter(d => d.scope?.includes(testArgument2Id));

      expect(scope1).toHaveLength(2);
      expect(scope2).toHaveLength(2);

      // Each scope should have P and O
      expect(scope1.map(d => d.participantId).sort()).toEqual([
        "Opponent",
        "Proponent",
      ]);
      expect(scope2.map(d => d.participantId).sort()).toEqual([
        "Opponent",
        "Proponent",
      ]);

      // Verify scopeType
      expect(designs.every(d => d.scopeType === "topic")).toBe(true);
    });

    it("should include rich scope metadata", async () => {
      const designs = await prisma.ludicDesign.findMany({
        where: {
          deliberationId: testDeliberationId,
          scopeType: "topic",
        },
      });

      expect(designs.length).toBeGreaterThan(0);

      const design = designs[0];
      expect(design.scopeMetadata).toBeTruthy();

      const metadata = design.scopeMetadata as any;
      expect(metadata).toMatchObject({
        type: "topic",
        label: expect.any(String),
        moveCount: expect.any(Number),
        actors: {
          proponent: expect.any(Array),
          opponent: expect.any(Array),
          all: expect.any(Array),
        },
        targetTypes: expect.any(Array),
      });

      expect(metadata.moveCount).toBeGreaterThan(0);
      expect(metadata.actors.all.length).toBeGreaterThan(0);
    });
  });

  describe("Argument-thread scoping", () => {
    it("should create separate scopes for each target", async () => {
      // Clear previous
      await prisma.ludicDesign.deleteMany({
        where: { deliberationId: testDeliberationId },
      });
      await prisma.dialogueMove.deleteMany({
        where: { deliberationId: testDeliberationId },
      });

      // Create moves on different targets
      const targets = [testArgument1Id, testArgument2Id];
      
      for (const targetId of targets) {
        await prisma.dialogueMove.create({
          data: {
            deliberationId: testDeliberationId,
            targetType: "argument",
            targetId,
            kind: "ASSERT",
            actorId: testActorId1,
            payload: { text: `Claim about ${targetId}` },
          },
        });
      }

      // Compile with argument scoping
      const result = await compileFromMoves(testDeliberationId, {
        scopingStrategy: "argument",
      });

      expect(result.ok).toBe(true);
      expect(result.designs).toHaveLength(4); // 2 arguments × 2 polarities

      const designs = await prisma.ludicDesign.findMany({
        where: { deliberationId: testDeliberationId },
      });

      expect(designs.every(d => d.scopeType === "argument")).toBe(true);
      
      // Each argument should have its own scope
      const scopes = new Set(designs.map(d => d.scope));
      expect(scopes.size).toBe(2);
    });
  });

  describe("Edge cases", () => {
    it("should handle deliberation with no moves", async () => {
      const emptyDelib = await prisma.deliberation.create({
        data: {
          title: "Empty Deliberation",
          createdById: "test-user",
          visibility: "PUBLIC",
        },
      });

      const result = await compileFromMoves(emptyDelib.id, {
        scopingStrategy: "topic",
      });

      expect(result.ok).toBe(true);
      expect(result.designs).toHaveLength(0); // No moves = no designs

      await prisma.deliberation.delete({ where: { id: emptyDelib.id } });
    });

    it("should handle moves without targets (scope=null)", async () => {
      await prisma.ludicDesign.deleteMany({
        where: { deliberationId: testDeliberationId },
      });
      await prisma.dialogueMove.deleteMany({
        where: { deliberationId: testDeliberationId },
      });

      // Create move without target
      await prisma.dialogueMove.create({
        data: {
          deliberationId: testDeliberationId,
          targetType: null,
          targetId: null,
          kind: "ASSERT",
          actorId: testActorId1,
          payload: { text: "General statement" },
        },
      });

      const result = await compileFromMoves(testDeliberationId, {
        scopingStrategy: "topic",
      });

      expect(result.ok).toBe(true);
      
      // Moves without targets should create legacy scope
      const designs = await prisma.ludicDesign.findMany({
        where: { deliberationId: testDeliberationId },
      });

      expect(designs.some(d => d.scope === null)).toBe(true);
    });

    it("should be idempotent (recompiling produces same result)", async () => {
      await prisma.ludicDesign.deleteMany({
        where: { deliberationId: testDeliberationId },
      });
      await prisma.dialogueMove.deleteMany({
        where: { deliberationId: testDeliberationId },
      });

      await prisma.dialogueMove.create({
        data: {
          deliberationId: testDeliberationId,
          targetType: "argument",
          targetId: testArgument1Id,
          kind: "ASSERT",
          actorId: testActorId1,
          payload: { text: "Test claim" },
        },
      });

      // First compile
      const result1 = await compileFromMoves(testDeliberationId, {
        scopingStrategy: "topic",
      });

      const designs1 = await prisma.ludicDesign.findMany({
        where: { deliberationId: testDeliberationId },
        orderBy: { scope: "asc" },
      });

      // Second compile
      const result2 = await compileFromMoves(testDeliberationId, {
        scopingStrategy: "topic",
        forceRecompile: true,
      });

      const designs2 = await prisma.ludicDesign.findMany({
        where: { deliberationId: testDeliberationId },
        orderBy: { scope: "asc" },
      });

      // Should produce same structure
      expect(result1.designs.length).toBe(result2.designs.length);
      expect(designs1.length).toBe(designs2.length);
      expect(designs1.map(d => d.scope).sort()).toEqual(
        designs2.map(d => d.scope).sort()
      );
    });
  });
});
