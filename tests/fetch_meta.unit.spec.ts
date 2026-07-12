import { describe, it, expect, vi } from "vitest";
import { fetchMetaAndUpsert } from "../services/meta";
import { TTL_SECONDS } from "../services/meta/cache";

let cacheValue: string | null = null;
let setArgs: any[] | null = null;

vi.mock("ioredis", () => ({
  default: class {
    get = vi.fn(async () => cacheValue);
    set = vi.fn((...args: any[]) => {
      setArgs = args;
    });
  },
}));

vi.mock("../services/meta/tmdb", () => ({
  fetchFromTMDb: vi.fn(async () => ({ genres: ["A"], year: 2020, synopsis: "" })),
}));

const mockDb = { from: vi.fn(() => ({ update: vi.fn(), insert: vi.fn() })) } as any;

describe("cache logic", () => {
  it("cacheHit returns cached JSON, no HTTP", async () => {
    cacheValue = JSON.stringify({ genres: [], year: 2000, synopsis: "cached" });
    setArgs = null;
    const result = await fetchMetaAndUpsert(mockDb, "1", "movie", "5");
    expect(result?.synopsis).toBe("cached");
    expect(setArgs).toBeNull();
  });

  it("cacheMiss stores value with TTL \u2248 24 h", async () => {
    cacheValue = null;
    setArgs = null;
    await fetchMetaAndUpsert(mockDb, "1", "movie", "5");
    expect(setArgs).toEqual([
      "meta:movie:5",
      JSON.stringify({ genres: ["A"], year: 2020, synopsis: "" }),
      "EX",
      TTL_SECONDS,
    ]);
  });
});
