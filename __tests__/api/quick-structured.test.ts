/**
 * Integration tests for POST /api/arguments/quick-structured.
 *
 * Verifies the structured-argument write surface contracts that
 * differentiate it from `/api/arguments/quick`:
 *   • mints conclusion + N premise Claims, creates Argument +
 *     ArgumentPremise[] + ArgumentSchemeInstance in one round-trip
 *   • MCP-bearer callers get authorKind:"AI" + aiProvenance.tool flag
 *   • omitted schemeKey triggers server-side inference + a
 *     `scheme_inferred` warning
 *   • unknown schemeKey returns 400 with a `list_schemes` hint
 *   • duplicate premise text collapses to one Claim and emits a
 *     `premise_deduped` warning
 *   • required-slot schemes never throw — they emit `missing_slot`
 *     warnings instead (OQ3)
 *   • provenance enrichment is kicked off and surfaces
 *     provenancePending + retryAfterMs
 */

import { NextRequest } from "next/server";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const prismaMock: any = {
  deliberation: { findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
  argumentScheme: { findUnique: jest.fn(), findMany: jest.fn() },
  claim: { upsert: jest.fn(), findMany: jest.fn() },
  claimEvidence: { createMany: jest.fn(), findMany: jest.fn() },
  argument: { create: jest.fn() },
  argumentPremise: { createMany: jest.fn() },
  argumentSchemeInstance: { create: jest.fn() },
  argumentSupport: { findFirst: jest.fn(), create: jest.fn(), updateMany: jest.fn() },
  // N-1 capture: the authored argument atomically upserts an ActProvenance row.
  actProvenance: { upsert: jest.fn(async () => ({ id: "actprov-1" })) },
  $transaction: jest.fn(async (fn: any) => fn(prismaMock)),
};

jest.mock("@/lib/prismaclient", () => ({ prisma: prismaMock }));

const resolveCitationCallerUserIdMock = jest.fn();
const isMcpBearerMock = jest.fn();
jest.mock("@/lib/citation/mcpAuth", () => ({
  resolveCitationCallerUserId: (...a: any[]) => resolveCitationCallerUserIdMock(...a),
  isMcpBearer: (...a: any[]) => isMcpBearerMock(...a),
  // Faithful re-impl of the real §4 shim so the route's authorship-namespacing
  // call resolves (no speakAs → bare id, matching prior behaviour).
  namespaceForSpeakAs: (o: any) => {
    if (!o.isMcpBearer) return o.baseUserId;
    const s = String(o.speakAs ?? "").trim();
    if (!s) return o.baseUserId;
    return `${o.baseUserId}:${s.replace(/[^A-Za-z0-9._-]/g, "").slice(0, 64) || "default"}`;
  },
}));

jest.mock("@/lib/ids/mintMoid", () => ({
  // Deterministic MOID: prefix + lowercased trimmed text → easy collisions in tests.
  mintClaimMoid: (text: string) => `moid_${text.trim().toLowerCase()}`,
}));

const getOrCreatePermalinkMock = jest.fn(async () => ({
  shortCode: "ABC123",
  slug: "abc123-slug",
}));
jest.mock("@/lib/citations/permalinkService", () => ({
  getOrCreatePermalink: (...a: any[]) => getOrCreatePermalinkMock(...a),
}));

jest.mock("@/lib/unfurl", () => ({
  isSafePublicUrl: () => true,
  getOrFetchLinkPreview: jest.fn(async () => ({ title: "Unfurled Title" })),
}));

const enrichEvidenceProvenanceInBackgroundMock = jest.fn();
jest.mock("@/lib/citations/evidenceProvenance", () => ({
  enrichEvidenceProvenanceInBackground: (...a: any[]) =>
    enrichEvidenceProvenanceInBackgroundMock(...a),
}));

const inferAndAssignSchemeMock = jest.fn();
jest.mock("@/lib/argumentation/schemeInference", () => ({
  inferAndAssignScheme: (...a: any[]) => inferAndAssignSchemeMock(...a),
}));

jest.mock("@/lib/arguments/ensure-support", () => ({
  ensureArgumentSupportInTx: jest.fn(async () => undefined),
}));

jest.mock("@/lib/arguments/detect-composition", () => ({
  markArgumentAsComposedInTx: jest.fn(async () => undefined),
}));

// Upstash rate-limit + redis: always allow.
jest.mock("@upstash/ratelimit", () => ({
  Ratelimit: class {
    static fixedWindow() {
      return null;
    }
    constructor(_: any) {}
    async limit(_: string) {
      return { success: true };
    }
  },
}));
jest.mock("@upstash/redis", () => ({
  Redis: class {
    constructor(_: any) {}
  },
}));

// ─── Import under test (after mocks) ────────────────────────────────────────
import { POST } from "@/app/api/arguments/quick-structured/route";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/arguments/quick-structured", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  jest.clearAllMocks();

  // Auth defaults: MCP-bearer caller.
  resolveCitationCallerUserIdMock.mockResolvedValue("mcp-bot");
  isMcpBearerMock.mockReturnValue(true);

  // "My Arguments" deliberation lookup → already exists.
  prismaMock.deliberation.findFirst.mockResolvedValue({ id: "delib-my-args" });

  // B.1 write-gate peer index: empty catalogue by default (no fingerprint peers).
  prismaMock.argumentScheme.findMany.mockResolvedValue([]);

  // Default claim upsert: echo input.
  prismaMock.claim.upsert.mockImplementation(async ({ where, create }: any) => ({
    id: `claim_${where.moid}`,
    text: create?.text ?? where.moid,
    moid: where.moid,
  }));

  // Argument creation echoes inputs.
  prismaMock.argument.create.mockImplementation(async ({ data }: any) => ({
    id: "arg-1",
    text: data.text ?? "",
    confidence: 0.7,
  }));

  // Scheme instance creation.
  prismaMock.argumentSchemeInstance.create.mockResolvedValue({ id: "asi-1" });

  // Premise + evidence createMany are no-ops.
  prismaMock.argumentPremise.createMany.mockResolvedValue({ count: 0 });
  prismaMock.claimEvidence.createMany.mockResolvedValue({ count: 0 });
  prismaMock.claimEvidence.findMany.mockResolvedValue([]);

  // Reuse-claim resolution: no reusable claims by default.
  prismaMock.claim.findMany.mockResolvedValue([]);
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("POST /api/arguments/quick-structured", () => {
  it("401s when unauthenticated", async () => {
    resolveCitationCallerUserIdMock.mockResolvedValueOnce(null);
    const res = await POST(makeReq({ conclusion: "C", premises: [{ text: "P1" }] }));
    expect(res.status).toBe(401);
  });

  it("returns 400 with list_schemes hint on unknown schemeKey", async () => {
    prismaMock.argumentScheme.findUnique.mockResolvedValueOnce(null);
    const res = await POST(
      makeReq({
        conclusion: "C",
        premises: [{ text: "P1" }],
        schemeKey: "made_up_scheme",
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Unknown schemeKey/);
    expect(body.hint).toMatch(/list_schemes/);
    expect(inferAndAssignSchemeMock).not.toHaveBeenCalled();
  });

  it("infers a scheme when schemeKey is omitted and emits scheme_inferred warning", async () => {
    inferAndAssignSchemeMock.mockResolvedValueOnce("scheme-id-x");
    prismaMock.argumentScheme.findUnique.mockResolvedValueOnce({
      id: "scheme-id-x",
      key: "practical_reasoning",
      name: "Practical Reasoning",
      validators: null,
    });

    const res = await POST(
      makeReq({
        conclusion: "Adolescents should not consume regular caffeine",
        premises: [
          { text: "Caffeine disrupts adolescent sleep" },
          { text: "Sleep is critical to neurodevelopment" },
        ],
        reasoning: "Sleep loss in adolescence damages neurodevelopment, so caffeine is bad.",
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(inferAndAssignSchemeMock).toHaveBeenCalledTimes(1);
    expect(body.schemeInstance).toEqual({
      id: "asi-1",
      schemeId: "scheme-id-x",
      schemeKey: "practical_reasoning",
      schemeName: "Practical Reasoning",
      epistemicMode: null,
      verifierVerdict: null,
    });
    expect(body.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "scheme_inferred" }),
      ]),
    );
  });

  it("flags MCP-bearer writes as authorKind:'AI' with the structured-tool provenance tag", async () => {
    inferAndAssignSchemeMock.mockResolvedValueOnce(null);

    await POST(
      makeReq({
        conclusion: "C",
        premises: [{ text: "P1" }, { text: "P2" }],
      }),
    );

    expect(prismaMock.argument.create).toHaveBeenCalledTimes(1);
    const data = prismaMock.argument.create.mock.calls[0][0].data;
    expect(data.authorKind).toBe("AI");
    expect(data.aiProvenance).toEqual(
      expect.objectContaining({
        via: "mcp",
        tool: "propose_structured_argument",
      }),
    );
  });

  it("captures posted independence coordinates as an ActProvenance row (N-1)", async () => {
    inferAndAssignSchemeMock.mockResolvedValueOnce(null);

    await POST(
      makeReq({
        conclusion: "C",
        premises: [{ text: "P1" }],
        coordinates: {
          modelFamily: "claude",
          modelVersion: "claude-opus-4-8",
          contextLineageId: "lineage-xyz",
          sessionId: "sess-1",
        },
      }),
    );

    // One ActProvenance upsert, keyed to the just-created argument, carrying the
    // raw coordinates. contextLineageId is the unrecoverable-if-not-captured one.
    expect(prismaMock.actProvenance.upsert).toHaveBeenCalledTimes(1);
    const call = prismaMock.actProvenance.upsert.mock.calls[0][0];
    expect(call.where.subjectType_subjectId).toEqual({
      subjectType: "argument",
      subjectId: "arg-1",
    });
    expect(call.create).toEqual(
      expect.objectContaining({
        subjectType: "argument",
        subjectId: "arg-1",
        modelFamily: "claude",
        modelVersion: "claude-opus-4-8",
        contextLineageId: "lineage-xyz",
        sessionId: "sess-1",
        authorKind: "AI", // MCP-bearer caller (default in beforeEach)
        capturedVia: "mcp",
      }),
    );
  });

  it("still writes ActProvenance (with null coordinates) when none are posted (N-1)", async () => {
    inferAndAssignSchemeMock.mockResolvedValueOnce(null);
    await POST(makeReq({ conclusion: "C", premises: [{ text: "P1" }] }));
    expect(prismaMock.actProvenance.upsert).toHaveBeenCalledTimes(1);
    const call = prismaMock.actProvenance.upsert.mock.calls[0][0];
    expect(call.create).toEqual(
      expect.objectContaining({
        subjectType: "argument",
        subjectId: "arg-1",
        modelFamily: null,
        contextLineageId: null,
        authorKind: "AI",
      }),
    );
  });

  it("authors the argument as mcp-bot:<speakAs> when a side is given (§4, bug #2)", async () => {
    inferAndAssignSchemeMock.mockResolvedValueOnce(null);
    await POST(
      makeReq({
        conclusion: "C",
        premises: [{ text: "P1" }],
        speakAs: "proponent",
      }),
    );
    const data = prismaMock.argument.create.mock.calls[0][0].data;
    expect(data.authorId).toBe("mcp-bot:proponent");
    expect(data.authorKind).toBe("AI"); // AI-kind keys on viaMcp, not authorId
  });

  it("authors as the bare service id when no speakAs is given (side opt-in)", async () => {
    inferAndAssignSchemeMock.mockResolvedValueOnce(null);
    await POST(makeReq({ conclusion: "C", premises: [{ text: "P1" }] }));
    const data = prismaMock.argument.create.mock.calls[0][0].data;
    expect(data.authorId).toBe("mcp-bot");
  });

  it("dedupes premises that hash to the same MOID and emits premise_deduped warning", async () => {
    inferAndAssignSchemeMock.mockResolvedValueOnce(null);

    const res = await POST(
      makeReq({
        conclusion: "C",
        // Two textually identical premises → identical MOIDs → collapse.
        premises: [{ text: "duplicate premise" }, { text: "duplicate premise" }],
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.premises.length).toBe(1);
    expect(body.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "premise_deduped" }),
      ]),
    );
    // Only the deduped set goes into ArgumentPremise.createMany.
    const premiseCreateArgs = prismaMock.argumentPremise.createMany.mock.calls[0][0];
    expect(premiseCreateArgs.data.length).toBe(1);
  });

  it("returns 400 when every premise collapses to the conclusion", async () => {
    inferAndAssignSchemeMock.mockResolvedValueOnce(null);
    const res = await POST(
      makeReq({
        conclusion: "same text",
        premises: [{ text: "same text" }],
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/distinct premise/);
  });

  it("emits missing_slot warnings instead of 500ing when scheme has required slots", async () => {
    // Explicit schemeKey that requires an `expert` slot — server must NOT throw.
    prismaMock.argumentScheme.findUnique
      // First lookup: by key (initial scheme resolution).
      .mockResolvedValueOnce({
        id: "scheme-eo",
        key: "expert_opinion",
        name: "Expert Opinion",
      })
      // Second lookup: by id (collectMissingSlotWarnings reads validators).
      .mockResolvedValueOnce({
        key: "expert_opinion",
        validators: { slots: { expert: { required: true }, proposition: { required: true } } },
      });

    const res = await POST(
      makeReq({
        conclusion: "C",
        premises: [{ text: "P1" }],
        schemeKey: "expert_opinion",
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    const codes = (body.warnings ?? []).map((w: any) => w.code);
    expect(codes).toEqual(expect.arrayContaining(["missing_slot"]));
    // Two required slots → at least two missing_slot warnings.
    expect(codes.filter((c: string) => c === "missing_slot").length).toBeGreaterThanOrEqual(2);
  });

  it("kicks off provenance enrichment and surfaces provenancePending + retryAfterMs", async () => {
    inferAndAssignSchemeMock.mockResolvedValueOnce(null);
    prismaMock.claimEvidence.findMany.mockResolvedValueOnce([{ id: "ev-1" }]);

    const res = await POST(
      makeReq({
        conclusion: "C",
        premises: [{ text: "P1" }],
        evidence: [{ url: "https://example.com/paper", quote: "key quote" }],
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(enrichEvidenceProvenanceInBackgroundMock).toHaveBeenCalledWith(["ev-1"]);
    expect(body.provenancePending).toBe(true);
    expect(body.retryAfterMs).toBe(60_000);
  });

  it("creates ArgumentPremise rows for each deduped premise and marks the argument composed", async () => {
    inferAndAssignSchemeMock.mockResolvedValueOnce(null);
    const { markArgumentAsComposedInTx } = require("@/lib/arguments/detect-composition");
    const { ensureArgumentSupportInTx } = require("@/lib/arguments/ensure-support");

    await POST(
      makeReq({
        conclusion: "C",
        premises: [{ text: "P1" }, { text: "P2", isAxiom: true }],
      }),
    );

    expect(ensureArgumentSupportInTx).toHaveBeenCalledTimes(1);
    expect(markArgumentAsComposedInTx).toHaveBeenCalledTimes(1);
    const premiseRows = prismaMock.argumentPremise.createMany.mock.calls[0][0].data;
    expect(premiseRows.length).toBe(2);
    expect(premiseRows[1].isAxiom).toBe(true);
  });

  // ─── v1.1 §9.1: per-premise evidence ────────────────────────────────────────

  describe("per-premise evidence (v1.1 §9.1)", () => {
    it("attaches one evidence item per premise to that premise's Claim row", async () => {
      inferAndAssignSchemeMock.mockResolvedValueOnce(null);
      // Echo created ClaimEvidence rows back as ids derived from claimId+url
      // so the test can verify which claim each evidence row landed on.
      prismaMock.claimEvidence.findMany.mockImplementation(
        async ({ where }: any) => {
          const urls: string[] = where?.uri?.in ?? [];
          return urls.map((u: string, i: number) => ({
            id: `ev_${where.claimId}_${i}`,
          }));
        },
      );

      const res = await POST(
        makeReq({
          conclusion: "Caffeine is bad for adolescents",
          premises: [
            {
              text: "Sleep disruption",
              evidence: [{ url: "https://plos.example/sleep" }],
            },
            {
              text: "Cardio risk",
              evidence: [{ url: "https://riley.example/cardio" }],
            },
            {
              text: "Behavioral harms",
              evidence: [{ url: "https://jah.example/behavior" }],
            },
            {
              text: "Regulatory gap",
              evidence: [{ url: "https://biorxiv.example/aap" }],
            },
            {
              text: "Neurocognitive interference",
              evidence: [{ url: "https://abcd.example/neuro" }],
            },
          ],
        }),
      );
      expect(res.status).toBe(200);

      // One createMany call per claim that has evidence: 5 premise calls,
      // 0 conclusion calls (no top-level evidence supplied).
      const calls = prismaMock.claimEvidence.createMany.mock.calls;
      expect(calls.length).toBe(5);

      // Each call should target a distinct premise claim id and carry
      // exactly one row.
      const rowsByClaim = new Map<string, string[]>();
      for (const [{ data }] of calls) {
        for (const row of data) {
          if (!rowsByClaim.has(row.claimId)) rowsByClaim.set(row.claimId, []);
          rowsByClaim.get(row.claimId)!.push(row.uri);
        }
      }
      expect(rowsByClaim.size).toBe(5);
      // Conclusion claim should NOT appear in the write set.
      expect(rowsByClaim.has("claim_moid_caffeine is bad for adolescents")).toBe(
        false,
      );

      // Each premise claim got exactly one URL.
      for (const urls of rowsByClaim.values()) {
        expect(urls.length).toBe(1);
      }

      // Provenance enrichment fired with all 5 created EvidenceLink ids.
      expect(enrichEvidenceProvenanceInBackgroundMock).toHaveBeenCalledTimes(1);
      const enqueuedIds: string[] =
        enrichEvidenceProvenanceInBackgroundMock.mock.calls[0][0];
      expect(enqueuedIds.length).toBe(5);

      const body = await res.json();
      expect(body.provenancePending).toBe(true);
      expect(body.retryAfterMs).toBe(60_000);
    });

    it("merges evidence onto the surviving claim when premises dedup, with premise_evidence_merged warning", async () => {
      inferAndAssignSchemeMock.mockResolvedValueOnce(null);
      prismaMock.claimEvidence.findMany.mockImplementation(
        async ({ where }: any) => {
          const urls: string[] = where?.uri?.in ?? [];
          return urls.map((u: string, i: number) => ({
            id: `ev_${where.claimId}_${i}`,
          }));
        },
      );

      const res = await POST(
        makeReq({
          conclusion: "C",
          premises: [
            {
              text: "duplicate premise",
              evidence: [{ url: "https://a.example/one" }],
            },
            {
              text: "duplicate premise",
              evidence: [{ url: "https://b.example/two" }],
            },
          ],
        }),
      );
      expect(res.status).toBe(200);
      const body = await res.json();

      // Only one premise survives.
      expect(body.premises.length).toBe(1);
      const survivingClaimId = body.premises[0].id;

      // Both evidence URLs land on the surviving claim in a single
      // createMany call (one per claim).
      const calls = prismaMock.claimEvidence.createMany.mock.calls;
      expect(calls.length).toBe(1);
      const rows = calls[0][0].data;
      expect(rows.length).toBe(2);
      expect(rows.every((r: any) => r.claimId === survivingClaimId)).toBe(true);
      expect(rows.map((r: any) => r.uri).sort()).toEqual([
        "https://a.example/one",
        "https://b.example/two",
      ]);

      const codes = body.warnings.map((w: any) => w.code);
      expect(codes).toEqual(
        expect.arrayContaining(["premise_deduped", "premise_evidence_merged"]),
      );
    });

    it("merges premise evidence onto the conclusion when the premise collapses to the conclusion", async () => {
      inferAndAssignSchemeMock.mockResolvedValueOnce(null);
      prismaMock.claimEvidence.findMany.mockImplementation(
        async ({ where }: any) => {
          const urls: string[] = where?.uri?.in ?? [];
          return urls.map((u: string, i: number) => ({
            id: `ev_${where.claimId}_${i}`,
          }));
        },
      );

      const res = await POST(
        makeReq({
          // The first premise text matches the conclusion → collapses.
          // The second premise carries no evidence and is the survivor.
          conclusion: "shared text",
          premises: [
            {
              text: "shared text",
              evidence: [{ url: "https://shared.example/dropped" }],
            },
            { text: "distinct premise" },
          ],
          evidence: [{ url: "https://top.example/conclusion" }],
        }),
      );
      expect(res.status).toBe(200);
      const body = await res.json();

      // The premise that collapsed contributed its evidence to the
      // conclusion bucket; conclusion now writes 2 rows in one call.
      const calls = prismaMock.claimEvidence.createMany.mock.calls;
      const conclusionCalls = calls.filter(([{ data }]: any) =>
        data.every((r: any) => r.claimId === "claim_moid_shared text"),
      );
      expect(conclusionCalls.length).toBe(1);
      const conclusionUris = conclusionCalls[0][0].data
        .map((r: any) => r.uri)
        .sort();
      expect(conclusionUris).toEqual([
        "https://shared.example/dropped",
        "https://top.example/conclusion",
      ]);

      const codes = body.warnings.map((w: any) => w.code);
      expect(codes).toEqual(
        expect.arrayContaining(["premise_deduped", "premise_evidence_merged"]),
      );
    });

    it("keeps backward-compat: top-level evidence still attaches to the conclusion only", async () => {
      inferAndAssignSchemeMock.mockResolvedValueOnce(null);
      prismaMock.claimEvidence.findMany.mockResolvedValueOnce([{ id: "ev-top" }]);

      await POST(
        makeReq({
          conclusion: "C",
          premises: [{ text: "P1" }, { text: "P2" }],
          evidence: [{ url: "https://top-only.example/paper" }],
        }),
      );

      // Exactly one createMany — for the conclusion. No premise has
      // its own evidence array.
      const calls = prismaMock.claimEvidence.createMany.mock.calls;
      expect(calls.length).toBe(1);
      const rows = calls[0][0].data;
      expect(rows.length).toBe(1);
      expect(rows[0].claimId).toBe("claim_moid_c");
      expect(rows[0].uri).toBe("https://top-only.example/paper");
    });
  });

  // ─── B.1 §4 Phase B: health-selection gate ──────────────────────────────────

  describe("health-selection gate (B.1)", () => {
    /** Mock the gate's catalogue read + by-key lookup for a single scheme row. */
    function mockScheme(row: any) {
      // Peer index read (findMany over argument-pattern catalogue).
      prismaMock.argumentScheme.findMany.mockResolvedValue(
        [{ key: row.key, fingerprint: row.fingerprint ?? null }],
      );
      // By-key resolution inside the gate.
      prismaMock.argumentScheme.findUnique.mockResolvedValue(row);
    }

    it("refuses a dialogue-meta schemeKey with SCHEME_NOT_ARGUMENT_PATTERN and writes nothing", async () => {
      mockScheme({
        id: "dm-1",
        key: "bare_assertion",
        name: "Bare Assertion",
        kind: "dialogue-meta",
        clusterTag: "dialogue",
        fingerprint: null,
        epistemicMode: "FACTUAL",
      });

      const res = await POST(
        makeReq({
          conclusion: "C",
          premises: [{ text: "P1" }],
          schemeKey: "bare_assertion",
        }),
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe("SCHEME_NOT_ARGUMENT_PATTERN");
      expect(body.requestedKey).toBe("bare_assertion");
      expect(body.hint).toMatch(/excludeUnhealthy/);
      // No argument row written.
      expect(prismaMock.argument.create).not.toHaveBeenCalled();
    });

    it("refuses a test-placeholder schemeKey", async () => {
      mockScheme({
        id: "tp-1",
        key: "test_scheme",
        name: "Test",
        kind: "argument-scheme",
        clusterTag: null,
        fingerprint: null,
        epistemicMode: "FACTUAL",
      });

      const res = await POST(
        makeReq({
          conclusion: "C",
          premises: [{ text: "P1" }],
          schemeKey: "test_scheme",
        }),
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe("SCHEME_NOT_ARGUMENT_PATTERN");
      expect(prismaMock.argument.create).not.toHaveBeenCalled();
    });

    it("auto-redirects a folksonomy duplicate to canonical and emits SCHEME_CANONICALIZED", async () => {
      // Two argument-patterns share a fingerprint; canonical = "good_consequences".
      prismaMock.argumentScheme.findMany.mockResolvedValue([
        { key: "good_consequences", fingerprint: "fp-dup" },
        { key: "positive_consequences", fingerprint: "fp-dup" },
      ]);
      prismaMock.argumentScheme.findUnique.mockImplementation(async ({ where }: any) => {
        const rows: Record<string, any> = {
          positive_consequences: {
            id: "pc-1",
            key: "positive_consequences",
            name: "Positive Consequences",
            kind: "argument-scheme",
            clusterTag: "consequence_family",
            fingerprint: "fp-dup",
            epistemicMode: "FACTUAL",
          },
          good_consequences: {
            id: "gc-1",
            key: "good_consequences",
            name: "Good Consequences",
            kind: "argument-scheme",
            clusterTag: "consequence_family",
            fingerprint: "fp-dup",
            epistemicMode: "FACTUAL",
          },
        };
        return where.key ? rows[where.key] ?? null : null;
      });

      const res = await POST(
        makeReq({
          conclusion: "C",
          premises: [{ text: "P1" }],
          schemeKey: "positive_consequences",
        }),
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.schemeInstance.schemeKey).toBe("good_consequences");
      const canonWarn = body.warnings.find((w: any) => w.code === "SCHEME_CANONICALIZED");
      expect(canonWarn).toBeTruthy();
      expect(canonWarn.detail).toMatch(/positive_consequences/);
      expect(canonWarn.detail).toMatch(/good_consequences/);
      expect(canonWarn.canonical).toBe("good_consequences");
    });

    it("round-trips premiseType onto the ArgumentPremise rows (default ORDINARY)", async () => {
      mockScheme({
        id: "eo-1",
        key: "expert_opinion",
        name: "Expert Opinion",
        kind: "argument-scheme",
        clusterTag: "expert_family",
        fingerprint: null,
        epistemicMode: "FACTUAL",
      });

      await POST(
        makeReq({
          conclusion: "C",
          premises: [
            { text: "P1", premiseType: "exception" },
            { text: "P2" },
          ],
          schemeKey: "expert_opinion",
        }),
      );

      const rows = prismaMock.argumentPremise.createMany.mock.calls[0][0].data;
      expect(rows[0].premiseType).toBe("EXCEPTION");
      expect(rows[1].premiseType).toBe("ORDINARY");
    });

    it("emits EPISTEMIC_MODE_CHANGED_FINGERPRINT when the agent overrides the scheme's mode", async () => {
      mockScheme({
        id: "eo-2",
        key: "expert_opinion",
        name: "Expert Opinion",
        kind: "argument-scheme",
        clusterTag: "expert_family",
        fingerprint: null,
        epistemicMode: "FACTUAL",
      });

      const res = await POST(
        makeReq({
          conclusion: "C",
          premises: [{ text: "P1" }],
          schemeKey: "expert_opinion",
          epistemicMode: "HYPOTHETICAL",
        }),
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      const codes = body.warnings.map((w: any) => w.code);
      expect(codes).toContain("EPISTEMIC_MODE_CHANGED_FINGERPRINT");
      expect(body.schemeInstance.epistemicMode).toBe("HYPOTHETICAL");
      // Persisted on the instance.
      const instData = prismaMock.argumentSchemeInstance.create.mock.calls[0][0].data;
      expect(instData.epistemicMode).toBe("HYPOTHETICAL");
    });
  });

  // ─── Modular threading: reuseClaimId premises ───────────────────────────────

  describe("reuseClaimId threading", () => {
    it("threads a premise onto an existing claim by id without minting it", async () => {
      inferAndAssignSchemeMock.mockResolvedValueOnce(null);
      prismaMock.deliberation.findUnique.mockResolvedValueOnce({ id: "delib-x" });
      // The prior link's conclusion claim, living in the target deliberation.
      prismaMock.claim.findMany.mockResolvedValueOnce([
        {
          id: "claim_prior",
          text: "Cordon pricing reduces central traffic",
          moid: "moid_prior",
          deliberationId: "delib-x",
        },
      ]);

      const res = await POST(
        makeReq({
          conclusion: "Authorities should adopt cordon pricing",
          premises: [
            { reuseClaimId: "claim_prior" },
            { text: "The objections are addressable by design" },
          ],
          deliberationId: "delib-x",
        }),
      );
      expect(res.status).toBe(200);
      const body = await res.json();

      // The reused claim was NOT minted — only the one fresh premise upserts.
      const upsertedMoids = prismaMock.claim.upsert.mock.calls.map(
        (c: any) => c[0].where.moid,
      );
      expect(upsertedMoids).not.toContain("moid_prior");
      expect(upsertedMoids).toContain(
        "moid_the objections are addressable by design",
      );

      // The response includes the shared claim id, confirming the thread.
      const premiseIds = body.premises.map((p: any) => p.id);
      expect(premiseIds).toContain("claim_prior");

      // premise_threaded warning surfaced.
      expect(body.warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: "premise_threaded" }),
        ]),
      );

      // The ArgumentPremise row points at the shared claim.
      const premiseRows = prismaMock.argumentPremise.createMany.mock.calls[0][0].data;
      expect(premiseRows.map((r: any) => r.claimId)).toContain("claim_prior");
    });

    it("returns 400 PREMISE_CLAIM_NOT_FOUND when the reuseClaimId does not exist", async () => {
      inferAndAssignSchemeMock.mockResolvedValueOnce(null);
      prismaMock.deliberation.findUnique.mockResolvedValueOnce({ id: "delib-x" });
      prismaMock.claim.findMany.mockResolvedValueOnce([]); // nothing resolves

      const res = await POST(
        makeReq({
          conclusion: "C",
          premises: [{ reuseClaimId: "claim_missing" }, { text: "P2" }],
          deliberationId: "delib-x",
        }),
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe("PREMISE_CLAIM_NOT_FOUND");
      expect(body.error).toMatch(/claim_missing/);
      // Nothing written.
      expect(prismaMock.argument.create).not.toHaveBeenCalled();
    });

    it("returns 400 when the reused claim lives in a different deliberation", async () => {
      inferAndAssignSchemeMock.mockResolvedValueOnce(null);
      prismaMock.deliberation.findUnique.mockResolvedValueOnce({ id: "delib-x" });
      prismaMock.claim.findMany.mockResolvedValueOnce([
        {
          id: "claim_other",
          text: "Foreign claim",
          moid: "moid_foreign",
          deliberationId: "delib-OTHER",
        },
      ]);

      const res = await POST(
        makeReq({
          conclusion: "C",
          premises: [{ reuseClaimId: "claim_other" }, { text: "P2" }],
          deliberationId: "delib-x",
        }),
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe("PREMISE_CLAIM_NOT_FOUND");
      expect(body.error).toMatch(/different deliberation/);
      expect(prismaMock.argument.create).not.toHaveBeenCalled();
    });
  });
});

