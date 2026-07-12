/**
 * Phase 4.2 — Unit tests for the hybrid (lexical + dense) retriever
 * driving /api/v3/search/arguments.
 *
 * Mocks Prisma (sparse path + raw pgvector path) and the query embedding
 * cache. Asserts the contracts that downstream surfaces (UI, MCP) rely on:
 *
 *   - empty query degrades to sparse-only (no embedding fetch)
 *   - dense-only when sparse misses still ranks
 *   - RRF math is symmetric and prefers ids that appear in both lists
 *   - lexicalCoverage and denseDistance are forwarded onto results
 *   - empty `argumentIds` filter short-circuits dense to []
 */

const prismaMock = {
  argument: { findMany: jest.fn() },
  $queryRawUnsafe: jest.fn(),
};

jest.mock("@/lib/prismaclient", () => ({ prisma: prismaMock }));
jest.mock("@/lib/argument/queryEmbeddingCache", () => ({
  getOrComputeQueryEmbedding: jest.fn(),
}));

import {
  hybridSearchArguments,
  tokenizeQuery,
  RRF_K,
} from "@/lib/argument/hybridSearch";
import { getOrComputeQueryEmbedding } from "@/lib/argument/queryEmbeddingCache";

const getOrComputeQueryEmbeddingMock = getOrComputeQueryEmbedding as jest.Mock;

beforeEach(() => {
  prismaMock.argument.findMany.mockReset();
  prismaMock.$queryRawUnsafe.mockReset();
  getOrComputeQueryEmbeddingMock.mockReset();
});

describe("tokenizeQuery", () => {
  it("strips stop-words and tokens shorter than 3 chars", () => {
    expect(tokenizeQuery("the of a smartphone")).toEqual(["smartphone"]);
  });
  it("lowercases and trims punctuation, caps at 8 tokens", () => {
    const tokens = tokenizeQuery(
      "Adolescent! depression, screens, anxiety, sleep, social, media, attention, mood",
    );
    expect(tokens.length).toBeLessThanOrEqual(8);
    expect(tokens.every((t) => t === t.toLowerCase())).toBe(true);
    expect(tokens).toContain("adolescent");
  });
});

describe("hybridSearchArguments", () => {
  it("empty query → sparse-only (no embedding fetch, no SQL call)", async () => {
    prismaMock.argument.findMany.mockResolvedValueOnce([
      { id: "a1", text: "anything", createdAt: new Date(), conclusion: { text: "" } },
      { id: "a2", text: "anything", createdAt: new Date(Date.now() - 1000), conclusion: { text: "" } },
    ]);

    const out = await hybridSearchArguments({ query: "", limit: 5 });

    expect(getOrComputeQueryEmbeddingMock).not.toHaveBeenCalled();
    expect(prismaMock.$queryRawUnsafe).not.toHaveBeenCalled();
    expect(out.map((r) => r.id)).toEqual(["a1", "a2"]);
    // Each result has a sparseRank; denseRank is null.
    expect(out[0]).toMatchObject({ sparseRank: 1, denseRank: null });
  });

  it("RRF scores ids appearing in both lists higher than singletons", async () => {
    // Sparse returns a1, a2 — dense returns a2, a3. a2 should rank #1.
    prismaMock.argument.findMany.mockResolvedValueOnce([
      { id: "a1", text: "smartphones bad", createdAt: new Date(), conclusion: { text: "" } },
      { id: "a2", text: "smartphones bad", createdAt: new Date(Date.now() - 1000), conclusion: { text: "" } },
    ]);
    getOrComputeQueryEmbeddingMock.mockResolvedValueOnce({ vec: [0.1, 0.2, 0.3] });
    prismaMock.$queryRawUnsafe.mockResolvedValueOnce([
      { id: "a2", distance: 0.1 },
      { id: "a3", distance: 0.2 },
    ]);

    const out = await hybridSearchArguments({ query: "smartphones bad", limit: 5 });

    const ranked = out.map((r) => r.id);
    expect(ranked[0]).toBe("a2"); // appears in both lists
    expect(ranked).toContain("a1");
    expect(ranked).toContain("a3");

    const a2 = out.find((r) => r.id === "a2")!;
    const a1 = out.find((r) => r.id === "a1")!;
    // Sparse ranks: a1=#1 (newer), a2=#2 (older). Dense ranks: a2=#1, a3=#2.
    expect(a1.sparseRank).toBe(1);
    expect(a2.sparseRank).toBe(2);
    expect(a2.denseRank).toBe(1);
    expect(a2.rrfScore).toBeCloseTo(1 / (RRF_K + 2) + 1 / (RRF_K + 1), 6);
    expect(a1.rrfScore).toBeCloseTo(1 / (RRF_K + 1), 6);
    expect(a2.rrfScore).toBeGreaterThan(a1.rrfScore);
  });

  it("dense-only hit (sparse misses) is still ranked", async () => {
    prismaMock.argument.findMany.mockResolvedValueOnce([]); // sparse: no rows
    getOrComputeQueryEmbeddingMock.mockResolvedValueOnce({ vec: [0.1] });
    prismaMock.$queryRawUnsafe.mockResolvedValueOnce([
      { id: "a9", distance: 0.05 },
    ]);

    const out = await hybridSearchArguments({ query: "exotic vocabulary", limit: 5 });

    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      id: "a9",
      sparseRank: null,
      denseRank: 1,
      denseDistance: 0.05,
    });
  });

  it("empty argumentIds filter short-circuits dense to []", async () => {
    prismaMock.argument.findMany.mockResolvedValueOnce([]);
    getOrComputeQueryEmbeddingMock.mockResolvedValueOnce({ vec: [0.1] });
    // denseCandidates returns [] before any SQL when argumentIds is empty.

    const out = await hybridSearchArguments({
      query: "x",
      limit: 5,
      filter: { argumentIds: [] },
    });

    expect(out).toEqual([]);
    expect(prismaMock.$queryRawUnsafe).not.toHaveBeenCalled();
  });

  it("forwards lexicalCoverage from the sparse pass", async () => {
    prismaMock.argument.findMany.mockResolvedValueOnce([
      {
        id: "a1",
        text: "smartphones cause adolescent depression",
        createdAt: new Date(),
        conclusion: { text: "" },
      },
      {
        id: "a2",
        text: "depression has many causes",
        createdAt: new Date(Date.now() - 1000),
        conclusion: { text: "" },
      },
    ]);
    getOrComputeQueryEmbeddingMock.mockResolvedValueOnce({ vec: [0.1] });
    prismaMock.$queryRawUnsafe.mockResolvedValueOnce([]);

    const out = await hybridSearchArguments({
      query: "smartphones adolescent depression",
      limit: 5,
    });

    const a1 = out.find((r) => r.id === "a1")!;
    const a2 = out.find((r) => r.id === "a2")!;
    expect(a1.lexicalCoverage).toBe(3);
    expect(a2.lexicalCoverage).toBe(1);
  });
});
