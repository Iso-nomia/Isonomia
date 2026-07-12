/**
 * H2 invariant — `reconstructChronicle` parity.
 *
 * Validates that `lib/ludics/chronicles/reconstruct.ts` returns the
 * same `{ actId, order }` row-set, in the same order, that consumers
 * currently fetch via
 * `prisma.ludicChronicle.findMany({ where: { designId }, orderBy: { order: "asc" } })`.
 *
 * The contract is order-equivalence on `LudicAct.orderInDesign`: the
 * reconstructed chronicle is exactly the persisted `LudicAct` rows
 * keyed by `designId`, sorted by `orderInDesign` ascending, projected
 * to `{ actId: act.id, order: act.orderInDesign }`.
 */

jest.mock("@/lib/prismaclient", () => {
  const ludicAct = { findMany: jest.fn() };
  return { prisma: { ludicAct } };
});

import { prisma as prismaSingleton } from "@/lib/prismaclient";
import { reconstructChronicle } from "@/lib/ludics/chronicles/reconstruct";

const prismaMock = prismaSingleton as unknown as {
  ludicAct: { findMany: jest.Mock };
};

const DESIGN_ID = "design_h2_parity_001";

describe("H2 — reconstructChronicle parity", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns LudicAct rows as { actId, order } sorted by orderInDesign asc", async () => {
    prismaMock.ludicAct.findMany.mockResolvedValueOnce([
      { id: "act_a", orderInDesign: 0 },
      { id: "act_b", orderInDesign: 1 },
      { id: "act_c", orderInDesign: 2 },
    ]);

    const result = await reconstructChronicle(DESIGN_ID);

    // Prisma is called with the canonical filter + ordering + projection.
    expect(prismaMock.ludicAct.findMany).toHaveBeenCalledWith({
      where: { designId: DESIGN_ID },
      orderBy: { orderInDesign: "asc" },
      select: { id: true, orderInDesign: true },
    });
    expect(result).toEqual([
      { actId: "act_a", order: 0 },
      { actId: "act_b", order: 1 },
      { actId: "act_c", order: 2 },
    ]);
  });

  it("returns [] for designs with no acts", async () => {
    prismaMock.ludicAct.findMany.mockResolvedValueOnce([]);
    const result = await reconstructChronicle(DESIGN_ID);
    expect(result).toEqual([]);
  });

  it("preserves the order returned by prisma (no client-side re-sort)", async () => {
    // The contract relies on prisma's orderBy. The helper must NOT
    // re-sort or rearrange the rows it gets back; this catches
    // regressions where someone introduces a defensive sort that
    // disagrees with the legacy `LudicChronicle.order` column.
    prismaMock.ludicAct.findMany.mockResolvedValueOnce([
      { id: "act_x", orderInDesign: 5 },
      { id: "act_y", orderInDesign: 7 },
      { id: "act_z", orderInDesign: 12 },
    ]);

    const result = await reconstructChronicle(DESIGN_ID);

    expect(result).toEqual([
      { actId: "act_x", order: 5 },
      { actId: "act_y", order: 7 },
      { actId: "act_z", order: 12 },
    ]);
  });
});
