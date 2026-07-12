/**
 * Integration tests for conflict resolution API endpoints
 */

import { NextRequest } from "next/server";
import { GET as getConflicts } from "@/app/api/aspic/conflicts/route";
import { POST as resolveConflict } from "@/app/api/aspic/conflicts/resolve/route";
import { POST as undoResolution } from "@/app/api/aspic/conflicts/undo/route";
import { prisma } from "@/lib/prismaclient";
import { getUserFromCookies } from "@/lib/serverutils";

// Mock dependencies
jest.mock("@/lib/serverutils", () => ({
  getUserFromCookies: jest.fn(),
}));

jest.mock("@/lib/prismaclient", () => ({
  prisma: {
    preferenceApplication: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
    },
  },
}));

jest.mock("@/lib/aspic/translation/aifToASPIC", () => ({
  detectPreferenceCycles: jest.fn((prefs) => {
    // Simple 2-cycle detection for testing
    const cycles: string[][] = [];
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

describe("GET /api/aspic/conflicts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns 401 when not authenticated", async () => {
    (getUserFromCookies as jest.Mock).mockResolvedValue(null);

    const req = new NextRequest("http://localhost:3000/api/aspic/conflicts?deliberationId=test123");
    const response = await getConflicts(req);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  test("returns 400 when deliberationId is missing", async () => {
    (getUserFromCookies as jest.Mock).mockResolvedValue({ uid: "user1" });

    const req = new NextRequest("http://localhost:3000/api/aspic/conflicts");
    const response = await getConflicts(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Invalid query");
  });

  test("returns empty array when no conflicts", async () => {
    (getUserFromCookies as jest.Mock).mockResolvedValue({ uid: "user1" });
    (prisma.preferenceApplication.findMany as jest.Mock).mockResolvedValue([
      {
        id: "pa1",
        preferredArgumentId: "argA",
        dispreferredArgumentId: "argB",
        preferredClaimId: null,
        dispreferredClaimId: null,
        weight: 1.0,
        createdAt: new Date("2025-01-01"),
        createdById: "user1",
        conflictStatus: "none",
        createdBy: { username: "user1", displayName: null },
      },
    ]);

    const req = new NextRequest("http://localhost:3000/api/aspic/conflicts?deliberationId=test123");
    const response = await getConflicts(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.conflicts).toEqual([]);
    expect(data.total).toBe(0);
  });

  test("detects and returns conflicts", async () => {
    (getUserFromCookies as jest.Mock).mockResolvedValue({ uid: "user1" });
    (prisma.preferenceApplication.findMany as jest.Mock).mockResolvedValue([
      {
        id: "pa1",
        preferredArgumentId: "argA",
        dispreferredArgumentId: "argB",
        preferredClaimId: null,
        dispreferredClaimId: null,
        weight: 1.0,
        createdAt: new Date("2025-01-01"),
        createdById: "user1",
        justification: "Test",
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
    ]);
    (prisma.preferenceApplication.updateMany as jest.Mock).mockResolvedValue({ count: 2 });

    const req = new NextRequest("http://localhost:3000/api/aspic/conflicts?deliberationId=test123");
    const response = await getConflicts(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.conflicts).toHaveLength(1);
    expect(data.total).toBe(1);
    expect(data.totalPreferencesAffected).toBe(2);
    expect(data.conflicts[0].type).toBe("cycle");
    expect(data.conflicts[0].preferences).toHaveLength(2);
  });

  test("marks conflicts as detected", async () => {
    (getUserFromCookies as jest.Mock).mockResolvedValue({ uid: "user1" });
    (prisma.preferenceApplication.findMany as jest.Mock).mockResolvedValue([
      {
        id: "pa1",
        preferredArgumentId: "argA",
        dispreferredArgumentId: "argB",
        preferredClaimId: null,
        dispreferredClaimId: null,
        weight: 1.0,
        createdAt: new Date(),
        createdById: "user1",
        conflictStatus: "none",
        createdBy: { username: "user1", displayName: null },
      },
      {
        id: "pa2",
        preferredArgumentId: "argB",
        dispreferredArgumentId: "argA",
        preferredClaimId: null,
        dispreferredClaimId: null,
        weight: 1.0,
        createdAt: new Date(),
        createdById: "user1",
        conflictStatus: "none",
        createdBy: { username: "user1", displayName: null },
      },
    ]);
    (prisma.preferenceApplication.updateMany as jest.Mock).mockResolvedValue({ count: 2 });

    const req = new NextRequest("http://localhost:3000/api/aspic/conflicts?deliberationId=test123");
    await getConflicts(req);

    expect(prisma.preferenceApplication.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["pa1", "pa2"] } },
      data: { conflictStatus: "detected" },
    });
  });
});

describe("POST /api/aspic/conflicts/resolve", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns 401 when not authenticated", async () => {
    (getUserFromCookies as jest.Mock).mockResolvedValue(null);

    const req = new NextRequest("http://localhost:3000/api/aspic/conflicts/resolve", {
      method: "POST",
      body: JSON.stringify({
        deliberationId: "test123",
        conflictIndex: 0,
        strategyType: "remove_weakest",
      }),
    });
    const response = await resolveConflict(req);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  test("returns 400 for invalid request body", async () => {
    (getUserFromCookies as jest.Mock).mockResolvedValue({ uid: "user1" });

    const req = new NextRequest("http://localhost:3000/api/aspic/conflicts/resolve", {
      method: "POST",
      body: JSON.stringify({ invalid: "data" }),
    });
    const response = await resolveConflict(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Invalid request");
  });

  test("returns 404 when conflict index out of range", async () => {
    (getUserFromCookies as jest.Mock).mockResolvedValue({ uid: "user1" });
    (prisma.preferenceApplication.findMany as jest.Mock).mockResolvedValue([]);

    const req = new NextRequest("http://localhost:3000/api/aspic/conflicts/resolve", {
      method: "POST",
      body: JSON.stringify({
        deliberationId: "test123",
        conflictIndex: 5,
        strategyType: "remove_weakest",
      }),
    });
    const response = await resolveConflict(req);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain("Conflict not found");
  });

  test("resolves conflict with remove_weakest strategy", async () => {
    (getUserFromCookies as jest.Mock).mockResolvedValue({ uid: "user1" });
    
    // First call: return cycle, second call: return empty (resolved)
    (prisma.preferenceApplication.findMany as jest.Mock)
      .mockResolvedValueOnce([
        {
          id: "pa1",
          preferredArgumentId: "argA",
          dispreferredArgumentId: "argB",
          preferredClaimId: null,
          dispreferredClaimId: null,
          weight: 0.5,
          createdAt: new Date("2025-01-01"),
          createdById: "user1",
          conflictStatus: "none",
          createdBy: { username: "user1", displayName: null },
        },
        {
          id: "pa2",
          preferredArgumentId: "argB",
          dispreferredArgumentId: "argA",
          preferredClaimId: null,
          dispreferredClaimId: null,
          weight: 1.0,
          createdAt: new Date("2025-01-02"),
          createdById: "user1",
          conflictStatus: "none",
          createdBy: { username: "user1", displayName: null },
        },
      ])
      .mockResolvedValueOnce([]); // After resolution, no more conflicts
    
    (prisma.preferenceApplication.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    const req = new NextRequest("http://localhost:3000/api/aspic/conflicts/resolve", {
      method: "POST",
      body: JSON.stringify({
        deliberationId: "test123",
        conflictIndex: 0,
        strategyType: "remove_weakest",
      }),
    });
    const response = await resolveConflict(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.removed).toBe(1);
    expect(data.remainingConflicts).toBe(0);
    expect(prisma.preferenceApplication.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["pa1"] } },
        data: expect.objectContaining({
          conflictStatus: "resolved",
          conflictResolvedBy: "user1",
        }),
      })
    );
  });

  test("requires manualPAIds for user_selection strategy", async () => {
    (getUserFromCookies as jest.Mock).mockResolvedValue({ uid: "user1" });
    (prisma.preferenceApplication.findMany as jest.Mock).mockResolvedValue([
      {
        id: "pa1",
        preferredArgumentId: "argA",
        dispreferredArgumentId: "argB",
        preferredClaimId: null,
        dispreferredClaimId: null,
        weight: 1.0,
        createdAt: new Date(),
        createdById: "user1",
        conflictStatus: "none",
        createdBy: { username: "user1", displayName: null },
      },
      {
        id: "pa2",
        preferredArgumentId: "argB",
        dispreferredArgumentId: "argA",
        preferredClaimId: null,
        dispreferredClaimId: null,
        weight: 1.0,
        createdAt: new Date(),
        createdById: "user1",
        conflictStatus: "none",
        createdBy: { username: "user1", displayName: null },
      },
    ]);

    const req = new NextRequest("http://localhost:3000/api/aspic/conflicts/resolve", {
      method: "POST",
      body: JSON.stringify({
        deliberationId: "test123",
        conflictIndex: 0,
        strategyType: "user_selection",
      }),
    });
    const response = await resolveConflict(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Manual selection requires");
  });

  test("validates manualPAIds are in conflict", async () => {
    (getUserFromCookies as jest.Mock).mockResolvedValue({ uid: "user1" });
    (prisma.preferenceApplication.findMany as jest.Mock).mockResolvedValue([
      {
        id: "pa1",
        preferredArgumentId: "argA",
        dispreferredArgumentId: "argB",
        preferredClaimId: null,
        dispreferredClaimId: null,
        weight: 1.0,
        createdAt: new Date(),
        createdById: "user1",
        conflictStatus: "none",
        createdBy: { username: "user1", displayName: null },
      },
      {
        id: "pa2",
        preferredArgumentId: "argB",
        dispreferredArgumentId: "argA",
        preferredClaimId: null,
        dispreferredClaimId: null,
        weight: 1.0,
        createdAt: new Date(),
        createdById: "user1",
        conflictStatus: "none",
        createdBy: { username: "user1", displayName: null },
      },
    ]);

    const req = new NextRequest("http://localhost:3000/api/aspic/conflicts/resolve", {
      method: "POST",
      body: JSON.stringify({
        deliberationId: "test123",
        conflictIndex: 0,
        strategyType: "user_selection",
        manualPAIds: ["pa999"], // Invalid PA ID
      }),
    });
    const response = await resolveConflict(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("not part of this conflict");
    expect(data.invalidPAIds).toContain("pa999");
  });
});

describe("POST /api/aspic/conflicts/undo", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns 401 when not authenticated", async () => {
    (getUserFromCookies as jest.Mock).mockResolvedValue(null);

    const req = new NextRequest("http://localhost:3000/api/aspic/conflicts/undo", {
      method: "POST",
      body: JSON.stringify({ paIds: ["pa1"] }),
    });
    const response = await undoResolution(req);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  test("returns 400 when paIds is empty", async () => {
    (getUserFromCookies as jest.Mock).mockResolvedValue({ uid: "user1" });

    const req = new NextRequest("http://localhost:3000/api/aspic/conflicts/undo", {
      method: "POST",
      body: JSON.stringify({ paIds: [] }),
    });
    const response = await undoResolution(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Invalid request");
  });

  test("restores resolved preferences", async () => {
    (getUserFromCookies as jest.Mock).mockResolvedValue({ uid: "user1" });
    (prisma.preferenceApplication.updateMany as jest.Mock).mockResolvedValue({ count: 2 });

    const req = new NextRequest("http://localhost:3000/api/aspic/conflicts/undo", {
      method: "POST",
      body: JSON.stringify({ paIds: ["pa1", "pa2"] }),
    });
    const response = await undoResolution(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.restored).toBe(2);
    expect(data.message).toContain("2 preferences");
    expect(prisma.preferenceApplication.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["pa1", "pa2"] } },
      data: {
        conflictStatus: "none",
        conflictResolution: null,
        conflictResolvedAt: null,
        conflictResolvedBy: null,
      },
    });
  });

  test("handles invalid JSON", async () => {
    (getUserFromCookies as jest.Mock).mockResolvedValue({ uid: "user1" });

    const req = new NextRequest("http://localhost:3000/api/aspic/conflicts/undo", {
      method: "POST",
      body: "invalid json{",
    });
    const response = await undoResolution(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid JSON body");
  });
});
