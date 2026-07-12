import { priceYes, costToBuy } from "@/lib/prediction/lmsr";

describe("LMSR math", () => {
  test("priceYes symmetric pools", () => {
    const p = priceYes(0, 0, 100);
    expect(p).toBeCloseTo(0.5, 5);
  });

  test("priceYes shifts with pools", () => {
    const p = priceYes(10, 0, 100);
    expect(p).toBeGreaterThan(0.5);
  });

  test("costToBuy increases with delta", () => {
    const small = costToBuy("YES", 1, 0, 0, 100);
    const large = costToBuy("YES", 2, 0, 0, 100);
    expect(large).toBeGreaterThan(small);
  });
});
