import { describe, expect, test, vi } from "vitest";

let createMany: any;
vi.mock("../lib/prismaclient", () => {
  createMany = vi.fn();
  return { prisma: { canonicalMedia: { createMany } } };
});

vi.mock("../scripts/seed_cmd", async (importOriginal) => {
  const mod = await importOriginal();
  return {
    ...mod,
    fetchMovieDump: vi.fn(async () =>
      Array.from({ length: 50000 }, (_, i) => ({ id: `tt${i}`, title: `M${i}` }))
    ),
  };
});

describe("seedCMD", () => {
  test("inserts 50k rows without collision", async () => {
    const { seedCMD } = await import("../scripts/seed_cmd");
    await seedCMD();
    expect(createMany).toHaveBeenCalled();
    const arg = createMany.mock.calls[0][0];
    expect(arg.data).toHaveLength(50000);
    expect(arg.skipDuplicates).toBe(true);
  });
});
