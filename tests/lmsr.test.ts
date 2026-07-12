import { priceYes, costToBuy } from "@/lib/prediction/lmsr";

describe("lmsr formulas", () => {
  test("base price is 50/50", () => {
    expect(priceYes(0, 0, 100)).toBeCloseTo(0.5, 5);
  });

  test("cost to buy increases with shares", () => {
    const c1 = costToBuy("YES", 1, 0, 0, 100);
    const c2 = costToBuy("YES", 2, 0, 0, 100);
    expect(c2).toBeGreaterThan(c1);
  });
});
