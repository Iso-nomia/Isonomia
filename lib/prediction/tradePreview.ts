import { costToBuy } from "./lmsr";

export function estimateShares(
  side: "YES" | "NO",
  spend: number,
  yes: number,
  no: number,
  b: number
): { shares: number; cost: number } {
  if (spend <= 0) return { shares: 0, cost: 0 };
  let lo = 0;
  let hi = 1;
  
  while (costToBuy(side, hi, yes, no, b) < spend) {
    hi *= 2;
  }
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    const c = costToBuy(side, mid, yes, no, b);
    if (c > spend) hi = mid; else lo = mid;
  }
  const shares = lo;
  const cost = Math.ceil(costToBuy(side, shares, yes, no, b));
  return { shares, cost };
}
