import { canonicalise } from "../lib/canonicalise";
import { describe, expect, test, vi } from "vitest";

vi.mock("../lib/prismaclient", () => ({
  prisma: {
    canonicalMedia: {
      findFirst: vi.fn(async () => ({ id: "tt0083658" })),
    },
  },
}));

describe("canonicalise", () => {
  test("returns canonical id for variant title", async () => {
    const id = await canonicalise("Blade Runner (Final Cut)");
    expect(id).toBe("tt0083658");
  });
});
