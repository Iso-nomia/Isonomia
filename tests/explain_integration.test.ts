import { NextRequest } from "next/server";

process.env.UPSTASH_REDIS_REST_URL = "http://localhost";
process.env.UPSTASH_REDIS_REST_TOKEN = "token";

describe("why api integration", () => {
  let store: Record<string, string>;
  beforeEach(() => {
    jest.resetModules();
    store = {};
    jest.doMock("child_process", () => ({
      execFile: (_cmd: string, _args: string[], cb: any) => cb(null, JSON.stringify({ F1: -0.1, F2: 0.9, F3: -0.5 }), "")
    }));
    jest.doMock("@/lib/redis", () => ({
      __esModule: true,
      default: {
        get: jest.fn(async (k: string) => store[k] || null),
        setex: jest.fn(async (k: string, _t: number, v: string) => { store[k] = v; }),
      },
    }));
    jest.doMock("@upstash/ratelimit", () => ({
      Ratelimit: class { limit = jest.fn(async () => ({ success: true })); constructor(){} static tokenBucket(){ return null; } },
    }));
  });

  afterEach(() => {
    jest.resetModules();
  });

  test("top-2 selection honours abs shap", async () => {
    const { GET } = await import("@/app/api/v2/discovery/why/[targetId]/route");
    const req = new NextRequest(new URL("http://localhost/api/v2/discovery/why/def?viewerId=2"));
    const res = await GET(req, { params: { targetId: "def" } });
    const body = await res.json();
    expect(body.reason_en).toBeDefined();
  });
});
