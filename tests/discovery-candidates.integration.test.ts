import { NextRequest } from "next/server";

let mockRedis: any;
let mockTT: any;
let mockTaste: any;

jest.mock("@/lib/twoTower", () => {
  mockTT = jest.fn();
  return { getTwoTowerCandidates: mockTT };
});

jest.mock("@/util/taste", () => {
  mockTaste = jest.fn();
  return { tasteFallbackCandidates: mockTaste };
});

jest.mock("next-rate-limit", () => () => ({ check: jest.fn() }));

jest.mock("@/lib/redis", () => {
  const store: Record<string, string> = {};
  mockRedis = {
    get: jest.fn(async (k: string) => store[k] || null),
    setex: jest.fn(async (k: string, ttl: number, v: string) => {
      store[k] = v;
    }),
    del: jest.fn(),
  };
  return { __esModule: true, default: mockRedis };
});

jest.mock("@/lib/serverutils", () => ({
  getUserFromCookies: jest.fn(async () => ({ userId: 1 })),
}));

describe("/api/v2/discovery/candidates", () => {
  it("caches merged results", async () => {
    const { GET } = await import("@/app/api/v2/discovery/candidates/route");
    mockTT.mockResolvedValue(["a", "b"]);
    mockTaste.mockResolvedValue(["b", "c"]);
    const req = new NextRequest(new URL("http://localhost/api/v2/discovery/candidates"));
    const res1 = await GET(req);
    const body1 = await res1.json();
    expect(body1).toEqual(["a", "b", "c"]);
    const res2 = await GET(req);
    await res2.json();
    expect(mockTT).toHaveBeenCalledTimes(1);
    expect(mockTaste).toHaveBeenCalledTimes(1);
  });
});
