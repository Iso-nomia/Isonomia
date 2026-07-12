import express from "express";
import request from "supertest";
import { NextRequest } from "next/server";

let currentUser: bigint = BigInt(1);
const db = {
  market: null as any,
  wallets: new Map<bigint, { userId: bigint; balanceCents: number; lockedCents: number }>([
    [BigInt(1), { userId: BigInt(1), balanceCents: 1000, lockedCents: 0 }],
    [BigInt(2), { userId: BigInt(2), balanceCents: 1000, lockedCents: 0 }],
    [BigInt(3), { userId: BigInt(3), balanceCents: 1000, lockedCents: 0 }],
  ]),
  trades: [] as any[],
};

jest.mock("@/lib/prismaclient", () => {
  const prisma = {
    $transaction: async (fn: any) => fn(prisma),
    $executeRaw: async () => {},
    predictionMarket: {
      findUniqueOrThrow: async ({ where: { id } }: any) => {
        if (!db.market || db.market.id !== id) throw new Error("not found");
        return { ...db.market };
      },
      update: async ({ where: { id }, data }: any) => {
        if (!db.market || db.market.id !== id) throw new Error("not found");
        if (data.yesPool?.increment) db.market.yesPool += data.yesPool.increment;
        if (data.noPool?.increment) db.market.noPool += data.noPool.increment;
        if (data.state) db.market.state = data.state;
        if (data.outcome) db.market.outcome = data.outcome;
        if (data.resolvesAt) db.market.resolvesAt = data.resolvesAt;
        return { ...db.market };
      },
    },
    wallet: {
      findUnique: async ({ where: { userId } }: any) => {
        const w = db.wallets.get(userId);
        return w ? { ...w } : null;
      },
      create: async ({ data }: any) => {
        db.wallets.set(data.userId, { ...data });
        return { ...data };
      },
      update: async ({ where: { userId }, data }: any) => {
        const w = db.wallets.get(userId)!;
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
      findMany: async ({ where: { marketId } }: any) => db.trades.filter(t => t.marketId === marketId),
    },
    notification: { create: jest.fn(), createMany: jest.fn() },
    resolutionLog: { create: jest.fn() },
  };
  return { prisma };
});

jest.mock("@/lib/serverutils", () => ({
  getUserFromCookies: jest.fn(async () => ({ userId: currentUser })),
}));

jest.mock("@/lib/actions/prediction.actions", () => ({
  createMarket: jest.fn(async ({ question, closesAt, liquidity }: any) => {
    const sanitized = question.replace(/<[^>]+>/g, "");
    db.market = {
      id: "m1",
      question: sanitized,
      closesAt: new Date(closesAt),
      b: liquidity ?? 100,
      state: "OPEN",
      creatorId: currentUser,
      oracleId: null,
      yesPool: 0,
      noPool: 0,
    };
    return { postId: "p1" };
  }),
}));

describe("market API flow", () => {
  beforeEach(() => {
    currentUser = BigInt(1);
    db.market = null;
    db.trades.length = 0;
    db.wallets.get(BigInt(1))!.balanceCents = 1000;
    db.wallets.get(BigInt(2))!.balanceCents = 1000;
    db.wallets.get(BigInt(3))!.balanceCents = 1000;
    process.env.ENABLE_PREDICTION_MARKETS = "true";
  });

  it("full lifecycle", async () => {
    const { POST: createMarketRoute } = await import("@/app/api/market/route");
    const { POST: tradeRoute } = await import("@/app/api/market/[id]/trade/route");
    const { POST: resolveRoute } = await import("@/app/api/market/[id]/resolve/route");
    const { GET: walletGet } = await import("@/app/api/wallet/route");

    const app = express();
    app.use(express.json());

    app.post("/api/market", async (req, res) => {
      const r = await createMarketRoute(new NextRequest("http://localhost/api/market", { method: "POST", body: JSON.stringify(req.body) }));
      res.status(r.status).set(Object.fromEntries(r.headers)).send(await r.text());
    });
    app.post("/api/market/:id/trade", async (req, res) => {
      const r = await tradeRoute(new NextRequest(`http://localhost/api/market/${req.params.id}/trade`, { method: "POST", body: JSON.stringify(req.body) }), { params: { id: req.params.id } });
      res.status(r.status).set(Object.fromEntries(r.headers)).send(await r.text());
    });
    app.post("/api/market/:id/resolve", async (req, res) => {
      const r = await resolveRoute(new NextRequest(`http://localhost/api/market/${req.params.id}/resolve`, { method: "POST", body: JSON.stringify(req.body) }), { params: { id: req.params.id } });
      res.status(r.status).set(Object.fromEntries(r.headers)).send(await r.text());
    });
    app.get("/api/wallet", async (_req, res) => {
      const r = await walletGet(new NextRequest("http://localhost/api/wallet"));
      res.status(r.status).set(Object.fromEntries(r.headers)).send(await r.text());
    });

    // Create market as user A
    await request(app).post("/api/market").send({ question: "Q?", closesAt: new Date().toISOString(), b: 100 });
    const startingTotal = Array.from(db.wallets.values()).reduce((a, w) => a + w.balanceCents, 0);

    // User B trades YES
    currentUser = BigInt(2);
    let resp = await request(app).post("/api/market/m1/trade").send({ spendCents: 200, side: "YES" });
    expect(resp.status).toBe(200);
    expect(db.wallets.get(BigInt(2))!.balanceCents).toBe(800);

    // Insufficient funds
    resp = await request(app).post("/api/market/m1/trade").send({ spendCents: 1_000_000, side: "YES" });
    expect(resp.status).toBe(402);

    // Close market
    const { prisma } = await import("@/lib/prismaclient");
    await prisma.predictionMarket.update({ where: { id: "m1" }, data: { state: "CLOSED" } });

    // Resolve by creator
    currentUser = BigInt(1);
    resp = await request(app).post("/api/market/m1/resolve").send({ outcome: "YES" });
    expect(resp.status).toBe(200);

    // Sum of wallets preserved
    const w1 = await request(app).get("/api/wallet");
    currentUser = BigInt(2);
    const w2 = await request(app).get("/api/wallet");
    currentUser = BigInt(3);
    const w3 = await request(app).get("/api/wallet");
    const finalTotal = Number(w1.body.balanceCents) + Number(w2.body.balanceCents) + Number(w3.body.balanceCents);
    expect(finalTotal).toBe(startingTotal);

    // Unauthorized resolve attempt by user C
    resp = await request(app).post("/api/market/m1/resolve").send({ outcome: "YES" });
    expect(resp.status).toBe(403);
  });
});
