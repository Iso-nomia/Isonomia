export function priceYes(qYes: number, qNo: number, b: number) {
  const expYes = Math.exp(qYes / b);
  const expNo = Math.exp(qNo / b);
  return expYes / (expYes + expNo);
}

export function costToBuy(
  side: "YES" | "NO",
  delta: number,
  qYes: number,
  qNo: number,
  b: number,
) {
  const C = (qY: number, qN: number) =>
    b * Math.log(Math.exp(qY / b) + Math.exp(qN / b));
  const costBefore = C(qYes, qNo);
  const costAfter = side === "YES" ? C(qYes + delta, qNo) : C(qYes, qNo + delta);
  return costAfter - costBefore;
}

export function calcSharesForSpend({ yesPool, noPool, b, spend, side }: { yesPool: number; noPool: number; b: number; spend: number; side: "YES" | "NO"; }) {
  let lo = 0;
  let hi = 1;
  while (costToBuy(side, hi, yesPool, noPool, b) < spend) {
    hi *= 2;
  }
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    const cost = costToBuy(side, mid, yesPool, noPool, b);
    if (cost > spend) hi = mid; else lo = mid;
  }
  const deltaQ = lo;
  const cost = Math.ceil(costToBuy(side, deltaQ, yesPool, noPool, b));
  return { deltaQ, cost };
}

export function estimateShares(
  side: "YES" | "NO",
  spend: number,
  market: { yesPool: number; noPool: number; b: number }
) {
  const { deltaQ, cost } = calcSharesForSpend({
    yesPool: market.yesPool,
    noPool: market.noPool,
    b: market.b,
    spend,
    side,
  });
  return { shares: deltaQ, cost };
}
