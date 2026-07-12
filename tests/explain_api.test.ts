import { NextRequest } from "next/server";
import * as cp from "child_process";
import { getRedis } from "@/lib/redis";
process.env.UPSTASH_REDIS_REST_URL = "http://localhost";
process.env.UPSTASH_REDIS_REST_TOKEN = "token";

let mockPrisma: any;

describe("why api", () => {
  let store: Record<string, string>;
  let execSpy: jest.SpyInstance;
  beforeEach(() => {
    store = {};
    jest.restoreAllMocks();
    execSpy = jest.spyOn(cp, "execFile").mockImplementation((_cmd: string, _args: string[], cb: any) =>
      cb(null, JSON.stringify({ FAV_ARTIST_OVERLAP: 0.9, RECENT_SWIPE_RIGHT: 0.1 }), "")
    );
    jest.doMock("@/lib/redis", () => ({
      __esModule: true,
      default: {
        get: jest.fn(async (k: string) => store[k] || null),
        setex: jest.fn(async (k: string, _t: number, v: string) => { store[k] = v; }),
      },
    }));
    jest.doMock("@/lib/prismaclient", () => {
      mockPrisma = {
        user_taste_vectors: {
          findUnique: jest.fn(async ({ where }: any) => {
            if (where.user_id === BigInt(1)) return { traits: { genres: ["sci-fi"] } };
            if (where.user_id === BigInt(2)) return { traits: { genres: ["sci-fi", "rock"] } };
            return null;
          }),
        },
        post: { findUnique: jest.fn(async () => ({ author_id: BigInt(2) })) },
      };
      return { prisma: mockPrisma };
    });
    jest.doMock("@upstash/ratelimit", () => ({
      Ratelimit: class { limit = jest.fn(async () => ({ success: true })); constructor(){} static tokenBucket(){ return null; } },
    }));
  });

  afterEach(() => {
    execSpy.mockRestore();
  });

  test("explainReturnsBothLocales", async () => {
    const { GET } = await import("@/app/api/v2/discovery/why/[targetId]/route");
    const req = new NextRequest(new URL("http://localhost/api/v2/discovery/why/abc?viewerId=1"));
    const res = await GET(req, { params: { targetId: "abc" } });
    const body = await res.json();
    expect(body.explanation.reason_en).toBeDefined();
    expect(body.explanation.reason_es).toBeDefined();
  });

  test("cacheHitShortCircuits", async () => {
    const { GET } = await import("@/app/api/v2/discovery/why/[targetId]/route");
    const req = new NextRequest(new URL("http://localhost/api/v2/discovery/why/abc?viewerId=1"));
    await GET(req, { params: { targetId: "abc" } });
    await GET(req, { params: { targetId: "abc" } });
    const cp = await import("child_process");
    expect((cp.execFile as jest.Mock).mock.calls.length).toBe(1);
  });

  test("returnsChipWhenOverlap", async () => {
    const { GET } = await import("@/app/api/v2/discovery/why/[targetId]/route");
    const req = new NextRequest(new URL("http://localhost/api/v2/discovery/why/abc?viewerId=1"));
    const res = await GET(req, { params: { targetId: "abc" } });
    const body = await res.json();
    expect(body.chip.en).toBe("Both appreciate sci-fi");
    expect(body.chip.es).toBe("Ambos disfrutan de sci-fi");
  });

  test("omitsChipWhenNoOverlap", async () => {
    mockPrisma.user_taste_vectors.findUnique.mockImplementation(async ({ where }: any) => {
      if (where.user_id === BigInt(1)) return { traits: { genres: ["romance"] } };
      if (where.user_id === BigInt(2)) return { traits: { genres: ["sci-fi"] } };
      return null;
    });
    mockPrisma.post.findUnique.mockResolvedValue({ author_id: BigInt(2) });
    const { GET: GET2 } = await import("@/app/api/v2/discovery/why/[targetId]/route");
    const req = new NextRequest(new URL("http://localhost/api/v2/discovery/why/def?viewerId=1"));
    const res = await GET2(req, { params: { targetId: "def" } });
    const body = await res.json();
    expect(body.chip).toBeUndefined();
  });
});
