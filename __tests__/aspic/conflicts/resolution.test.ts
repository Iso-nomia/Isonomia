/**
 * Unit tests for conflict detection and resolution
 */

import { detectConflicts, markConflictDetected } from "@/lib/aspic/conflicts/detection";
import { 
  suggestResolutionStrategies, 
  applyResolution, 
  undoResolution,
  getResolutionHistory,
} from "@/lib/aspic/conflicts/resolution";
import type { PreferenceConflict, PreferenceInCycle } from "@/lib/aspic/conflicts/detection";
import { prisma } from "@/lib/prismaclient";

// Mock Prisma for unit tests
jest.mock("@/lib/prismaclient", () => ({
  prisma: {
    preferenceApplication: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

// Mock the detectPreferenceCycles function
jest.mock("@/lib/aspic/translation/aifToASPIC", () => ({
  detectPreferenceCycles: jest.fn((prefs) => {
    // Simple cycle detection for testing
    const cycles: string[][] = [];
    
    // Check for 2-cycles: A > B and B > A
    for (let i = 0; i < prefs.length; i++) {
      for (let j = i + 1; j < prefs.length; j++) {
        if (
          prefs[i].preferred === prefs[j].dispreferred &&
          prefs[i].dispreferred === prefs[j].preferred
        ) {
          cycles.push([prefs[i].preferred, prefs[i].dispreferred]);
        }
      }
    }
    
    return cycles;
  }),
}));

describe("Conflict Detection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("detects simple 2-cycle (A > B, B > A)", async () => {
    const mockPARecords = [
      {
        id: "pa1",
        preferredArgumentId: "argA",
        dispreferredArgumentId: "argB",
        preferredClaimId: null,
        dispreferredClaimId: null,
        weight: 1.0,
        createdAt: new Date("2025-01-01"),
        createdById: "user1",
        justification: "Test justification",
        conflictStatus: "none",
        createdBy: { username: "user1", displayName: "User One" },
      },
      {
        id: "pa2",
        preferredArgumentId: "argB",
        dispreferredArgumentId: "argA",
        preferredClaimId: null,
        dispreferredClaimId: null,
        weight: 1.0,
        createdAt: new Date("2025-01-02"),
        createdById: "user2",
        justification: null,
        conflictStatus: "none",
        createdBy: { username: "user2", displayName: "User Two" },
      },
    ];

    (prisma.preferenceApplication.findMany as jest.Mock).mockResolvedValue(mockPARecords);

    const conflicts = await detectConflicts("test-delib");

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].cycle).toContain("argA");
    expect(conflicts[0].cycle).toContain("argB");
    expect(conflicts[0].preferences).toHaveLength(2);
    expect(conflicts[0].severity).toBe("critical");
    expect(conflicts[0].cycleDisplay).toContain("→");
  });

  test("no conflicts in acyclic preferences", async () => {
    const mockPARecords = [
      {
        id: "pa1",
        preferredArgumentId: "argA",
        dispreferredArgumentId: "argB",
        preferredClaimId: null,
        dispreferredClaimId: null,
        weight: 1.0,
        createdAt: new Date("2025-01-01"),
        createdById: "user1",
        justification: null,
        conflictStatus: "none",
        createdBy: { username: "user1", displayName: null },
      },
      {
        id: "pa2",
        preferredArgumentId: "argB",
        dispreferredArgumentId: "argC",
        preferredClaimId: null,
        dispreferredClaimId: null,
        weight: 1.0,
        createdAt: new Date("2025-01-02"),
        createdById: "user1",
        justification: null,
        conflictStatus: "none",
        createdBy: { username: "user1", displayName: null },
      },
    ];

    (prisma.preferenceApplication.findMany as jest.Mock).mockResolvedValue(mockPARecords);

    const conflicts = await detectConflicts("test-delib");

    expect(conflicts).toHaveLength(0);
  });

  test("excludes already resolved preferences", async () => {
    const mockPARecords = [
      {
        id: "pa1",
        preferredArgumentId: "argA",
        dispreferredArgumentId: "argB",
        preferredClaimId: null,
        dispreferredClaimId: null,
        weight: 1.0,
        createdAt: new Date("2025-01-01"),
        createdById: "user1",
        justification: null,
        conflictStatus: "resolved",
        createdBy: { username: "user1", displayName: null },
      },
    ];

    (prisma.preferenceApplication.findMany as jest.Mock).mockResolvedValue(mockPARecords);

    const conflicts = await detectConflicts("test-delib");

    // Should not detect cycles involving resolved preferences
    expect(conflicts).toHaveLength(0);
  });

  test("marks conflicts as detected", async () => {
    await markConflictDetected(["pa1", "pa2"]);

    expect(prisma.preferenceApplication.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["pa1", "pa2"] } },
      data: { conflictStatus: "detected" },
    });
  });

  test("handles empty PA ID array", async () => {
    await markConflictDetected([]);

    expect(prisma.preferenceApplication.updateMany).not.toHaveBeenCalled();
  });
});

describe("Resolution Strategies", () => {
  const createMockConflict = (preferences: Partial<PreferenceInCycle>[]): PreferenceConflict => ({
    type: "cycle",
    cycle: preferences.map(p => p.preferred ?? "arg"),
    cycleDisplay: "A → B → A",
    preferences: preferences.map((p, i) => ({
      id: p.id ?? `pa${i}`,
      preferred: p.preferred ?? "argA",
      dispreferred: p.dispreferred ?? "argB",
      weight: p.weight ?? 1.0,
      createdAt: p.createdAt ?? new Date(),
      createdBy: p.createdBy ?? "user1",
      createdByName: p.createdByName,
      justification: p.justification,
    })),
    severity: "critical",
    detectedAt: new Date(),
  });

  test("suggests remove weakest when weights differ", () => {
    const conflict = createMockConflict([
      { id: "pa1", weight: 0.6, createdAt: new Date("2025-01-01") },
      { id: "pa2", weight: 1.0, createdAt: new Date("2025-01-02") },
    ]);

    const strategies = suggestResolutionStrategies(conflict);
    const weakest = strategies.find(s => s.type === "remove_weakest");

    expect(weakest).toBeDefined();
    expect(weakest!.toRemove).toEqual(["pa1"]);
    expect(weakest!.recommendation).toBe("recommended");
  });

  test("suggests neutral when weights are equal", () => {
    const conflict = createMockConflict([
      { id: "pa1", weight: 1.0, createdAt: new Date("2025-01-01") },
      { id: "pa2", weight: 1.0, createdAt: new Date("2025-01-02") },
    ]);

    const strategies = suggestResolutionStrategies(conflict);
    const weakest = strategies.find(s => s.type === "remove_weakest");

    expect(weakest).toBeDefined();
    expect(weakest!.recommendation).toBe("neutral");
  });

  test("suggests remove oldest preference", () => {
    const conflict = createMockConflict([
      { id: "pa1", weight: 1.0, createdAt: new Date("2025-01-01") },
      { id: "pa2", weight: 1.0, createdAt: new Date("2025-01-05") },
    ]);

    const strategies = suggestResolutionStrategies(conflict);
    const oldest = strategies.find(s => s.type === "remove_oldest");

    expect(oldest).toBeDefined();
    expect(oldest!.toRemove).toEqual(["pa1"]);
    expect(oldest!.label).toBe("Keep Most Recent");
  });

  test("suggests vote-based when multiple users", () => {
    const conflict = createMockConflict([
      { id: "pa1", weight: 1.0, createdAt: new Date(), createdBy: "user1" },
      { id: "pa2", weight: 1.0, createdAt: new Date(), createdBy: "user2" },
      { id: "pa3", weight: 1.0, createdAt: new Date(), createdBy: "user2" },
    ]);

    const strategies = suggestResolutionStrategies(conflict);
    const voteBased = strategies.find(s => s.type === "vote_based");

    expect(voteBased).toBeDefined();
    expect(voteBased!.toRemove).toEqual(["pa1"]); // user1 has minority (1 vs 2)
    expect(voteBased!.description).toContain("1 preference");
  });

  test("no vote-based strategy when single user", () => {
    const conflict = createMockConflict([
      { id: "pa1", weight: 1.0, createdAt: new Date(), createdBy: "user1" },
      { id: "pa2", weight: 1.0, createdAt: new Date(), createdBy: "user1" },
    ]);

    const strategies = suggestResolutionStrategies(conflict);
    const voteBased = strategies.find(s => s.type === "vote_based");

    expect(voteBased).toBeUndefined();
  });

  test("always includes manual selection strategy", () => {
    const conflict = createMockConflict([
      { id: "pa1", weight: 1.0 },
    ]);

    const strategies = suggestResolutionStrategies(conflict);
    const manual = strategies.find(s => s.type === "user_selection");

    expect(manual).toBeDefined();
    expect(manual!.toRemove).toEqual([]);
    expect(manual!.label).toBe("Manual Selection");
  });

  test("handles empty preferences array", () => {
    const conflict = createMockConflict([]);

    const strategies = suggestResolutionStrategies(conflict);

    expect(strategies).toHaveLength(0);
  });
});

describe("Apply Resolution", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("marks preferences as resolved", async () => {
    (prisma.preferenceApplication.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.preferenceApplication.findMany as jest.Mock).mockResolvedValue([]);

    const strategy = {
      type: "remove_weakest" as const,
      label: "Test Strategy",
      description: "Test description",
      toRemove: ["pa1"],
    };

    const result = await applyResolution(strategy, "user1", "delib1");

    expect(result.success).toBe(true);
    expect(result.removed).toBe(1);
    expect(prisma.preferenceApplication.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["pa1"] } },
      data: expect.objectContaining({
        conflictStatus: "resolved",
        conflictResolvedBy: "user1",
      }),
    });
  });

  test("returns false when no preferences to remove", async () => {
    (prisma.preferenceApplication.findMany as jest.Mock).mockResolvedValue([]);

    const strategy = {
      type: "user_selection" as const,
      label: "Manual",
      description: "Manual selection",
      toRemove: [],
    };

    const result = await applyResolution(strategy, "user1", "delib1");

    expect(result.success).toBe(false);
    expect(result.removed).toBe(0);
    expect(prisma.preferenceApplication.updateMany).not.toHaveBeenCalled();
  });

  test("stores resolution metadata", async () => {
    (prisma.preferenceApplication.updateMany as jest.Mock).mockResolvedValue({ count: 2 });
    (prisma.preferenceApplication.findMany as jest.Mock).mockResolvedValue([]);

    const strategy = {
      type: "remove_oldest" as const,
      label: "Keep Recent",
      description: "Remove old prefs",
      toRemove: ["pa1", "pa2"],
    };

    await applyResolution(strategy, "user1", "delib1");

    const updateCall = (prisma.preferenceApplication.updateMany as jest.Mock).mock.calls[0][0];
    expect(updateCall.data.conflictResolution).toMatchObject({
      strategy: "remove_oldest",
      label: "Keep Recent",
      description: "Remove old prefs",
      resolvedBy: "user1",
    });
  });
});

describe("Undo Resolution", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("restores resolved preferences", async () => {
    (prisma.preferenceApplication.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    const result = await undoResolution(["pa1"]);

    expect(result.restored).toBe(1);
    expect(prisma.preferenceApplication.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["pa1"] } },
      data: {
        conflictStatus: "none",
        conflictResolution: null,
        conflictResolvedAt: null,
        conflictResolvedBy: null,
      },
    });
  });

  test("handles empty PA ID array", async () => {
    const result = await undoResolution([]);

    expect(result.restored).toBe(0);
    expect(prisma.preferenceApplication.updateMany).not.toHaveBeenCalled();
  });

  test("restores multiple preferences", async () => {
    (prisma.preferenceApplication.updateMany as jest.Mock).mockResolvedValue({ count: 3 });

    const result = await undoResolution(["pa1", "pa2", "pa3"]);

    expect(result.restored).toBe(3);
  });
});

describe("Resolution History", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns resolution history", async () => {
    const mockResolved = [
      {
        id: "pa1",
        conflictResolvedAt: new Date("2025-01-10"),
        conflictResolvedBy: "user1",
        conflictResolution: { strategy: "remove_weakest" },
      },
      {
        id: "pa2",
        conflictResolvedAt: new Date("2025-01-09"),
        conflictResolvedBy: "user2",
        conflictResolution: { strategy: "remove_oldest" },
      },
    ];

    (prisma.preferenceApplication.findMany as jest.Mock).mockResolvedValue(mockResolved);

    const history = await getResolutionHistory("delib1");

    expect(history).toHaveLength(2);
    expect(history[0].strategy).toBe("remove_weakest");
    expect(history[1].strategy).toBe("remove_oldest");
  });

  test("filters out incomplete resolutions", async () => {
    const mockResolved = [
      {
        id: "pa1",
        conflictResolvedAt: new Date("2025-01-10"),
        conflictResolvedBy: "user1",
        conflictResolution: { strategy: "remove_weakest" },
      },
      {
        id: "pa2",
        conflictResolvedAt: null,
        conflictResolvedBy: null,
        conflictResolution: null,
      },
    ];

    (prisma.preferenceApplication.findMany as jest.Mock).mockResolvedValue(mockResolved);

    const history = await getResolutionHistory("delib1");

    expect(history).toHaveLength(1);
    expect(history[0].id).toBe("pa1");
  });

  test("handles missing strategy in resolution metadata", async () => {
    const mockResolved = [
      {
        id: "pa1",
        conflictResolvedAt: new Date("2025-01-10"),
        conflictResolvedBy: "user1",
        conflictResolution: {},
      },
    ];

    (prisma.preferenceApplication.findMany as jest.Mock).mockResolvedValue(mockResolved);

    const history = await getResolutionHistory("delib1");

    expect(history).toHaveLength(1);
    expect(history[0].strategy).toBe("unknown");
  });

  test("returns empty array when no resolutions", async () => {
    (prisma.preferenceApplication.findMany as jest.Mock).mockResolvedValue([]);

    const history = await getResolutionHistory("delib1");

    expect(history).toHaveLength(0);
  });
});
