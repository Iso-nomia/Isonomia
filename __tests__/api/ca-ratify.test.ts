/**
 * PR2 of ATTACK_RATIFICATION_DEV_SPEC — ratify/withdraw endpoint (§5.1/§5.2).
 * Handler tests under the mocked harness (mirrors pa.test.ts).
 */
import { describe, test, expect, beforeEach } from "@jest/globals";

const mockCAFind = jest.fn();
const mockCAUpdate = jest.fn(async () => ({}));
const mockRatUpsert = jest.fn(async () => ({}));
const mockRatUpdateMany = jest.fn(async () => ({}));
const mockRatCount = jest.fn(async () => 0);
const mockPrefFind = jest.fn(async () => ({ attackRatificationPolicy: "single" as string | null }));

const mockClearedNotif = jest.fn(async () => {});

jest.mock("@/lib/serverutils", () => ({ getCurrentUserId: jest.fn() }));
jest.mock("@/lib/actions/notification.actions", () => ({
  createRatificationClearedNotif: (a: any) => mockClearedNotif(a),
}));
jest.mock("@/lib/prismaclient", () => ({
  prisma: {
    conflictApplication: { findUnique: (a: any) => mockCAFind(a), update: (a: any) => mockCAUpdate(a) },
    conflictRatification: {
      upsert: (a: any) => mockRatUpsert(a),
      updateMany: (a: any) => mockRatUpdateMany(a),
      count: (a: any) => mockRatCount(a),
    },
    deliberationPref: { findUnique: (a: any) => mockPrefFind(a) },
    deliberation: { findUnique: jest.fn(async () => ({ hostType: "room_thread" })) },
  },
}));

import { POST, DELETE } from "@/app/api/ca/[id]/ratify/route";
import { getCurrentUserId } from "@/lib/serverutils";

const req = {} as any;
const ctx = (id: string) => ({ params: { id } });
const ca = (over: Record<string, any> = {}) => ({
  id: "ca1",
  deliberationId: "d1",
  createdById: "author",
  ratificationStatus: "PROPOSED",
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockPrefFind.mockResolvedValue({ attackRatificationPolicy: "single" });
  mockRatCount.mockResolvedValue(0);
});

describe("POST /api/ca/[id]/ratify", () => {
  test("401 when unauthenticated", async () => {
    (getCurrentUserId as jest.Mock).mockResolvedValue(null);
    expect((await POST(req, ctx("ca1"))).status).toBe(401);
  });

  test("404 when the conflict does not exist", async () => {
    (getCurrentUserId as jest.Mock).mockResolvedValue("u1");
    mockCAFind.mockResolvedValue(null);
    expect((await POST(req, ctx("ca1"))).status).toBe(404);
  });

  test("403 on self-ratification", async () => {
    (getCurrentUserId as jest.Mock).mockResolvedValue("author");
    mockCAFind.mockResolvedValue(ca());
    const res = await POST(req, ctx("ca1"));
    expect(res.status).toBe(403);
    expect(mockRatUpsert).not.toHaveBeenCalled();
  });

  test("403 for AI/system actors", async () => {
    (getCurrentUserId as jest.Mock).mockResolvedValue("mcp-bot");
    mockCAFind.mockResolvedValue(ca({ createdById: "someoneElse" }));
    expect((await POST(req, ctx("ca1"))).status).toBe(403);
  });

  test("reaching the threshold flips PROPOSED → EFFECTIVE", async () => {
    (getCurrentUserId as jest.Mock).mockResolvedValue("u1");
    mockCAFind.mockResolvedValue(ca()); // single policy, threshold 1
    mockRatCount.mockResolvedValue(1);

    const res = await POST(req, ctx("ca1"));
    const data = await res.json();
    expect(data.ratificationStatus).toBe("EFFECTIVE");
    expect(mockCAUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ ratificationStatus: "EFFECTIVE" }) }),
    );
    // §7.2: the CA author is notified its attack cleared.
    expect(mockClearedNotif).toHaveBeenCalledWith(
      expect.objectContaining({ recipientUserId: "author", actorUserId: "u1", conflictApplicationId: "ca1" }),
    );
  });

  test("below the threshold stays PROPOSED (quorum:2, 1 sign-off)", async () => {
    (getCurrentUserId as jest.Mock).mockResolvedValue("u1");
    mockCAFind.mockResolvedValue(ca());
    mockPrefFind.mockResolvedValue({ attackRatificationPolicy: "quorum:2" });
    mockRatCount.mockResolvedValue(1);

    const res = await POST(req, ctx("ca1"));
    expect((await res.json()).ratificationStatus).toBe("PROPOSED");
    expect(mockCAUpdate).not.toHaveBeenCalled();
    expect(mockClearedNotif).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/ca/[id]/ratify", () => {
  test("withdrawal below threshold demotes EFFECTIVE → PROPOSED", async () => {
    (getCurrentUserId as jest.Mock).mockResolvedValue("u1");
    mockCAFind.mockResolvedValue(ca({ ratificationStatus: "EFFECTIVE" }));
    mockRatCount.mockResolvedValue(0); // dropped below single's threshold of 1

    const res = await DELETE(req, ctx("ca1"));
    expect((await res.json()).ratificationStatus).toBe("PROPOSED");
    expect(mockRatUpdateMany).toHaveBeenCalled();
    expect(mockCAUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ ratificationStatus: "PROPOSED", ratifiedAt: null }) }),
    );
  });
});
