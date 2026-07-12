/**
 * PR3 of ATTACK_RATIFICATION_DEV_SPEC — policy override + loosening sweep (§3.3).
 * Handler tests, mocked prisma.
 */
import { describe, test, expect, beforeEach } from "@jest/globals";

const mockPrefUpsert = jest.fn(async () => ({}));
const mockProposedFind = jest.fn(async () => [] as Array<{ id: string }>);
const mockRatCount = jest.fn(async () => 0);
const mockCAUpdate = jest.fn(async () => ({}));

jest.mock("@/lib/serverutils", () => ({ getCurrentUserId: jest.fn() }));
jest.mock("@/lib/prismaclient", () => ({
  prisma: {
    deliberationPref: { upsert: (a: any) => mockPrefUpsert(a) },
    conflictApplication: {
      findMany: (a: any) => mockProposedFind(a),
      update: (a: any) => mockCAUpdate(a),
    },
    conflictRatification: { count: (a: any) => mockRatCount(a) },
  },
}));

import { PUT } from "@/app/api/deliberations/[id]/ratification-policy/route";
import { getCurrentUserId } from "@/lib/serverutils";

const ctx = (id: string) => ({ params: { id } });
const reqWith = (body: any) => ({ json: async () => body }) as any;

beforeEach(() => {
  jest.clearAllMocks();
  (getCurrentUserId as jest.Mock).mockResolvedValue("u1");
  mockProposedFind.mockResolvedValue([]);
  mockRatCount.mockResolvedValue(0);
});

describe("PUT /api/deliberations/[id]/ratification-policy", () => {
  test("401 when unauthenticated", async () => {
    (getCurrentUserId as jest.Mock).mockResolvedValue(null);
    expect((await PUT(reqWith({ policy: "single" }), ctx("d1"))).status).toBe(401);
  });

  test("400 on an invalid policy string", async () => {
    const res = await PUT(reqWith({ policy: "quorum:0" }), ctx("d1"));
    expect(res.status).toBe(400);
    expect(mockPrefUpsert).not.toHaveBeenCalled();
  });

  test("writes the override and creates the pref with a profile baseline", async () => {
    const res = await PUT(reqWith({ policy: "quorum:3" }), ctx("d1"));
    expect((await res.json()).policy).toEqual({ kind: "quorum", n: 3 });
    expect(mockPrefUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { attackRatificationPolicy: "quorum:3" },
        create: expect.objectContaining({ deliberationId: "d1", profile: "community", attackRatificationPolicy: "quorum:3" }),
      }),
    );
  });

  test("loosening sweep promotes a PROPOSED CA that now clears the threshold", async () => {
    mockProposedFind.mockResolvedValue([{ id: "caA" }, { id: "caB" }]);
    // caA has 1 live sign-off, caB has 0 — new policy "single" (threshold 1).
    mockRatCount.mockResolvedValueOnce(1).mockResolvedValueOnce(0);

    const res = await PUT(reqWith({ policy: "single" }), ctx("d1"));
    const data = await res.json();
    expect(data.promoted).toBe(1);
    expect(data.scanned).toBe(2);
    expect(mockCAUpdate).toHaveBeenCalledTimes(1);
    expect(mockCAUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "caA" }, data: expect.objectContaining({ ratificationStatus: "EFFECTIVE" }) }),
    );
  });

  test("loosening to none promotes every PROPOSED CA without counting sign-offs", async () => {
    mockProposedFind.mockResolvedValue([{ id: "caA" }, { id: "caB" }]);
    const res = await PUT(reqWith({ policy: "none" }), ctx("d1"));
    expect((await res.json()).promoted).toBe(2);
    expect(mockRatCount).not.toHaveBeenCalled(); // threshold 0 short-circuit
    expect(mockCAUpdate).toHaveBeenCalledTimes(2);
  });
});
