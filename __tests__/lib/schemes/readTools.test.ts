import {
  verifySchemeEqualityByKey,
  computeSchemeFingerprintByKey,
  findBehaviourallySimilarSchemesByKey,
} from "@/lib/schemes/readTools";

// Mock the verifier so these tests cover the read-tool orchestration
// (loading, fingerprint comparison, bucketing, ordering, error shapes)
// rather than the verifier's internal decision procedure.
jest.mock("@/lib/schemes/verifier", () => {
  const actual = jest.requireActual("@/lib/schemes/verifier");
  return {
    ...actual,
    verifyBehaviourEquality: jest.fn(),
    computeBehaviourFingerprint: jest.fn(() => "recomputed-fp"),
  };
});

import {
  verifyBehaviourEquality,
  computeBehaviourFingerprint,
} from "@/lib/schemes/verifier";

const mockVerify = verifyBehaviourEquality as jest.Mock;
const mockFp = computeBehaviourFingerprint as jest.Mock;

type Row = {
  id: string;
  key: string;
  name: string;
  kind: string;
  fingerprint: string | null;
  premises?: unknown;
  conclusion?: unknown;
  epistemicMode?: string;
};

const ROW = (over: Partial<Row> & { key: string }): Row => ({
  id: `id_${over.key}`,
  name: over.key,
  kind: "argument-scheme",
  fingerprint: null,
  premises: [],
  conclusion: {},
  epistemicMode: "FACTUAL",
  ...over,
});

/** In-memory tx honouring the queries readTools issues. */
function fakeTx(rows: Row[]) {
  return {
    argumentScheme: {
      findUnique: async ({ where, include }: any) => {
        const r = rows.find((x) => (where.key ? x.key === where.key : x.id === where.id));
        if (!r) return null;
        return include?.cqs ? { ...r, cqs: [] } : r;
      },
      findMany: async ({ where, include }: any = {}) => {
        let out = rows;
        if (where?.kind) out = out.filter((r) => r.kind === where.kind);
        if (where?.fingerprint !== undefined) {
          out = out.filter((r) => r.fingerprint === where.fingerprint);
        }
        if (where?.id?.not) out = out.filter((r) => r.id !== where.id.not);
        return out.map((r) => (include?.cqs ? { ...r, cqs: [] } : r));
      },
    },
  } as any;
}

beforeEach(() => {
  mockVerify.mockReset();
  mockFp.mockReset().mockReturnValue("recomputed-fp");
});

describe("verifySchemeEqualityByKey (C.1)", () => {
  test("missing scheme → scheme-not-found with the missing keys", async () => {
    const tx = fakeTx([ROW({ key: "a", fingerprint: "fp" })]);
    const res = await verifySchemeEqualityByKey("a", "missing", undefined, tx);
    expect("error" in res && res.error).toBe("scheme-not-found");
    if ("error" in res) expect(res.missingKeys).toEqual(["missing"]);
  });

  test("equal verdict carries certificate as witnessOrCounter and fingerprintsMatched", async () => {
    mockVerify.mockResolvedValue({ kind: "equal", certificate: { proof: "x" } });
    const tx = fakeTx([
      ROW({ key: "a", fingerprint: "shared" }),
      ROW({ key: "b", fingerprint: "shared" }),
    ]);
    const res = await verifySchemeEqualityByKey("a", "b", undefined, tx);
    if ("error" in res) throw new Error("unexpected error");
    expect(res.verdict).toBe("equal");
    expect(res.witnessOrCounter).toEqual({ proof: "x" });
    expect(res.fingerprintsMatched).toBe(true);
    expect(typeof res.runtimeMs).toBe("number");
  });

  test("inconclusive verdict surfaces reason and fingerprintsMatched=false for distinct fps", async () => {
    mockVerify.mockResolvedValue({ kind: "inconclusive", reason: "search-bound-exceeded" });
    const tx = fakeTx([
      ROW({ key: "a", fingerprint: "fp1" }),
      ROW({ key: "b", fingerprint: "fp2" }),
    ]);
    const res = await verifySchemeEqualityByKey("a", "b", undefined, tx);
    if ("error" in res) throw new Error("unexpected error");
    expect(res.verdict).toBe("inconclusive");
    expect(res.witnessOrCounter).toEqual({ reason: "search-bound-exceeded" });
    expect(res.fingerprintsMatched).toBe(false);
  });
});

describe("computeSchemeFingerprintByKey (C.2)", () => {
  test("missing scheme → scheme-not-found", async () => {
    const tx = fakeTx([]);
    const res = await computeSchemeFingerprintByKey("nope", tx);
    expect("error" in res && res.error).toBe("scheme-not-found");
  });

  test("materialised column is reported as materialised:true", async () => {
    const tx = fakeTx([ROW({ key: "a", fingerprint: "stored-fp" })]);
    const res = await computeSchemeFingerprintByKey("a", tx);
    if ("error" in res) throw new Error("unexpected error");
    expect(res.behaviourFingerprint).toBe("stored-fp");
    expect(res.materialised).toBe(true);
    expect(mockFp).not.toHaveBeenCalled();
  });

  test("null column recomputes and reports materialised:false", async () => {
    const tx = fakeTx([ROW({ key: "a", fingerprint: null })]);
    const res = await computeSchemeFingerprintByKey("a", tx);
    if ("error" in res) throw new Error("unexpected error");
    expect(res.behaviourFingerprint).toBe("recomputed-fp");
    expect(res.materialised).toBe(false);
    expect(mockFp).toHaveBeenCalled();
  });
});

describe("findBehaviourallySimilarSchemesByKey (C.3)", () => {
  test("missing scheme → scheme-not-found", async () => {
    const tx = fakeTx([]);
    const res = await findBehaviourallySimilarSchemesByKey("nope", 5, tx);
    expect("error" in res && res.error).toBe("scheme-not-found");
  });

  test("buckets same-fingerprint peers, verifier-confirms, orders equal→subset→...", async () => {
    const tx = fakeTx([
      ROW({ key: "target", fingerprint: "fp" }),
      ROW({ key: "peer_incomp", fingerprint: "fp" }),
      ROW({ key: "peer_equal", fingerprint: "fp" }),
      ROW({ key: "other", fingerprint: "different" }),
    ]);
    mockVerify.mockImplementation(async (_l: any, r: any) => {
      if (r.key === "peer_equal") return { kind: "equal", certificate: {} };
      return { kind: "incomparable", certificate: {} };
    });

    const res = await findBehaviourallySimilarSchemesByKey("target", 5, tx);
    if ("error" in res) throw new Error("unexpected error");
    expect(res.candidatesConsidered).toBe(2); // excludes self + different-fp
    expect(res.hits.map((h) => h.schemeKey)).toEqual(["peer_equal", "peer_incomp"]);
    expect(res.hits[0].verdict).toBe("equal");
    expect(res.hits.every((h) => h.fingerprintMatched)).toBe(true);
  });

  test("no same-fingerprint peer → empty hits (checked, not skipped)", async () => {
    const tx = fakeTx([
      ROW({ key: "target", fingerprint: "lonely" }),
      ROW({ key: "other", fingerprint: "elsewhere" }),
    ]);
    const res = await findBehaviourallySimilarSchemesByKey("target", 5, tx);
    if ("error" in res) throw new Error("unexpected error");
    expect(res.hits).toEqual([]);
    expect(res.candidatesConsidered).toBe(0);
    expect(mockVerify).not.toHaveBeenCalled();
  });

  test("respects k by truncating after ordering", async () => {
    const tx = fakeTx([
      ROW({ key: "target", fingerprint: "fp" }),
      ROW({ key: "p1", fingerprint: "fp" }),
      ROW({ key: "p2", fingerprint: "fp" }),
      ROW({ key: "p3", fingerprint: "fp" }),
    ]);
    mockVerify.mockResolvedValue({ kind: "incomparable", certificate: {} });
    const res = await findBehaviourallySimilarSchemesByKey("target", 2, tx);
    if ("error" in res) throw new Error("unexpected error");
    expect(res.candidatesConsidered).toBe(3);
    expect(res.hits.length).toBe(2);
  });
});
