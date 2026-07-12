import { priceYes, costToBuy, estimateShares } from "@/lib/prediction/lmsr";

describe("lmsr helpers", () => {
  test("zero pools yields 50/50", () => {
    expect(priceYes(0, 0, 100)).toBeCloseTo(0.5, 5);
  });

  test("buy 100¢ YES moves price", () => {
    const { deltaQ } = estimateShares("YES", 100, { yesPool: 0, noPool: 0, b: 100 });
    const cost = costToBuy("YES", deltaQ, 0, 0, 100);
    expect(cost).toBeLessThanOrEqual(100);
    const newPrice = priceYes(deltaQ, 0, 100);
    expect(newPrice).toBeGreaterThan(0.55);
    expect(newPrice).toBeLessThan(0.7);
  });

  test("price symmetry", () => {
    const yes = priceYes(5, 3, 50);
    const no = 1 - priceYes(5, 3, 50);
    expect(yes + no).toBeCloseTo(1, 9);
  });

  test("large b keeps price near 0.5", () => {
    const { deltaQ } = estimateShares("YES", 100, { yesPool: 0, noPool: 0, b: 1e6 });
    const newPrice = priceYes(deltaQ, 0, 1e6);
    expect(newPrice).toBeCloseTo(0.5, 3);
  });

  test("estimateShares converges", () => {
    const spend = 123;
    const { shares, cost } = estimateShares("YES", spend, { yesPool: 10, noPool: 5, b: 50 });
    expect(cost).toBeLessThanOrEqual(spend);
    expect(cost).toBeGreaterThan(spend - 1);
    const actualCost = costToBuy("YES", shares, 10, 5, 50);
    expect(actualCost).toBeLessThanOrEqual(spend);
    expect(actualCost).toBeGreaterThan(spend - 1);
  });
});
