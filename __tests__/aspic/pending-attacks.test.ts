/**
 * PR3 of ATTACK_RATIFICATION_DEV_SPEC — getPendingAttacks (§7.1). The PROPOSED
 * (un-ratified) attacks targeting an argument, surfaced as the provisional
 * "contested · pending k/N" label. Mocked prisma.
 */
import { describe, test, expect, beforeEach } from "@jest/globals";

const mockPrefFind = jest.fn(async () => ({ attackRatificationPolicy: null as string | null }));
const mockDelibFind = jest.fn(async () => ({ hostType: "room_thread" }));
const mockProposedFind = jest.fn(async () => [] as Array<{ id: string }>);
const mockRatCount = jest.fn(async () => 0);

jest.mock("@/lib/prismaclient", () => ({
  prisma: {
    deliberationPref: { findUnique: (a: any) => mockPrefFind(a) },
    deliberation: { findUnique: (a: any) => mockDelibFind(a) },
    conflictApplication: { findMany: (a: any) => mockProposedFind(a) },
    conflictRatification: { count: (a: any) => mockRatCount(a) },
  },
}));

import { getPendingAttacks } from "@/lib/aspic/deliberationEvaluation";

beforeEach(() => {
  jest.clearAllMocks();
  mockPrefFind.mockResolvedValue({ attackRatificationPolicy: null });
  mockDelibFind.mockResolvedValue({ hostType: "room_thread" });
  mockProposedFind.mockResolvedValue([]);
  mockRatCount.mockResolvedValue(0);
});

describe("getPendingAttacks", () => {
  test("no pending attacks → count 0 with the resolved threshold", async () => {
    const res = await getPendingAttacks("d1", "argA", "cA");
    expect(res).toEqual({ count: 0, threshold: 1, topSignoffs: 0 });
    // Queried both argument- and claim-level targets.
    expect(mockProposedFind).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          ratificationStatus: "PROPOSED",
          OR: [{ conflictedArgumentId: "argA" }, { conflictedClaimId: "cA" }],
        }),
      }),
    );
  });

  test("under a `none` policy nothing is gated → short-circuits to zero", async () => {
    mockDelibFind.mockResolvedValue({ hostType: "free" }); // free → none
    const res = await getPendingAttacks("d1", "argA", "cA");
    expect(res).toEqual({ count: 0, threshold: 0, topSignoffs: 0 });
    expect(mockProposedFind).not.toHaveBeenCalled();
  });

  test("reports count + the most-signed pending CA (closest to clearing)", async () => {
    mockProposedFind.mockResolvedValue([{ id: "caA" }, { id: "caB" }]);
    mockRatCount.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    const res = await getPendingAttacks("d1", "argA", "cA");
    expect(res).toEqual({ count: 2, threshold: 1, topSignoffs: 1 });
  });

  test("omitting the conclusion claim queries only the argument-level target", async () => {
    await getPendingAttacks("d1", "argA");
    expect(mockProposedFind).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ OR: [{ conflictedArgumentId: "argA" }] }),
      }),
    );
  });
});
