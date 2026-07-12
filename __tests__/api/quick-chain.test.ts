/**
 * Integration tests for POST /api/argument-chains/quick-chain.
 *
 * Verifies the chain-creation write surface contracts from
 * Development and Ideation Documents/ARCHITECTURE/CHAIN_CREATION_OVER_MCP_SPEC.md §9:
 *   • mint-and-link MOID threading — a shared Claim row, threading mode "moid"
 *   • mint-and-link explicit reuseClaimId threading — mode "explicit", no re-mint
 *   • fork guard — divergent reuse text → CHAIN_LINK_BROKEN, txn never opened
 *   • topology guard — forward reference → CHAIN_LINK_INVALID_THREAD, nothing written
 *   • per-link Phase B health gate — dialogue-meta scheme → SCHEME_NOT_ARGUMENT_PATTERN,
 *     whole chain rolled back (atomicity)
 *   • canonicalisation — duplicate scheme → SCHEME_CANONICALIZED warning, chain created
 *   • worst-link chainStanding echo from chainExposure
 *   • intra-chain repeat → chain_link_scheme_repeat warning
 *   • compose mode — nodes + SUPPORTS edges, no minting; wrong delib → CHAIN_LINK_NOT_FOUND
 */

import { NextRequest } from "next/server";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const edgeRows: {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  edgeType: string;
  strength: number;
}[] = [];
const nodeRows: { id: string; argumentId: string; nodeOrder: number }[] = [];

const prismaMock: any = {
  deliberation: { findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
  argumentScheme: { findUnique: jest.fn(), findMany: jest.fn() },
  claim: { upsert: jest.fn(), createMany: jest.fn(), findMany: jest.fn() },
  claimEvidence: { createMany: jest.fn(), findMany: jest.fn() },
  argument: { create: jest.fn(), findMany: jest.fn() },
  argumentPremise: { createMany: jest.fn() },
  argumentSchemeInstance: { create: jest.fn() },
  argumentChain: { create: jest.fn(), update: jest.fn(), findFirst: jest.fn() },
  argumentChainNode: { create: jest.fn(), createMany: jest.fn(), findMany: jest.fn(), update: jest.fn() },
  argumentChainEdge: { create: jest.fn(), createMany: jest.fn(), findMany: jest.fn() },
  argumentScope: { create: jest.fn() },
  citation: { createMany: jest.fn(), findMany: jest.fn() },
  // N-1 capture: each minted link atomically upserts an ActProvenance row.
  actProvenance: { upsert: jest.fn(async () => ({ id: "actprov-1" })) },
  $transaction: jest.fn(async (fn: any) => fn(prismaMock)),
};

jest.mock("@/lib/prismaclient", () => ({ prisma: prismaMock }));

const resolveChainAuthorMock = jest.fn();
jest.mock("@/lib/citation/chainAuthor", () => ({
  resolveChainAuthor: (...a: any[]) => resolveChainAuthorMock(...a),
}));

const resolveSchemeForWriteMock = jest.fn();
const verifyAgainstFingerprintPeersMock = jest.fn();
jest.mock("@/lib/schemes/writeGate", () => ({
  resolveSchemeForWrite: (...a: any[]) => resolveSchemeForWriteMock(...a),
  verifyAgainstFingerprintPeers: (...a: any[]) => verifyAgainstFingerprintPeersMock(...a),
}));

const computeChainExposureMock = jest.fn();
jest.mock("@/lib/deliberation/chainExposure", () => ({
  computeChainExposure: (...a: any[]) => computeChainExposureMock(...a),
}));

jest.mock("@/lib/ids/mintMoid", () => ({
  // Deterministic MOID: prefix + lowercased trimmed text → easy collisions.
  mintClaimMoid: (text: string) => `moid_${text.trim().toLowerCase()}`,
}));

jest.mock("@/lib/arguments/ensure-support", () => ({
  ensureArgumentSupportInTx: jest.fn(async () => undefined),
}));

jest.mock("@/lib/arguments/detect-composition", () => ({
  markArgumentAsComposedInTx: jest.fn(async () => undefined),
}));

const inferAndAssignSchemeMock = jest.fn();
jest.mock("@/lib/argumentation/schemeInference", () => ({
  inferAndAssignScheme: (...a: any[]) => inferAndAssignSchemeMock(...a),
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

// PART 5 Step 3: Source resolution is mocked to a deterministic find-or-create.
const upsertSourceMock = jest.fn(async ({ url }: { url: string }) => ({
  source: { id: "source-1", url, doi: null, title: null, contentHash: null, archiveUrl: null },
  created: true,
}));
jest.mock("@/lib/sources/upsertSource", () => ({
  upsertSourceFromUrlOrDoi: (...a: any[]) => upsertSourceMock(...a),
}));

// Upstash rate-limit + redis: always allow.
jest.mock("@upstash/ratelimit", () => ({
  Ratelimit: class {
    static fixedWindow() {
      return null;
    }
    constructor(_: any) {}
    async limit(_: string) {
      return { success: true, reset: Date.now() + 3_600_000 };
    }
  },
}));
jest.mock("@upstash/redis", () => ({
  Redis: class {
    constructor(_: any) {}
  },
}));

// ─── Import under test (after mocks) ────────────────────────────────────────
import { POST } from "@/app/api/argument-chains/quick-chain/route";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/argument-chains/quick-chain", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  edgeRows.length = 0;
  nodeRows.length = 0;

  // Auth default: MCP-bearer service caller.
  resolveChainAuthorMock.mockResolvedValue({
    ownerId: 166n,
    userIdStr: "166",
    viaMcp: true,
  });

  // "My Arguments" deliberation lookup → already exists.
  prismaMock.deliberation.findFirst.mockResolvedValue({ id: "delib-my-args" });
  // Provided deliberationId → exists by default.
  prismaMock.deliberation.findUnique.mockResolvedValue({ id: "delib-provided" });

  // Scheme inference defaults to "no scheme assigned".
  inferAndAssignSchemeMock.mockResolvedValue(null);

  // Verifier: no fingerprint peers → skipped.
  verifyAgainstFingerprintPeersMock.mockResolvedValue({
    kind: "skipped",
    againstSchemeKey: null,
    runtimeMs: 0,
  });

  // Claim upsert echoes a stable id derived from MOID.
  prismaMock.claim.upsert.mockImplementation(async ({ where }: any) => ({
    id: `claim_${where.moid}`,
  }));
  // Batch claim upsert is a no-op; ids are recovered via findMany by MOID.
  prismaMock.claim.createMany.mockResolvedValue({ count: 0 });
  // findMany serves two callers: the batch claim resolver (where.moid.in →
  // synthesize { id: claim_<moid>, moid }) and the reuse pre-flight
  // (where.id.in → derive the moid back from the synthetic id).
  prismaMock.claim.findMany.mockImplementation(async ({ where }: any) => {
    if (where?.moid?.in) {
      return where.moid.in.map((moid: string) => ({ id: `claim_${moid}`, moid }));
    }
    const ids: string[] = where?.id?.in ?? [];
    return ids.map((id) => ({ id, moid: id.replace(/^claim_/, "") }));
  });

  // Argument creation: monotonically increasing ids.
  let argN = 0;
  prismaMock.argument.create.mockImplementation(async () => ({ id: `arg-${++argN}` }));

  prismaMock.argumentPremise.createMany.mockResolvedValue({ count: 0 });
  prismaMock.argumentSchemeInstance.create.mockResolvedValue({ id: "asi-1" });

  // Chain shell + nodes + edges.
  prismaMock.argumentChain.create.mockResolvedValue({ id: "chain-1" });
  prismaMock.argumentChain.update.mockResolvedValue({ id: "chain-1" });
  // Idempotency pre-flight: no prior chain for this key by default.
  prismaMock.argumentChain.findFirst.mockResolvedValue(null);
  // Node creation is batched: createMany records rows, findMany returns them
  // ordered by nodeOrder. Replay tests override findMany via mockResolvedValueOnce.
  prismaMock.argumentChainNode.createMany.mockImplementation(async ({ data }: any) => {
    for (const d of data) {
      nodeRows.push({
        id: `node-${d.nodeOrder}`,
        argumentId: d.argumentId,
        nodeOrder: d.nodeOrder,
      });
    }
    return { count: data.length };
  });
  prismaMock.argumentChainNode.findMany.mockImplementation(async () =>
    [...nodeRows].sort((a, b) => a.nodeOrder - b.nodeOrder),
  );
  prismaMock.argumentChainNode.create.mockImplementation(async ({ data }: any) => ({
    id: `node-${data.nodeOrder}`,
    argumentId: data.argumentId,
    nodeOrder: data.nodeOrder,
  }));
  prismaMock.argumentChainEdge.createMany.mockImplementation(async ({ data }: any) => {
    for (const e of data) {
      edgeRows.push({
        id: `edge-${edgeRows.length}`,
        sourceNodeId: e.sourceNodeId,
        targetNodeId: e.targetNodeId,
        edgeType: e.edgeType ?? "SUPPORTS",
        strength: typeof e.strength === "number" ? e.strength : 1.0,
      });
    }
    return { count: data.length };
  });
  prismaMock.argumentChainEdge.findMany.mockImplementation(async () => [...edgeRows]);

  // PART 4 attack edges are written one-at-a-time via .create (REBUTS /
  // UNDERMINES / UNDERCUTS). Record them into edgeRows so findMany echoes them
  // and assertions can read edgeType.
  let attackEdgeN = 0;
  prismaMock.argumentChainEdge.create.mockImplementation(async ({ data }: any) => {
    const row = {
      id: `attack-edge-${attackEdgeN++}`,
      sourceNodeId: data.sourceNodeId,
      targetNodeId: data.targetNodeId,
      edgeType: data.edgeType,
      strength: typeof data.strength === "number" ? data.strength : 1.0,
    };
    edgeRows.push(row);
    return row;
  });

  // PART 5 scope writes: ArgumentScope.create mints sequential ids; node.update
  // is a no-op echo.
  let scopeN = 0;
  prismaMock.argumentScope.create.mockImplementation(async () => ({ id: `scope-${scopeN++}` }));
  prismaMock.argumentChainNode.update.mockResolvedValue({ id: "node-0" });

  // Evidence writes default to no-ops.
  prismaMock.claimEvidence.createMany.mockResolvedValue({ count: 0 });
  prismaMock.claimEvidence.findMany.mockResolvedValue([]);

  // Citation writes default to no-ops; source resolution to source-1.
  prismaMock.citation.createMany.mockResolvedValue({ count: 0 });
  prismaMock.citation.findMany.mockResolvedValue([]);
  upsertSourceMock.mockClear();
  upsertSourceMock.mockImplementation(async ({ url }: { url: string }) => ({
    source: { id: "source-1", url, doi: null, title: null, contentHash: null, archiveUrl: null },
    created: true,
  }));

  // Chain exposure: no projection by default.
  computeChainExposureMock.mockResolvedValue({ chains: [] });
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("POST /api/argument-chains/quick-chain", () => {
  it("401s when unauthenticated", async () => {
    resolveChainAuthorMock.mockResolvedValueOnce(null);
    const res = await POST(
      makeReq({
        name: "C",
        links: [
          { conclusion: "B", premises: [{ text: "A" }] },
          { conclusion: "C", premises: [{ text: "B" }] },
        ],
      }),
    );
    expect(res.status).toBe(401);
  });

  // ─── Forgiving input: bare-string premises ────────────────────────────────

  it("coerces bare-string premises into { text } objects", async () => {
    const res = await POST(
      makeReq({
        name: "Bare strings",
        links: [
          // Premises supplied as plain strings rather than { text } objects.
          { conclusion: "B", premises: ["A"] },
          { conclusion: "C", premises: ["B"] },
        ],
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    // The string "B" still content-hash threads onto link 1's conclusion.
    expect(body.threading).toHaveLength(1);
    expect(body.threading[0].mode).toBe("moid");
  });

  // ─── mint-and-link: MOID threading (default) ──────────────────────────────

  it("threads link 1's conclusion into link 2's premise by MOID identity", async () => {
    const res = await POST(
      makeReq({
        name: "Caffeine chain",
        links: [
          { conclusion: "B", premises: [{ text: "A" }] },
          // Premise text equals link 1's conclusion → content-hash collapse.
          { conclusion: "C", premises: [{ text: "B" }] },
        ],
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();

    // Exactly one threading entry, by MOID, sharing link 1's conclusion claim.
    expect(body.threading).toHaveLength(1);
    expect(body.threading[0]).toEqual({
      fromLink: 0,
      toLink: 1,
      sharedClaimId: "claim_moid_b",
      mode: "moid",
    });
    // The shared claim is link 1's conclusion claim.
    expect(body.links[0].conclusionClaimId).toBe("claim_moid_b");

    // The shared MOID is minted exactly once (one Claim row, no fork) — the
    // batch upsert dedupes by MOID before hitting the DB.
    const upsertedMoids = prismaMock.claim.createMany.mock.calls[0][0].data.map(
      (d: any) => d.moid,
    );
    expect(upsertedMoids.filter((m: string) => m === "moid_b")).toHaveLength(1);

    // Auto-thread advisory warning surfaced.
    expect(body.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "chain_link_autothreaded" }),
      ]),
    );
  });

  // ─── mint-and-link: explicit reuseClaimId threading ───────────────────────

  it("threads via explicit reuseClaimId without re-minting the shared claim", async () => {
    const res = await POST(
      makeReq({
        name: "Explicit thread",
        links: [
          { conclusion: "B", premises: [{ text: "A" }] },
          { conclusion: "C", premises: [{ reuseClaimId: "claim_moid_b" }] },
        ],
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();

    expect(body.threading).toHaveLength(1);
    expect(body.threading[0]).toEqual({
      fromLink: 0,
      toLink: 1,
      sharedClaimId: "claim_moid_b",
      mode: "explicit",
    });

    // No claim is minted for the reused premise: only link 1 (conclusion B,
    // premise A) and link 2's conclusion C are batch-upserted.
    const upsertedMoids = prismaMock.claim.createMany.mock.calls[0][0].data.map(
      (d: any) => d.moid,
    );
    expect(upsertedMoids.sort()).toEqual(["moid_a", "moid_b", "moid_c"]);
  });

  // ─── Fork guard ───────────────────────────────────────────────────────────

  it("returns CHAIN_LINK_BROKEN and writes nothing when reuse text forks the claim", async () => {
    const res = await POST(
      makeReq({
        name: "Fork",
        links: [
          { conclusion: "B", premises: [{ text: "A" }] },
          {
            conclusion: "C",
            // Declared reuse, but sanity text mis-hashes vs the referenced claim.
            premises: [{ reuseClaimId: "claim_moid_b", text: "B paraphrased" }],
          },
        ],
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("CHAIN_LINK_BROKEN");
    expect(body.linkIndex).toBe(1);
    // Nothing written — transaction never opened.
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  // ─── Topology guard ───────────────────────────────────────────────────────

  it("returns CHAIN_LINK_INVALID_THREAD on a forward reference and writes nothing", async () => {
    const res = await POST(
      makeReq({
        name: "Forward ref",
        links: [
          // Link 1 forward-references link 2's conclusion claim.
          { conclusion: "B", premises: [{ reuseClaimId: "claim_moid_c" }] },
          { conclusion: "C", premises: [{ text: "A" }] },
        ],
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("CHAIN_LINK_INVALID_THREAD");
    expect(body.linkIndex).toBe(0);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  // ─── Per-link health gate (atomicity) ─────────────────────────────────────

  it("rolls back the whole chain when a middle link uses a dialogue-meta scheme", async () => {
    resolveSchemeForWriteMock.mockResolvedValue({
      ok: false,
      code: "SCHEME_NOT_ARGUMENT_PATTERN",
      canonical: null,
      requestedKey: "dialogue_meta_x",
      reason: "Scheme 'dialogue_meta_x' is dialogue-meta machinery.",
    });

    const res = await POST(
      makeReq({
        name: "Bad middle",
        links: [
          { conclusion: "B", premises: [{ text: "A" }] },
          { conclusion: "C", premises: [{ text: "B" }], schemeKey: "dialogue_meta_x" },
          { conclusion: "D", premises: [{ text: "C" }] },
        ],
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("SCHEME_NOT_ARGUMENT_PATTERN");
    expect(body.linkIndex).toBe(1);
    // Atomicity: nothing minted, no chain rows.
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  // ─── Canonicalisation ─────────────────────────────────────────────────────

  it("emits SCHEME_CANONICALIZED and still creates the chain when a scheme is a duplicate", async () => {
    resolveSchemeForWriteMock.mockResolvedValue({
      ok: true,
      canonicalizedFrom: "dup_key",
      scheme: {
        id: "scheme-canon",
        key: "canonical_key",
        name: "Canonical Pattern",
        epistemicMode: "FACTUAL",
        fingerprint: null,
        health: {},
      },
    });

    const res = await POST(
      makeReq({
        name: "Canon",
        links: [
          { conclusion: "B", premises: [{ text: "A" }], schemeKey: "dup_key" },
          { conclusion: "C", premises: [{ text: "B" }] },
        ],
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "SCHEME_CANONICALIZED" }),
      ]),
    );
    expect(body.links[0].schemeHealth).toBe("canonicalized");
    expect(body.links[0].schemeInstance).toEqual({
      id: "asi-1",
      schemeKey: "canonical_key",
      schemeName: "Canonical Pattern",
    });
  });

  // ─── Worst-link standing echo ─────────────────────────────────────────────

  it("echoes worst-link chainStanding and weakestLink from chainExposure", async () => {
    computeChainExposureMock.mockResolvedValueOnce({
      chains: [
        {
          id: "chain-1",
          chainStanding: "tested-undermined",
          weakestLink: { argumentId: "arg-2", reason: "premise contested" },
        },
      ],
    });

    const res = await POST(
      makeReq({
        name: "Undermined",
        links: [
          { conclusion: "B", premises: [{ text: "A" }] },
          { conclusion: "C", premises: [{ text: "B" }] },
        ],
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.chainStanding).toBe("tested-undermined");
    expect(body.weakestLink).toEqual({
      argumentId: "arg-2",
      reason: "premise contested",
      epistemicStatus: "ASSERTED",
    });
  });

  // ─── Intra-chain repeat radar ─────────────────────────────────────────────

  it("warns chain_link_scheme_repeat when two links share a scheme", async () => {
    resolveSchemeForWriteMock.mockResolvedValue({
      ok: true,
      canonicalizedFrom: null,
      scheme: {
        id: "scheme-eo",
        key: "expert_opinion",
        name: "Expert Opinion",
        epistemicMode: "FACTUAL",
        fingerprint: null,
        health: {},
      },
    });

    const res = await POST(
      makeReq({
        name: "Repeat",
        links: [
          { conclusion: "B", premises: [{ text: "A" }], schemeKey: "expert_opinion" },
          { conclusion: "C", premises: [{ text: "B" }], schemeKey: "expert_opinion" },
        ],
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "chain_link_scheme_repeat" }),
      ]),
    );
  });

  // ─── Compose mode ─────────────────────────────────────────────────────────

  it("compose mode wires existing arguments into nodes + SUPPORTS edges with no minting", async () => {
    prismaMock.argument.findMany.mockResolvedValueOnce([
      { id: "arg-a", deliberationId: "delib-x", conclusionClaimId: "cc-a", argumentSchemes: [] },
      { id: "arg-b", deliberationId: "delib-x", conclusionClaimId: "cc-b", argumentSchemes: [] },
      { id: "arg-c", deliberationId: "delib-x", conclusionClaimId: "cc-c", argumentSchemes: [] },
    ]);

    const res = await POST(
      makeReq({
        name: "Composed",
        mode: "compose",
        argumentIds: ["arg-a", "arg-b", "arg-c"],
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();

    expect(body.links).toHaveLength(3);
    expect(body.edges).toHaveLength(2);
    expect(body.edges.every((e: any) => e.edgeType === "SUPPORTS")).toBe(true);
    expect(body.threading).toEqual([]);
    // No minting in compose mode.
    expect(prismaMock.claim.createMany).not.toHaveBeenCalled();
    expect(prismaMock.argument.create).not.toHaveBeenCalled();
  });

  it("compose mode returns CHAIN_LINK_NOT_FOUND when an argument is in the wrong deliberation", async () => {
    prismaMock.argument.findMany.mockResolvedValueOnce([
      { id: "arg-a", deliberationId: "delib-y", conclusionClaimId: "cc-a", argumentSchemes: [] },
      { id: "arg-b", deliberationId: "delib-y", conclusionClaimId: "cc-b", argumentSchemes: [] },
    ]);

    const res = await POST(
      makeReq({
        name: "Wrong delib",
        mode: "compose",
        deliberationId: "delib-x",
        argumentIds: ["arg-a", "arg-b"],
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("CHAIN_LINK_NOT_FOUND");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("compose mode returns CHAIN_LINK_NOT_FOUND when an argumentId does not resolve", async () => {
    prismaMock.argument.findMany.mockResolvedValueOnce([
      { id: "arg-a", deliberationId: "delib-x", conclusionClaimId: "cc-a", argumentSchemes: [] },
    ]);

    const res = await POST(
      makeReq({
        name: "Missing arg",
        mode: "compose",
        argumentIds: ["arg-a", "arg-missing"],
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("CHAIN_LINK_NOT_FOUND");
  });

  // ─── Length guards ────────────────────────────────────────────────────────

  it("returns CHAIN_TOO_SHORT (400) for a single-link mint-and-link request", async () => {
    const res = await POST(
      makeReq({
        name: "Too short",
        links: [{ conclusion: "B", premises: [{ text: "A" }] }],
      }),
    );
    // Schema requires links.min(2): zod rejects before the handler's own guard.
    expect(res.status).toBe(400);
  });

  // ─── Idempotency (option A) ────────────────────────────────────────────────

  it("stamps the requestId as the chain's idempotencyKey on a fresh mint", async () => {
    const res = await POST(
      makeReq({
        name: "Keyed chain",
        requestId: "req-abc-123",
        links: [
          { conclusion: "B", premises: [{ text: "A" }] },
          { conclusion: "C", premises: [{ text: "B" }] },
        ],
      }),
    );
    expect(res.status).toBe(201);
    // Pre-flight looked up the key, found nothing, then minted with it stamped.
    expect(prismaMock.argumentChain.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { createdBy: 166n, idempotencyKey: "req-abc-123" },
      }),
    );
    const created = prismaMock.argumentChain.create.mock.calls[0][0];
    expect(created.data.idempotencyKey).toBe("req-abc-123");
  });

  it("replays the existing chain (no re-mint) when the requestId already landed", async () => {
    prismaMock.argumentChain.findFirst.mockResolvedValueOnce({
      id: "chain-existing",
      deliberationId: "delib-prior",
      name: "Keyed chain",
      rootNodeId: "node-0",
    });
    prismaMock.argumentChainNode.findMany.mockResolvedValueOnce([
      {
        id: "node-0",
        nodeOrder: 0,
        argument: { id: "arg-x", conclusionClaimId: "cc-x" },
      },
    ]);

    const res = await POST(
      makeReq({
        name: "Keyed chain",
        requestId: "req-abc-123",
        links: [
          { conclusion: "B", premises: [{ text: "A" }] },
          { conclusion: "C", premises: [{ text: "B" }] },
        ],
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.idempotentReplay).toBe(true);
    expect(body.chain.id).toBe("chain-existing");
    expect(body.chain.permalink).toContain("/chains/chain-existing");
    expect(body.links[0].argumentId).toBe("arg-x");
    // Nothing re-minted: no transaction, no claim upserts, no chain create.
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.claim.createMany).not.toHaveBeenCalled();
    expect(prismaMock.argumentChain.create).not.toHaveBeenCalled();
  });

  it("replays on a P2002 unique-key race instead of erroring", async () => {
    // Pre-flight misses (concurrent first write not yet committed) but the
    // chain create then loses the unique race; the catch re-looks-up and replays.
    prismaMock.argumentChain.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "chain-winner",
        deliberationId: "delib-prior",
        name: "Raced chain",
        rootNodeId: "node-0",
      });
    prismaMock.argumentChain.create.mockRejectedValueOnce(
      Object.assign(new Error("Unique constraint failed"), { code: "P2002" }),
    );
    prismaMock.argumentChainNode.findMany.mockResolvedValueOnce([]);

    const res = await POST(
      makeReq({
        name: "Raced chain",
        requestId: "req-race-9",
        links: [
          { conclusion: "B", premises: [{ text: "A" }] },
          { conclusion: "C", premises: [{ text: "B" }] },
        ],
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.idempotentReplay).toBe(true);
    expect(body.chain.id).toBe("chain-winner");
  });

  it("compose mode replays an already-landed requestId without composing", async () => {
    prismaMock.argumentChain.findFirst.mockResolvedValueOnce({
      id: "chain-composed",
      deliberationId: "delib-x",
      name: "Composed keyed",
      rootNodeId: "node-0",
    });
    prismaMock.argumentChainNode.findMany.mockResolvedValueOnce([]);

    const res = await POST(
      makeReq({
        name: "Composed keyed",
        mode: "compose",
        requestId: "req-compose-1",
        argumentIds: ["arg-a", "arg-b"],
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.idempotentReplay).toBe(true);
    expect(body.chain.id).toBe("chain-composed");
    // Compose short-circuits before loading arguments.
    expect(prismaMock.argument.findMany).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});

// ─── PART 4 Step 1: non-serial chain topology ──────────────────────────────────

describe("POST /api/argument-chains/quick-chain — topology (PART 4)", () => {
  it("defaults to a SERIAL spine when no edges are declared (backward-compat)", async () => {
    const res = await POST(
      makeReq({
        name: "Serial default",
        links: [
          { conclusion: "B", premises: [{ text: "A" }] },
          { conclusion: "C", premises: [{ text: "D" }] },
        ],
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.chain.chainType).toBe("SERIAL");
    expect(body.topology.derivedChainType).toBe("SERIAL");
    expect(body.topology.isDag).toBe(true);
    expect(body.edges).toHaveLength(1);
    expect(body.edges[0].edgeType).toBe("SUPPORTS");
  });

  it("derives CONVERGENT and persists typed edges for a fan-in edge set", async () => {
    const res = await POST(
      makeReq({
        name: "Convergent",
        links: [
          { conclusion: "P", premises: [{ text: "p0" }] },
          { conclusion: "Q", premises: [{ text: "q0" }] },
          { conclusion: "R", premises: [{ text: "r0" }] },
        ],
        edges: [
          { from: 0, to: 2 },
          { from: 1, to: 2 },
        ],
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.chain.chainType).toBe("CONVERGENT");
    expect(body.topology.derivedChainType).toBe("CONVERGENT");
    expect(body.topology.supportEdgeCount).toBe(2);
    expect(body.edges).toHaveLength(2);
    expect(body.edges.every((e: any) => e.edgeType === "SUPPORTS")).toBe(true);
  });

  it("rejects a support cycle (CHAIN_CYCLE_DETECTED) and writes nothing", async () => {
    const res = await POST(
      makeReq({
        name: "Cyclic",
        links: [
          { conclusion: "P", premises: [{ text: "p0" }] },
          { conclusion: "Q", premises: [{ text: "q0" }] },
          { conclusion: "R", premises: [{ text: "r0" }] },
        ],
        edges: [
          { from: 0, to: 1 },
          { from: 1, to: 2 },
          { from: 2, to: 0 },
        ],
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("CHAIN_CYCLE_DETECTED");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejects a lying chainType pin (CHAIN_TYPE_MISMATCH) and echoes the derived type", async () => {
    const res = await POST(
      makeReq({
        name: "Mislabelled",
        expectChainType: "SERIAL",
        links: [
          { conclusion: "P", premises: [{ text: "p0" }] },
          { conclusion: "Q", premises: [{ text: "q0" }] },
          { conclusion: "R", premises: [{ text: "r0" }] },
        ],
        edges: [
          { from: 0, to: 2 },
          { from: 1, to: 2 },
        ],
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("CHAIN_TYPE_MISMATCH");
    expect(body.derivedChainType).toBe("CONVERGENT");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejects an out-of-range edge index (CHAIN_EDGE_INVALID_INDEX)", async () => {
    const res = await POST(
      makeReq({
        name: "Bad index",
        links: [
          { conclusion: "P", premises: [{ text: "p0" }] },
          { conclusion: "Q", premises: [{ text: "q0" }] },
        ],
        edges: [{ from: 0, to: 5 }],
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("CHAIN_EDGE_INVALID_INDEX");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("compose mode honours a declared CONVERGENT edge set", async () => {
    prismaMock.argument.findMany.mockResolvedValueOnce([
      { id: "arg-a", deliberationId: "delib-x", conclusionClaimId: "cc-a", argumentSchemes: [] },
      { id: "arg-b", deliberationId: "delib-x", conclusionClaimId: "cc-b", argumentSchemes: [] },
      { id: "arg-c", deliberationId: "delib-x", conclusionClaimId: "cc-c", argumentSchemes: [] },
    ]);

    const res = await POST(
      makeReq({
        name: "Composed convergent",
        mode: "compose",
        argumentIds: ["arg-a", "arg-b", "arg-c"],
        edges: [
          { from: 0, to: 2 },
          { from: 1, to: 2 },
        ],
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.chain.chainType).toBe("CONVERGENT");
    expect(body.topology.derivedChainType).toBe("CONVERGENT");
    expect(body.edges).toHaveLength(2);
  });
});

// ─── Recursive attacks (PART 4 §4.2, Steps 3–4) ──────────────────────────────

describe("POST /api/argument-chains/quick-chain — attacks (PART 4 Steps 3–4)", () => {
  it("emits an empty attacks register when no link declares an attack", async () => {
    const res = await POST(
      makeReq({
        name: "No attacks",
        links: [
          { conclusion: "B", premises: [{ text: "A" }] },
          { conclusion: "C", premises: [{ text: "B" }] },
        ],
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.attacks).toEqual([]);
    expect(prismaMock.argumentChainEdge.create).not.toHaveBeenCalled();
  });

  it("lays a REBUTS edge for a node→node attack and registers it", async () => {
    const res = await POST(
      makeReq({
        name: "Node rebuttal",
        links: [
          { conclusion: "B", premises: [{ text: "A" }] },
          { conclusion: "C", premises: [{ text: "B" }] },
          { conclusion: "Not C", premises: [{ text: "E" }], attacksNode: 1 },
        ],
        edges: [{ from: 0, to: 1 }],
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.attacks).toHaveLength(1);
    expect(body.attacks[0]).toMatchObject({
      attackerNodeId: "node-2",
      targetType: "NODE",
      targetNodeId: "node-1",
      targetEdgeId: null,
      edgeType: "REBUTS",
    });
    // A REBUTS edge attacker → target was written.
    const created = prismaMock.argumentChainEdge.create.mock.calls.map(
      (c: any) => c[0].data,
    );
    expect(created).toEqual([
      expect.objectContaining({
        sourceNodeId: "node-2",
        targetNodeId: "node-1",
        edgeType: "REBUTS",
      }),
    ]);
  });

  it("honours attackType=UNDERMINES on a node attack", async () => {
    const res = await POST(
      makeReq({
        name: "Node undermine",
        links: [
          { conclusion: "B", premises: [{ text: "A" }] },
          { conclusion: "C", premises: [{ text: "B" }] },
          {
            conclusion: "Premise A is false",
            premises: [{ text: "E" }],
            attacksNode: 0,
            attackType: "UNDERMINES",
          },
        ],
        edges: [{ from: 0, to: 1 }],
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.attacks[0].edgeType).toBe("UNDERMINES");
    expect(body.attacks[0].targetNodeId).toBe("node-0");
  });

  it("undercuts a declared support edge (the headline edge attack)", async () => {
    const res = await POST(
      makeReq({
        name: "Inference undercut",
        links: [
          { conclusion: "P", premises: [{ text: "p0" }] },
          { conclusion: "Q", premises: [{ text: "q0" }] },
          { conclusion: "R", premises: [{ text: "r0" }] },
          {
            conclusion: "The P→R inference does not hold",
            premises: [{ text: "u0" }],
            attacksEdge: { from: 0, to: 2 },
          },
        ],
        edges: [
          { from: 0, to: 2 },
          { from: 1, to: 2 },
        ],
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.attacks).toHaveLength(1);
    expect(body.attacks[0]).toMatchObject({
      attackerNodeId: "node-3",
      targetType: "EDGE",
      targetNodeId: null,
      edgeType: "UNDERCUTS",
    });
    expect(typeof body.attacks[0].targetEdgeId).toBe("string");
    // The attacker node was flipped to a node→edge attacker.
    expect(prismaMock.argumentChainNode.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "node-3" },
        data: expect.objectContaining({ targetType: "EDGE" }),
      }),
    );
    // An UNDERCUTS edge attacker → the attacked inference's source was laid.
    const created = prismaMock.argumentChainEdge.create.mock.calls.map(
      (c: any) => c[0].data,
    );
    expect(created).toEqual([
      expect.objectContaining({
        sourceNodeId: "node-3",
        targetNodeId: "node-0",
        edgeType: "UNDERCUTS",
      }),
    ]);
  });

  it("rejects an edge attack on a non-existent edge (CHAIN_ATTACK_TARGET_NOT_FOUND) and writes nothing", async () => {
    const res = await POST(
      makeReq({
        name: "Phantom undercut",
        links: [
          { conclusion: "P", premises: [{ text: "p0" }] },
          { conclusion: "Q", premises: [{ text: "q0" }] },
          {
            conclusion: "nope",
            premises: [{ text: "u0" }],
            attacksEdge: { from: 0, to: 1 },
          },
        ],
        edges: [{ from: 0, to: 2 }],
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("CHAIN_ATTACK_TARGET_NOT_FOUND");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejects a depth-2 attack on an attack edge (CHAIN_ATTACK_ON_ATTACK)", async () => {
    const res = await POST(
      makeReq({
        name: "Second-order undercut",
        links: [
          { conclusion: "P", premises: [{ text: "p0" }] },
          { conclusion: "Q", premises: [{ text: "q0" }] },
          {
            conclusion: "nope",
            premises: [{ text: "u0" }],
            attacksEdge: { from: 0, to: 1 },
          },
        ],
        // 0→1 is itself an attack (REBUTS); undercutting it is 2nd-order.
        edges: [{ from: 0, to: 1, edgeType: "REBUTS" }],
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("CHAIN_ATTACK_ON_ATTACK");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejects an out-of-range node attack (CHAIN_EDGE_INVALID_INDEX)", async () => {
    const res = await POST(
      makeReq({
        name: "Bad attack index",
        links: [
          { conclusion: "B", premises: [{ text: "A" }] },
          { conclusion: "C", premises: [{ text: "B" }], attacksNode: 9 },
        ],
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("CHAIN_EDGE_INVALID_INDEX");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});

// ─── Scopes & epistemic status (PART 5, §4–§6) ───────────────────────────────

describe("POST /api/argument-chains/quick-chain — scopes (PART 5)", () => {
  it("with no scopes, every node is ASSERTED/actual-world and scopes is empty", async () => {
    const res = await POST(
      makeReq({
        name: "Plain chain",
        links: [
          { conclusion: "B", premises: [{ text: "A" }] },
          { conclusion: "C", premises: [{ text: "B" }] },
        ],
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.scopes).toEqual([]);
    expect(body.links.every((l: any) => l.epistemicStatus === "ASSERTED")).toBe(true);
    expect(body.links.every((l: any) => l.scopeId === null)).toBe(true);
    expect(body.links.every((l: any) => l.dialecticalRole === null)).toBe(true);
    // No scope rows minted, no node-update second pass.
    expect(prismaMock.argumentScope.create).not.toHaveBeenCalled();
    expect(prismaMock.argumentChainNode.update).not.toHaveBeenCalled();
  });

  it("a HYPOTHETICAL scope mints one scope row and tags its nodes HYPOTHETICAL", async () => {
    const res = await POST(
      makeReq({
        name: "Supposition chain",
        links: [
          { conclusion: "B", premises: [{ text: "A" }], scope: 0 },
          { conclusion: "C", premises: [{ text: "B" }], scope: 0 },
        ],
        scopes: [{ scopeType: "HYPOTHETICAL", assumption: "Suppose the tax passes" }],
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();

    // One scope echoed, both nodes inside it.
    expect(body.scopes).toHaveLength(1);
    expect(body.scopes[0]).toMatchObject({
      scopeType: "HYPOTHETICAL",
      assumption: "Suppose the tax passes",
      parentScopeId: null,
      depth: 0,
    });
    expect(body.scopes[0].nodeIds).toHaveLength(2);

    // Nodes carry HYPOTHETICAL status and the minted scope id.
    expect(body.links.every((l: any) => l.epistemicStatus === "HYPOTHETICAL")).toBe(true);
    expect(body.links.every((l: any) => l.scopeId === body.scopes[0].id)).toBe(true);

    // The scope row was minted and each node updated.
    expect(prismaMock.argumentScope.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.argumentChainNode.update).toHaveBeenCalledTimes(2);

    // Mode coercion advisory surfaced (HYPOTHETICAL scope forces the link mode).
    expect(body.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "scope_mode_coerced" }),
      ]),
    );
  });

  it("mints nested scopes parents-first and records depth", async () => {
    const res = await POST(
      makeReq({
        name: "Nested chain",
        links: [
          { conclusion: "B", premises: [{ text: "A" }], scope: 0 },
          { conclusion: "C", premises: [{ text: "B" }], scope: 1 },
        ],
        scopes: [
          { scopeType: "HYPOTHETICAL", assumption: "Outer" },
          { scopeType: "HYPOTHETICAL", assumption: "Inner", parentScope: 0 },
        ],
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.scopes).toHaveLength(2);
    const inner = body.scopes.find((s: any) => s.assumption === "Inner");
    const outer = body.scopes.find((s: any) => s.assumption === "Outer");
    expect(outer).toMatchObject({ depth: 0, parentScopeId: null });
    expect(inner).toMatchObject({ depth: 1, parentScopeId: outer.id });
    expect(prismaMock.argumentScope.create).toHaveBeenCalledTimes(2);
  });

  it("rejects a scope leak into the actual world (SCOPE_LEAK), writing nothing", async () => {
    const res = await POST(
      makeReq({
        name: "Leaky chain",
        links: [
          // Link 0 lives inside the supposition; link 1 (actual world) threads it.
          { conclusion: "B", premises: [{ text: "A" }], scope: 0 },
          { conclusion: "C", premises: [{ text: "B" }] },
        ],
        scopes: [{ scopeType: "HYPOTHETICAL", assumption: "Suppose" }],
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("SCOPE_LEAK");
    expect(body.linkIndex).toBe(1);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejects ASSERTED inside a COUNTERFACTUAL scope (SCOPE_STATUS_CONFLICT)", async () => {
    const res = await POST(
      makeReq({
        name: "Conflicted chain",
        links: [
          { conclusion: "B", premises: [{ text: "A" }], scope: 0, epistemicStatus: "ASSERTED" },
          { conclusion: "C", premises: [{ text: "B" }], scope: 0 },
        ],
        scopes: [{ scopeType: "COUNTERFACTUAL", assumption: "Had we acted" }],
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("SCOPE_STATUS_CONFLICT");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("tags the weakest link with its epistemic status in the standing echo", async () => {
    computeChainExposureMock.mockResolvedValueOnce({
      chains: [
        {
          id: "chain-1",
          chainStanding: "DEFEATED",
          weakestLink: { argumentId: "arg-1", reason: "undercut" },
        },
      ],
    });

    const res = await POST(
      makeReq({
        name: "Echoed chain",
        links: [
          { conclusion: "B", premises: [{ text: "A" }], scope: 0 },
          { conclusion: "C", premises: [{ text: "B" }], scope: 0 },
        ],
        scopes: [{ scopeType: "HYPOTHETICAL", assumption: "Suppose" }],
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.weakestLink).toMatchObject({
      argumentId: "arg-1",
      epistemicStatus: "HYPOTHETICAL",
    });
  });
});

// ─── Per-link evidence: anchors, intent & citations (PART 5 Step 3, §4.5–§4.6) ─
describe("POST /api/argument-chains/quick-chain — evidence (PART 5 Step 3)", () => {
  it("backward-compat: plain { url, quote } evidence writes ClaimEvidence but no Citation", async () => {
    const res = await POST(
      makeReq({
        name: "Plain evidence",
        links: [
          {
            conclusion: "B",
            premises: [{ text: "A" }],
            evidence: [{ url: "https://example.com/a", quote: "as shown" }],
          },
          { conclusion: "C", premises: [{ text: "B" }] },
        ],
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    // ClaimEvidence still written; no Source resolved; no Citation row.
    expect(prismaMock.claimEvidence.createMany).toHaveBeenCalled();
    expect(upsertSourceMock).not.toHaveBeenCalled();
    expect(prismaMock.citation.createMany).not.toHaveBeenCalled();
    // Every link surfaces an (empty) citations array.
    expect(body.links.every((l: any) => Array.isArray(l.citations))).toBe(true);
    expect(body.links[0].citations).toEqual([]);
  });

  it("a page anchor + supports intent resolves a Source, writes a Citation, and echoes it on the link", async () => {
    prismaMock.citation.findMany.mockResolvedValueOnce([
      {
        id: "cite-1",
        sourceId: "source-1",
        locator: "p. 13",
        anchorType: "page",
        intent: "supports",
      },
    ]);
    const res = await POST(
      makeReq({
        name: "Anchored evidence",
        links: [
          {
            conclusion: "B",
            premises: [{ text: "A" }],
            evidence: [
              {
                url: "https://example.com/a",
                quote: "as shown",
                locator: "p. 13",
                anchorType: "page",
                intent: "supports",
              },
            ],
          },
          { conclusion: "C", premises: [{ text: "B" }] },
        ],
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(upsertSourceMock).toHaveBeenCalledWith(
      expect.objectContaining({ url: "https://example.com/a" }),
    );
    expect(prismaMock.citation.createMany).toHaveBeenCalled();
    const data = prismaMock.citation.createMany.mock.calls[0][0].data;
    expect(data[0]).toMatchObject({
      targetType: "claim",
      sourceId: "source-1",
      locator: "p. 13",
      anchorType: "page",
      intent: "supports",
    });
    // The executable citation is echoed on link 0.
    expect(body.links[0].citations).toEqual([
      {
        id: "cite-1",
        sourceId: "source-1",
        locator: "p. 13",
        anchorType: "page",
        intent: "supports",
      },
    ]);
  });

  it("accepts a timestamp anchor of { start: 494 }", async () => {
    const res = await POST(
      makeReq({
        name: "Timestamp evidence",
        links: [
          {
            conclusion: "B",
            premises: [{ text: "A" }],
            evidence: [
              {
                url: "https://example.com/talk",
                anchorType: "timestamp",
                anchorData: { start: 494 },
                intent: "supports",
              },
            ],
          },
          { conclusion: "C", premises: [{ text: "B" }] },
        ],
      }),
    );
    expect(res.status).toBe(201);
    expect(prismaMock.citation.createMany).toHaveBeenCalled();
  });

  it("rejects a malformed coordinates anchor (EVIDENCE_ANCHOR_MALFORMED), writing nothing", async () => {
    const res = await POST(
      makeReq({
        name: "Malformed anchor",
        links: [
          {
            conclusion: "B",
            premises: [{ text: "A" }],
            evidence: [
              {
                url: "https://example.com/a",
                anchorType: "coordinates",
                anchorData: { start: 1 },
              },
            ],
          },
          { conclusion: "C", premises: [{ text: "B" }] },
        ],
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("EVIDENCE_ANCHOR_MALFORMED");
    expect(body.linkIndex).toBe(0);
    // Anchor validation is a pre-flight: nothing minted, no Source resolved.
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(upsertSourceMock).not.toHaveBeenCalled();
    expect(prismaMock.citation.createMany).not.toHaveBeenCalled();
  });

  it("flags a refutes intent on a support link with evidence_intent_contrary but still writes it", async () => {
    const res = await POST(
      makeReq({
        name: "Contrary intent",
        links: [
          {
            conclusion: "B",
            premises: [{ text: "A" }],
            evidence: [
              {
                url: "https://example.com/a",
                anchorType: "page",
                locator: "p. 1",
                intent: "refutes",
              },
            ],
          },
          { conclusion: "C", premises: [{ text: "B" }] },
        ],
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "evidence_intent_contrary" }),
      ]),
    );
    // Advisory, not gating: the citation is still written.
    expect(prismaMock.citation.createMany).toHaveBeenCalled();
  });

  it("rejects when an evidence URL cannot be resolved to a Source (EVIDENCE_SOURCE_UNRESOLVED)", async () => {
    upsertSourceMock.mockRejectedValueOnce(new Error("unresolvable"));
    const res = await POST(
      makeReq({
        name: "Unresolvable source",
        links: [
          {
            conclusion: "B",
            premises: [{ text: "A" }],
            evidence: [
              {
                url: "https://example.com/missing",
                anchorType: "page",
                locator: "p. 2",
              },
            ],
          },
          { conclusion: "C", premises: [{ text: "B" }] },
        ],
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("EVIDENCE_SOURCE_UNRESOLVED");
    // Source resolution is a pre-flight: nothing minted.
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});

