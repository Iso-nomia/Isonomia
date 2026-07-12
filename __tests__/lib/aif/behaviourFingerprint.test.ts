/**
 * __tests__/lib/aif/behaviourFingerprint.test.ts
 *
 * Phase 4c (folksonomy roadmap step 17) — AIF round-trip identity discipline.
 *
 * Covers:
 *   - resolveSchemeByFingerprint with a mocked prisma client.
 *   - decideImportResolution end-to-end policy (mint_new on no fingerprint;
 *     mint_new on no match; attach_existing on equal verdict; mint_new with
 *     verdict preserved on subset / incomparable / inconclusive).
 */

import {
  decideImportResolution,
  resolveSchemeByFingerprint,
  loadFingerprintsForSchemes,
} from "@/lib/aif/behaviourFingerprint";
import type { SchemeWithCqs } from "@/lib/schemes/verifier";

// -- fixture builder -----------------------------------------------------

function cq(over: Partial<any> = {}): any {
  return {
    id: "cq_" + Math.random().toString(36).slice(2, 8),
    instanceId: null,
    schemeId: null,
    scheme: null,
    cqKey: "CQ_default",
    cqId: null,
    text: "Default CQ text",
    attackKind: "UNDERCUTS",
    status: "open",
    openedById: null,
    resolvedById: null,
    createdAt: new Date(),
    attackType: "UNDERCUTS",
    targetScope: "inference",
    instance: null,
    aspicMapping: null,
    burdenOfProof: "PROPONENT",
    requiresEvidence: false,
    premiseType: null,
    ...over,
  };
}

function scheme(over: Partial<SchemeWithCqs> = {}): SchemeWithCqs {
  return {
    id: "sch_" + Math.random().toString(36).slice(2, 8),
    key: "test_scheme",
    name: "Test Scheme",
    description: null,
    title: null,
    summary: "",
    cq: [],
    premises: [
      { id: "P1", type: "major", text: "P1", variables: ["X"] },
      { id: "P2", type: "minor", text: "P2", variables: ["X"] },
    ],
    conclusion: { text: "C", variables: ["X"] },
    purpose: null,
    source: null,
    materialRelation: null,
    reasoningType: null,
    ruleForm: null,
    conclusionType: null,
    slotHints: null,
    validators: null,
    parentSchemeId: null,
    clusterTag: "test_family",
    aspicMapping: null,
    epistemicMode: "FACTUAL",
    tags: [],
    examples: [],
    usageCount: 0,
    difficulty: "intermediate",
    identificationConditions: [],
    whenToUse: "",
    semanticCluster: null,
    kind: "argument-scheme",
    sourceCatalogue: "admin-authored",
    sourceId: null,
    sourceVersion: null,
    importedAt: null,
    importerVersion: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: null,
    cqs: [],
    ...over,
  } as SchemeWithCqs;
}

// -- prisma stub ---------------------------------------------------------

type Catalogue = Array<SchemeWithCqs & { fingerprint: string | null }>;

function makeStubTx(rows: Catalogue) {
  return {
    argumentScheme: {
      findMany: jest.fn(async ({ where }: any) => {
        const ids: string[] = where?.id?.in ?? [];
        return rows.filter((r) => ids.includes(r.id)).map((r) => ({
          id: r.id,
          fingerprint: r.fingerprint,
          epistemicMode: r.epistemicMode,
          premises: r.premises,
          conclusion: r.conclusion,
          cqs: r.cqs.map((c: any) => ({
            cqKey: c.cqKey,
            attackType: c.attackType,
            targetScope: c.targetScope,
          })),
        }));
      }),
      findFirst: jest.fn(async ({ where }: any) => {
        if (where?.fingerprint && where?.kind === "argument-scheme") {
          const hit = rows.find((r) => r.fingerprint === where.fingerprint && r.kind === "argument-scheme");
          if (!hit) return null;
          return { id: hit.id, key: hit.key, name: hit.name };
        }
        return null;
      }),
      findUnique: jest.fn(async ({ where }: any) => {
        const hit = rows.find((r) => r.id === where?.id);
        return hit ?? null;
      }),
    },
  };
}

// -- tests ---------------------------------------------------------------

describe("loadFingerprintsForSchemes", () => {
  it("returns the materialised column when present", async () => {
    const row = { ...scheme({ id: "sA" }), fingerprint: "fp:material" };
    const tx = makeStubTx([row]) as any;
    const m = await loadFingerprintsForSchemes(["sA"], tx);
    expect(m.get("sA")).toBe("fp:material");
  });

  it("recomputes when fingerprint column is null", async () => {
    const cqs = [cq({ cqKey: "CQ1", attackType: "UNDERCUTS", targetScope: "inference" })];
    const row = { ...scheme({ id: "sB", cqs }), fingerprint: null };
    const tx = makeStubTx([row]) as any;
    const m = await loadFingerprintsForSchemes(["sB"], tx);
    const fp = m.get("sB");
    expect(typeof fp).toBe("string");
    expect(fp!.length).toBeGreaterThan(16);
  });

  it("returns empty map for empty input without hitting prisma", async () => {
    const tx = makeStubTx([]) as any;
    const m = await loadFingerprintsForSchemes([], tx);
    expect(m.size).toBe(0);
    expect(tx.argumentScheme.findMany).not.toHaveBeenCalled();
  });
});

describe("resolveSchemeByFingerprint", () => {
  it("returns no_match for empty fingerprint", async () => {
    const tx = makeStubTx([]) as any;
    const r = await resolveSchemeByFingerprint("", tx);
    expect(r.kind).toBe("no_match");
  });

  it("returns no_match when nothing in the catalogue matches", async () => {
    const tx = makeStubTx([{ ...scheme({ id: "sA" }), fingerprint: "fp:x" }]) as any;
    const r = await resolveSchemeByFingerprint("fp:y", tx);
    expect(r.kind).toBe("no_match");
  });

  it("returns the matching row", async () => {
    const row = { ...scheme({ id: "sA", key: "k", name: "N" }), fingerprint: "fp:x" };
    const tx = makeStubTx([row]) as any;
    const r = await resolveSchemeByFingerprint("fp:x", tx);
    expect(r.kind).toBe("match");
    if (r.kind === "match") {
      expect(r.schemeId).toBe("sA");
      expect(r.schemeKey).toBe("k");
    }
  });
});

describe("decideImportResolution", () => {
  const sharedCqs = [cq({ cqKey: "CQ1", attackType: "UNDERCUTS", targetScope: "inference", text: "Q" })];

  it("mints new when no fingerprint is supplied", async () => {
    const tx = makeStubTx([]) as any;
    const r = await decideImportResolution({
      fingerprint: null,
      incomingDraft: scheme({ cqs: sharedCqs }),
      tx,
    });
    expect(r.action).toBe("mint_new");
    if (r.action === "mint_new") expect(r.reason).toBe("no_fingerprint");
  });

  it("mints new when fingerprint has no catalogue match", async () => {
    const tx = makeStubTx([]) as any;
    const r = await decideImportResolution({
      fingerprint: "fp:absent",
      incomingDraft: scheme({ cqs: sharedCqs }),
      tx,
    });
    expect(r.action).toBe("mint_new");
    if (r.action === "mint_new") expect(r.reason).toBe("no_match");
  });

  it("attaches existing on verifier verdict=equal", async () => {
    const cat = scheme({ id: "sA", key: "kA", cqs: sharedCqs });
    const incoming = scheme({ id: "draft", key: "kA", cqs: sharedCqs });
    const tx = makeStubTx([{ ...cat, fingerprint: "fp:eq" }]) as any;
    const r = await decideImportResolution({
      fingerprint: "fp:eq",
      incomingDraft: incoming,
      tx,
    });
    expect(r.action).toBe("attach_existing");
    if (r.action === "attach_existing") {
      expect(r.schemeId).toBe("sA");
      expect(r.verdict.kind).toBe("equal");
    }
  });

  it("mints new + preserves verdict when verifier returns subset", async () => {
    // Catalogue row is a strict superset of the draft → draft⊂catalogue.
    const extraCq = cq({ cqKey: "CQ_extra", attackType: "REBUTS", targetScope: "conclusion", text: "Y" });
    const cat = scheme({ id: "sA", key: "kA", cqs: [...sharedCqs, extraCq] });
    const incoming = scheme({ id: "draft", key: "kA", cqs: sharedCqs });
    // Force fingerprint collision to drive the verifier branch.
    const tx = makeStubTx([{ ...cat, fingerprint: "fp:collide" }]) as any;
    const r = await decideImportResolution({
      fingerprint: "fp:collide",
      incomingDraft: incoming,
      tx,
    });
    expect(r.action).toBe("mint_new");
    if (r.action === "mint_new") {
      expect(["subset", "incomparable", "inconclusive"]).toContain(r.reason);
      expect(r.verdict).not.toBeNull();
      expect(r.candidateSchemeId).toBe("sA");
    }
  });
});
