/**
 * Roadmap Phase D — unit tests for the scheme provenance read tools.
 *
 * D.1 `getSchemeProvenanceByKey` echoes the shipped Q-022/Q-024 columns
 * verbatim; D.2 `compareSchemeProvenanceByKeys` composes two D.1 reads with the
 * verifier (mocked here so we cover orchestration, not the decision procedure).
 */

// The verifier is reached transitively via readTools.verifySchemeEqualityByKey.
jest.mock("@/lib/schemes/verifier", () => {
  const actual = jest.requireActual("@/lib/schemes/verifier");
  return {
    ...actual,
    verifyBehaviourEquality: jest.fn(),
    computeBehaviourFingerprint: jest.fn(() => "recomputed-fp"),
  };
});

import {
  getSchemeProvenanceByKey,
  compareSchemeProvenanceByKeys,
} from "@/lib/schemes/provenanceTools";
import { verifyBehaviourEquality } from "@/lib/schemes/verifier";

const mockVerify = verifyBehaviourEquality as jest.Mock;

type Row = {
  id: string;
  key: string;
  sourceCatalogue: string;
  sourceId: string | null;
  sourceVersion: string | null;
  importedAt: Date | null;
  importerVersion: string | null;
  createdBy: string | null;
  createdAt: Date | null;
  fingerprint: string | null;
};

const ROW = (over: Partial<Row> & { key: string }): Row => ({
  id: `id_${over.key}`,
  sourceCatalogue: "admin-authored",
  sourceId: null,
  sourceVersion: null,
  importedAt: null,
  importerVersion: null,
  createdBy: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  fingerprint: "fp-x",
  ...over,
});

/** In-memory tx honouring the provenance + readTools queries. */
function fakeTx(rows: Row[]) {
  return {
    argumentScheme: {
      findUnique: async ({ where, include, select }: any) => {
        const r = rows.find((x) =>
          where.key ? x.key === where.key : x.id === where.id,
        );
        if (!r) return null;
        if (include?.cqs) return { ...r, cqs: [] };
        return r;
      },
    },
  } as any;
}

beforeEach(() => {
  mockVerify.mockReset();
  mockVerify.mockResolvedValue({ kind: "equal", certificate: { proof: "ok" } });
});

describe("getSchemeProvenanceByKey (D.1)", () => {
  it("returns scheme-not-found for an unknown key", async () => {
    const result = await getSchemeProvenanceByKey("nope", fakeTx([]));
    expect(result).toEqual({ error: "scheme-not-found", missingKeys: ["nope"] });
  });

  it("echoes admin-authored defaults with nulls and ISO createdAt", async () => {
    const tx = fakeTx([ROW({ key: "good_consequences" })]);
    const result = await getSchemeProvenanceByKey("good_consequences", tx);
    expect(result).toEqual({
      schemeKey: "good_consequences",
      sourceCatalogue: "admin-authored",
      sourceId: null,
      sourceVersion: null,
      importedAt: null,
      importerVersion: null,
      createdBy: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
  });

  it("echoes imported-row provenance verbatim, ISO-stamping date columns", async () => {
    const tx = fakeTx([
      ROW({
        key: "expert_opinion",
        sourceCatalogue: "AIFdb",
        sourceId: "aif-123",
        sourceVersion: "2008",
        importedAt: new Date("2026-05-01T12:00:00.000Z"),
        importerVersion: "importer-1.4",
        createdBy: "auth_abc",
        createdAt: new Date("2026-05-01T12:00:00.000Z"),
      }),
    ]);
    const result = await getSchemeProvenanceByKey("expert_opinion", tx);
    expect(result).toMatchObject({
      schemeKey: "expert_opinion",
      sourceCatalogue: "AIFdb",
      sourceId: "aif-123",
      sourceVersion: "2008",
      importedAt: "2026-05-01T12:00:00.000Z",
      importerVersion: "importer-1.4",
      createdBy: "auth_abc",
    });
  });
});

describe("compareSchemeProvenanceByKeys (D.2)", () => {
  it("returns scheme-not-found listing every missing key", async () => {
    const tx = fakeTx([ROW({ key: "a" })]);
    const result = await compareSchemeProvenanceByKeys("a", "b", undefined, tx);
    expect(result).toEqual({ error: "scheme-not-found", missingKeys: ["b"] });
    // The verifier must not run when a row is missing.
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it("reports sameSource + null deltas for identical provenance, verdict from verifier", async () => {
    const shared = {
      sourceCatalogue: "AIFdb",
      sourceId: "aif-1",
      sourceVersion: "v1",
      createdAt: new Date("2026-02-02T00:00:00.000Z"),
    };
    const tx = fakeTx([
      ROW({ key: "a", ...shared }),
      ROW({ key: "b", ...shared }),
    ]);
    const result = await compareSchemeProvenanceByKeys("a", "b", undefined, tx);
    if ("error" in result) throw new Error("unexpected error");
    expect(result.sameSource).toBe(true);
    expect(result.sourceDelta.sourceCatalogue).toBeNull();
    expect(result.sourceDelta.sourceId).toBeNull();
    expect(result.behaviourFingerprintEqual).toBe(true);
    expect(result.verifierVerdict).toBe("equal");
  });

  it("flags a per-field delta and sameSource:false when catalogues differ", async () => {
    const tx = fakeTx([
      ROW({ key: "a", sourceCatalogue: "AIFdb", sourceId: "x" }),
      ROW({ key: "b", sourceCatalogue: "Argdown", sourceId: "y" }),
    ]);
    const result = await compareSchemeProvenanceByKeys("a", "b", undefined, tx);
    if ("error" in result) throw new Error("unexpected error");
    expect(result.sameSource).toBe(false);
    expect(result.sourceDelta.sourceCatalogue).toEqual({ a: "AIFdb", b: "Argdown" });
    expect(result.sourceDelta.sourceId).toEqual({ a: "x", b: "y" });
  });

  it("surfaces fingerprint mismatch + inconclusive verdict honestly", async () => {
    mockVerify.mockResolvedValue({ kind: "inconclusive", reason: "search-bound" });
    const tx = fakeTx([
      ROW({ key: "a", fingerprint: "fp-a" }),
      ROW({ key: "b", fingerprint: "fp-b" }),
    ]);
    const result = await compareSchemeProvenanceByKeys("a", "b", undefined, tx);
    if ("error" in result) throw new Error("unexpected error");
    expect(result.behaviourFingerprintEqual).toBe(false);
    expect(result.verifierVerdict).toBe("inconclusive");
  });
});
