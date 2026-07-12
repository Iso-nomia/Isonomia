import express from "express";
import request from "supertest";
import { NextRequest } from "next/server";

let mockPrisma: any;

jest.mock("@/lib/prismaclient", () => {
  mockPrisma = {
    notification: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
    },
  };
  return { prisma: mockPrisma };
});

jest.mock("@/lib/serverutils", () => ({
  getUserFromCookies: jest.fn(async () => ({ userId: BigInt(1) })),
}));

describe("notification routes", () => {
  it("fetch unread then mark read", async () => {
    const { GET } = await import("@/app/api/notifications/route");
    const { POST } = await import("@/app/api/notifications/read/route");

    mockPrisma.notification.findMany.mockResolvedValueOnce([
      { id: BigInt(1), read: false },
      { id: BigInt(2), read: false },
    ]);
    mockPrisma.notification.updateMany.mockResolvedValue({ count: 2 });
    mockPrisma.notification.findMany.mockResolvedValueOnce([]);

    const app = express();
    app.use(express.json());
    app.get("/api/notifications", async (req, res) => {
      const url = new URL(`http://localhost${req.originalUrl}`);
      const r = await GET(new NextRequest(url));
      res.status(r.status).set(Object.fromEntries(r.headers)).send(await r.text());
    });
    app.post("/api/notifications/read", async (req, res) => {
      const r = await POST(
        new NextRequest("http://localhost/api/notifications/read", {
          method: "POST",
          body: JSON.stringify(req.body),
        })
      );
      res.status(r.status).set(Object.fromEntries(r.headers)).send(await r.text());
    });

    let resp = await request(app).get("/api/notifications?unreadOnly=true");
    expect(resp.status).toBe(200);
    expect(resp.body.length).toBe(2);

    resp = await request(app).post("/api/notifications/read").send({ ids: [1, 2] });
    expect(resp.status).toBe(200);

    resp = await request(app).get("/api/notifications?unreadOnly=true");
    expect(resp.status).toBe(200);
    expect(resp.body.length).toBe(0);
  });
});
