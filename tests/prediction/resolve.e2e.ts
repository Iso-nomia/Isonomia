import { test, expect } from "@playwright/test";
import { calcSharesForSpend } from "@/lib/prediction/lmsr";

type Side = "YES" | "NO";

type Market = {
  id: string;
  yesPool: number;
  noPool: number;
  b: number;
  state: "OPEN" | "CLOSED" | "RESOLVED";
  outcome?: Side | "N_A";
  creatorId: bigint;
};

type Trade = { userId: bigint; side: Side; shares: number; cost: number };

type Wallet = { balanceCents: number };

const db = {
  market: {
    id: "m1",
    yesPool: 0,
    noPool: 0,
    b: 100,
    state: "OPEN" as const,
    creatorId: BigInt(1),
  } as Market,
  wallets: new Map<bigint, Wallet>(),
  trades: [] as Trade[],
};

db.wallets.set(BigInt(1), { balanceCents: 1000 });
db.wallets.set(BigInt(2), { balanceCents: 1000 });

function placeTrade(marketId: string, userId: bigint, spendCents: number, side: Side) {
  const { deltaQ, cost } = calcSharesForSpend({
    yesPool: db.market.yesPool,
    noPool: db.market.noPool,
    b: db.market.b,
    spend: spendCents,
    side,
  });
  const wallet = db.wallets.get(userId)!;
  wallet.balanceCents -= cost;
  if (side === "YES") db.market.yesPool += deltaQ; else db.market.noPool += deltaQ;
  const trade = { userId, side, shares: deltaQ, cost };
  db.trades.push(trade);
  return trade;
}

function resolveMarket(outcome: Side | "N_A", resolverId: bigint) {
  if (resolverId !== db.market.creatorId) throw new Error("unauthorized");
  if (db.market.state !== "CLOSED") throw new Error("not closed");
  let payouts = 0;
  for (const t of db.trades) {
    if (t.side === outcome) {
      const amt = Math.floor(t.shares);
      db.wallets.get(t.userId)!.balanceCents += amt;
      payouts += amt;
    }
  }
  db.market.state = "RESOLVED";
  db.market.outcome = outcome;
  return payouts;
}

test.beforeEach(() => {
  db.market.yesPool = 0;
  db.market.noPool = 0;
  db.market.state = "OPEN";
  delete db.market.outcome;
  db.wallets.get(BigInt(1))!.balanceCents = 1000;
  db.wallets.get(BigInt(2))!.balanceCents = 1000;
  db.trades.length = 0;
});

test("creator resolves after close credits trader", async () => {
  const trade = placeTrade("m1", BigInt(2), 100, "YES");
  db.market.state = "CLOSED";
  const pre = db.wallets.get(BigInt(2))!.balanceCents;
  const payout = resolveMarket("YES", BigInt(1));
  expect(payout).toBe(Math.floor(trade.shares));
  expect(db.wallets.get(BigInt(2))!.balanceCents).toBe(pre + Math.floor(trade.shares));
});
