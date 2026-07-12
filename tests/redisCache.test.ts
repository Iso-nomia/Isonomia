import { getOrSet } from "@/lib/redis";

jest.mock("ioredis", () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(async () => null),
    setex: jest.fn(),
  }));
});

describe("getOrSet", () => {
  jest.useFakeTimers();
  it("caches value within ttl", async () => {
    let calls = 0;
    const val = await getOrSet("k", 30, async () => {
      calls++; return 1;
    });
    expect(val).toBe(1);
    await getOrSet("k", 30, async () => {
      calls++; return 2;
    });
    expect(calls).toBe(1);
  });
});
