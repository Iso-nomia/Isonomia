import { estimateShares } from "@/lib/prediction/tradePreview";
import { priceYes } from "@/lib/prediction/lmsr";

describe("trade preview", () => {
  test("spend 0 yields no shares", () => {
    const { shares } = estimateShares("YES", 0, 0, 0, 100);
    expect(shares).toBe(0);
  });

  test("large spend pushes price near 100%", () => {
    const { shares } = estimateShares("YES", 1_000_000, 0, 0, 100);
    const price = priceYes(shares, 0, 100);
    expect(price).toBeGreaterThan(0.99);
  });
});
