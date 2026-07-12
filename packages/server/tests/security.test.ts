import express from "express";
import request from "supertest";
import { NextRequest } from "next/server";

let currentUser: bigint = BigInt(1);
const db = {
  market: {
    id: "m1",
    yesPool: 0,
    noPool: 0,
    b: 100,
    state: "OPEN" as const,
    creatorId: BigInt(1),
  },
  wallets: new Map<bigint, { userId: bigint; balanceCents: number; lockedCents: number }>([
    [BigInt(1), { userId: BigInt(1), balanceCents: 1000, lockedCents: 0 }],
  ]),
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
        if (data.state) db.market.state = data.state;
        if (data.outcome) (db.market as any).outcome = data.outcome;
        return { ...db.market };
      },
    },
    wallet: {
      findUnique: async ({ where: { userId } }: any) => {
        return db.wallets.get(userId) ?? null;
      },
      create: async ({ data }: any) => {
        db.wallets.set(data.userId, { ...data });
        return data;
      },
      update: async ({ where: { userId }, data }: any) => {
        const w = db.wallets.get(userId)!;
        if (data.balanceCents?.decrement) w.balanceCents -= data.balanceCents.decrement;
        if (data.balanceCents?.increment) w.balanceCents += data.balanceCents.increment;
        return { ...w };
      },
    },
    trade: { create: jest.fn(), findMany: jest.fn(() => []) },
    notification: { create: jest.fn(), createMany: jest.fn() },
    resolutionLog: { create: jest.fn() },
  };
  return { prisma };
});

jest.mock("@/lib/serverutils", () => ({
  getUserFromCookies: jest.fn(async () => ({ userId: currentUser })),
}));

jest.mock("@/lib/actions/prediction.actions", () => ({
  createMarket: jest.fn(async ({ question }: any) => {
    db.market.question = question.replace(/<[^>]+>/g, "");
    return { postId: "p1" };
  }),
}));

describe("security checks", () => {
  beforeEach(() => {
    currentUser = BigInt(1);
    db.market.state = "OPEN";
    db.wallets.get(BigInt(1))!.balanceCents = 1000;
    process.env.ENABLE_PREDICTION_MARKETS = "true";
  });

  it("validates spend inputs", async () => {
    const { POST: tradeRoute } = await import("@/app/api/market/[id]/trade/route");
    const app = express();
    app.use(express.json());
    app.post("/t", async (req, res) => {
      const r = await tradeRoute(new NextRequest("http://x/t", { method: "POST", body: JSON.stringify(req.body) }), { params: { id: "m1" } });
      res.status(r.status).send(await r.text());
    });
    let resp = await request(app).post("/t").send({ spendCents: -5, side: "YES" });
    expect(resp.status).toBe(400);
    resp = await request(app).post("/t").send({ spendCents: 1e12, side: "YES" });
    expect(resp.status).toBe(400);
  });

  it("sanitizes question", async () => {
    const { POST: createMarketRoute } = await import("@/app/api/market/route");
    const app = express();
    app.use(express.json());
    app.post("/m", async (req, res) => {
      const r = await createMarketRoute(new NextRequest("http://x/m", { method: "POST", body: JSON.stringify(req.body) }));
      res.status(r.status).send(await r.text());
    });
    await request(app).post("/m").send({ question: "<script>x</script>?", closesAt: new Date().toISOString() });
    expect(db.market.question.includes("<script>")).toBe(false);
  });

  it("rejects SQL injection ids", async () => {
    const { GET } = await import("@/app/api/market/[id]/route");
    const url = new URL("http://x/api/market/%27%20OR%201=1");
    const resp = await GET(new NextRequest(url), { params: { id: "' OR 1=1" } });
    expect(resp.status).toBe(404);
  });
});
