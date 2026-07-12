import { jest } from "@jest/globals";
import { placeTrade, resolveMarket } from "@/packages/server/src/prediction/service";
import { calcSharesForSpend, priceYes } from "@/lib/prediction/lmsr";

// Simple in-memory mock of prisma
const db = {
  market: {
    id: "m1",
    yesPool: 0,
    noPool: 0,
    b: 100,
    state: "OPEN" as const,
    creatorId: BigInt(1),
    oracleId: null as bigint | null,
  },
  wallets: new Map<bigint, { userId: bigint; balanceCents: number; lockedCents: number }>([
    [BigInt(1), { userId: BigInt(1), balanceCents: 1000, lockedCents: 0 }],
    [BigInt(2), { userId: BigInt(2), balanceCents: 1000, lockedCents: 0 }],
  ]),
  trades: [] as any[],
  logs: [] as any[],
  notifications: [] as any[],
};

jest.mock("@/lib/prismaclient", () => {
  const prisma = {
    $transaction: async (fn: any) => fn(prisma),
    $executeRaw: async () => {},
    predictionMarket: {
      findUniqueOrThrow: async ({ where: { id } }: any) => {
        if (db.market.id !== id) throw new Error("not found");
        return { ...db.market };
      },
      update: async ({ where: { id }, data }: any) => {
        if (db.market.id !== id) throw new Error("not found");
        if (data.yesPool?.increment) db.market.yesPool += data.yesPool.increment;
        if (data.noPool?.increment) db.market.noPool += data.noPool.increment;
        if (data.state) db.market.state = data.state;
        if (data.outcome) (db.market as any).outcome = data.outcome;
        if (data.resolvesAt) (db.market as any).resolvesAt = data.resolvesAt;
        return { ...db.market };
      },
    },
    wallet: {
      findUnique: async ({ where: { userId } }: any) => {
        const w = db.wallets.get(userId);
        return w ? { ...w } : null;
      },
      update: async ({ where: { userId }, data }: any) => {
        const w = db.wallets.get(userId);
        if (!w) throw new Error("not found");
        if (data.balanceCents?.decrement) w.balanceCents -= data.balanceCents.decrement;
        if (data.balanceCents?.increment) w.balanceCents += data.balanceCents.increment;
        return { ...w };
      },
    },
    trade: {
      create: async ({ data }: any) => {
        const t = { id: String(db.trades.length + 1), ...data };
        db.trades.push(t);
        return t;
      },
      findMany: async ({ where: { marketId } }: any) => db.trades.filter((t) => t.marketId === marketId),
    },
    notification: {
      create: async ({ data }: any) => {
        db.notifications.push(data);
        return data;
      },
      createMany: async ({ data }: any) => {
        db.notifications.push(...data);
        return { count: data.length };
      },
    },
    resolutionLog: {
      create: async ({ data }: any) => {
        db.logs.push(data);
        return data;
      },
    },
  };
  return { prisma };
});

describe("prediction service", () => {
  beforeEach(() => {
    db.market.yesPool = 0;
    db.market.noPool = 0;
    db.market.state = "OPEN";
    db.wallets.get(BigInt(1))!.balanceCents = 1000;
    db.wallets.get(BigInt(2))!.balanceCents = 1000;
    db.trades.length = 0;
    db.logs.length = 0;
    db.notifications.length = 0;
  });

  test("buying 100¢ of YES moves price up", async () => {
    const { newYesProb } = await placeTrade({ marketId: "m1", userId: BigInt(1), spendCents: 100, side: "YES" });
    expect(newYesProb).toBeGreaterThan(0.5);
  });

  test("wallet debits equal LMSR bank", async () => {
    const res = await placeTrade({ marketId: "m1", userId: BigInt(1), spendCents: 100, side: "YES" });
    const totalDebit = 1000 - db.wallets.get(BigInt(1))!.balanceCents;
    const C = (y: number, n: number) => db.market.b * Math.log(Math.exp(y / db.market.b) + Math.exp(n / db.market.b));
    const liability = C(db.market.yesPool, db.market.noPool) - C(0, 0);
    expect(totalDebit).toBeCloseTo(liability, 0);
    expect(res.shares).toBeCloseTo(calcSharesForSpend({ yesPool: 0, noPool: 0, b: 100, spend: 100, side: "YES" }).deltaQ, 3);
  });

  test("resolution pays per share and preserves credits", async () => {
    const trade = await placeTrade({ marketId: "m1", userId: BigInt(1), spendCents: 100, side: "YES" });
    const preTotal = db.wallets.get(BigInt(1))!.balanceCents;
    const { payouts, totalPaid } = await resolveMarket({ marketId: "m1", outcome: "YES", resolverId: BigInt(1) });
    expect(payouts).toBe(1);
    expect(totalPaid).toBe(Math.floor(trade.shares));
    expect(db.wallets.get(BigInt(1))!.balanceCents).toBe(preTotal + Math.floor(trade.shares));
  });

  test("trade emits notification", async () => {
    await placeTrade({ marketId: "m1", userId: BigInt(1), spendCents: 100, side: "YES" });
    expect(db.notifications).toHaveLength(1);
    expect(db.notifications[0].type).toBe("TRADE_EXECUTED");
  });

  test("resolve notifies all traders", async () => {
    await placeTrade({ marketId: "m1", userId: BigInt(1), spendCents: 100, side: "YES" });
    await placeTrade({ marketId: "m1", userId: BigInt(2), spendCents: 50, side: "NO" });
    db.notifications.length = 0;
    await resolveMarket({ marketId: "m1", outcome: "YES", resolverId: BigInt(1) });
    const resolved = db.notifications.filter((n) => n.type === "MARKET_RESOLVED");
    expect(resolved).toHaveLength(2);
  });
});
