/**
 * Integration tests for POST /api/cqs/challenge — the MCP-aware
 * `challenge_critical_question` write surface (Dev Spec §11.7).
 *
 * Verifies the admissibility bar + the SATISFIED → DISPUTED flip:
 *   • happy REBUT on a SATISFIED CQ → DISPUTED, edge+CQAttack+claims+log
 *   • UNDERMINE with no evidence → 422 (nothing written)
 *   • UNDERMINE with evidence → success
 *   • challenger-burden evidence rule (requiresEvidence master switch)
 *   • challenge on an unanswered CQ → 409 CQ_NOT_ANSWERED
 *   • unknown argument → 404; ambiguous cqKey → 400
 *   • idempotent replay by requestId; duplicate live challenge → 409
 *   • lazy answer-claim reuse (second challenge reuses answerClaimId)
 */

import { NextRequest } from "next/server";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const prismaMock: any = {
  argument: { findUnique: jest.fn() },
  claim: { findMany: jest.fn(), create: jest.fn() },
  cQStatus: { findUnique: jest.fn(), update: jest.fn() },
  cQResponse: { update: jest.fn() },
  claimEdge: { findFirst: jest.fn(), upsert: jest.fn() },
  cQAttack: { create: jest.fn() },
  cQActivityLog: { create: jest.fn() },
  $transaction: jest.fn(async (fn: any) => fn(prismaMock)),
};

jest.mock("@/lib/prismaclient", () => ({ prisma: prismaMock }));

const resolveCitationCallerUserIdMock = jest.fn();
jest.mock("@/lib/citation/mcpAuth", () => ({
  resolveCitationCallerUserId: (...a: any[]) =>
    resolveCitationCallerUserIdMock(...a),
  isMcpBearer: jest.fn(() => true),
}));

const getOrCreatePermalinkMock = jest.fn(async () => ({
  fullUrl: "https://mesh.test/a/abc123",
}));
jest.mock("@/lib/citations/permalinkService", () => ({
  getOrCreatePermalink: (...a: any[]) => getOrCreatePermalinkMock(...a),
}));

const recomputeMock = jest.fn(async () => {});
jest.mock("@/lib/ceg/grounded", () => ({
  recomputeGroundedForDelib: (...a: any[]) => recomputeMock(...a),
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
import { POST } from "@/app/api/cqs/challenge/route";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/cqs/challenge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * Default argument fixture with one scheme `expert-opinion` carrying two CQs.
 * `expertise` defaults to PROPONENT burden / no evidence required; `bias`
 * places the evidential burden on the CHALLENGER with requiresEvidence true.
 */
function argFixture(
  cqs: Array<{
    cqKey: string;
    burdenOfProof: string | null;
    requiresEvidence: boolean;
  }> = [
    { cqKey: "expertise", burdenOfProof: "PROPONENT", requiresEvidence: false },
  ],
  extraSchemes: any[] = [],
) {
  return {
    id: "arg1",
    deliberationId: "delib1",
    argumentSchemes: [
      { scheme: { id: "sch1", key: "expert-opinion", cqs } },
      ...extraSchemes,
    ],
  };
}

/** A SATISFIED CQStatus with a canonical answer (not yet materialised). */
function answeredCqStatus(overrides: Record<string, unknown> = {}) {
  return {
    id: "cqs1",
    statusEnum: "SATISFIED",
    canonicalResponseId: "resp1",
    canonicalResponse: {
      id: "resp1",
      groundsText: "The expert holds a tenured chair in the field.",
      contributorId: "author1",
      answerClaimId: null,
    },
    ...overrides,
  };
}

const VALID_GROUNDS = "The cited chair was revoked in 2024 for misconduct.";

beforeEach(() => {
  jest.clearAllMocks();

  resolveCitationCallerUserIdMock.mockResolvedValue("challenger-1");
  prismaMock.argument.findUnique.mockResolvedValue(argFixture());
  prismaMock.cQStatus.findUnique.mockResolvedValue(answeredCqStatus());
  prismaMock.claim.findMany.mockResolvedValue([]);
  prismaMock.claimEdge.findFirst.mockResolvedValue(null);

  // claim.create → distinct ids by moid prefix (answer-claim vs challenge-claim).
  prismaMock.claim.create.mockImplementation(async ({ data }: any) => ({
    id: String(data.moid).startsWith("cq-answer")
      ? "answerClaim1"
      : "challengeClaim1",
  }));
  prismaMock.cQResponse.update.mockResolvedValue({});
  prismaMock.claimEdge.upsert.mockResolvedValue({ id: "edge1" });
  prismaMock.cQAttack.create.mockResolvedValue({ id: "att1" });
  prismaMock.cQStatus.update.mockResolvedValue({});
  prismaMock.cQActivityLog.create.mockResolvedValue({});
});

// ─── 1. Happy REBUT ──────────────────────────────────────────────────────────

test("a REBUT on a SATISFIED CQ flips it to DISPUTED and writes the full chain", async () => {
  const res = await POST(
    makeReq({
      argumentId: "arg1",
      cqKey: "expertise",
      attackType: "REBUT",
      groundsText: VALID_GROUNDS,
    }),
  );
  const json = await res.json();

  expect(res.status).toBe(201);
  expect(json.ok).toBe(true);
  expect(json.cqStatusEnum).toBe("DISPUTED");
  expect(json.attackType).toBe("REBUT");
  expect(json.challengeClaimId).toBe("challengeClaim1");
  expect(json.answerClaimId).toBe("answerClaim1");
  expect(json.claimEdgeId).toBe("edge1");
  expect(json.cqAttackId).toBe("att1");

  // Lazy answer-claim materialised, then challenge-claim → two claim.create.
  expect(prismaMock.claim.create).toHaveBeenCalledTimes(2);
  // Edge mapped REBUT → REBUTS / conclusion.
  expect(prismaMock.claimEdge.upsert).toHaveBeenCalledWith(
    expect.objectContaining({
      create: expect.objectContaining({
        attackType: "REBUTS",
        targetScope: "conclusion",
      }),
    }),
  );
  // Status flipped to DISPUTED.
  expect(prismaMock.cQStatus.update).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { id: "cqs1" },
      data: { statusEnum: "DISPUTED" },
    }),
  );
  // CHALLENGE_FILED logged.
  const actions = prismaMock.cQActivityLog.create.mock.calls.map(
    (c: any[]) => c[0].data.action,
  );
  expect(actions).toContain("CHALLENGE_FILED");
});

// ─── 2. UNDERMINE without evidence → 422 ─────────────────────────────────────

test("an UNDERMINE with no evidence is rejected 422 and writes nothing", async () => {
  const res = await POST(
    makeReq({
      argumentId: "arg1",
      cqKey: "expertise",
      attackType: "UNDERMINE",
      groundsText: VALID_GROUNDS,
    }),
  );
  const json = await res.json();

  expect(res.status).toBe(422);
  expect(json.code).toBe("CQ_CHALLENGE_NEEDS_EVIDENCE");
  expect(prismaMock.claim.create).not.toHaveBeenCalled();
  expect(prismaMock.cQStatus.update).not.toHaveBeenCalled();
});

// ─── 3. UNDERMINE with evidence → success ────────────────────────────────────

test("an UNDERMINE with an evidence claim succeeds", async () => {
  prismaMock.claim.findMany.mockResolvedValue([{ id: "ev1" }]);

  const res = await POST(
    makeReq({
      argumentId: "arg1",
      cqKey: "expertise",
      attackType: "UNDERMINE",
      groundsText: VALID_GROUNDS,
      evidenceClaimIds: ["ev1"],
    }),
  );
  const json = await res.json();

  expect(res.status).toBe(201);
  expect(json.cqStatusEnum).toBe("DISPUTED");
  expect(prismaMock.claimEdge.upsert).toHaveBeenCalledWith(
    expect.objectContaining({
      create: expect.objectContaining({
        attackType: "UNDERMINES",
        targetScope: "premise",
      }),
    }),
  );
});

// ─── 4. Challenger-burden evidence rule (master switch) ──────────────────────

test("a challenger-burden CQ with requiresEvidence requires evidence on a bare REBUT", async () => {
  prismaMock.argument.findUnique.mockResolvedValue(
    argFixture([
      { cqKey: "bias", burdenOfProof: "CHALLENGER", requiresEvidence: true },
    ]),
  );
  prismaMock.cQStatus.findUnique.mockResolvedValue(answeredCqStatus());

  const res = await POST(
    makeReq({
      argumentId: "arg1",
      cqKey: "bias",
      attackType: "REBUT",
      groundsText: VALID_GROUNDS,
    }),
  );
  const json = await res.json();

  expect(res.status).toBe(422);
  expect(json.code).toBe("CQ_CHALLENGE_NEEDS_EVIDENCE");
});

test("a challenger-burden CQ with requiresEvidence:false accepts a bare REBUT", async () => {
  prismaMock.argument.findUnique.mockResolvedValue(
    argFixture([
      { cqKey: "bias", burdenOfProof: "CHALLENGER", requiresEvidence: false },
    ]),
  );
  prismaMock.cQStatus.findUnique.mockResolvedValue(answeredCqStatus());

  const res = await POST(
    makeReq({
      argumentId: "arg1",
      cqKey: "bias",
      attackType: "REBUT",
      groundsText: VALID_GROUNDS,
    }),
  );
  const json = await res.json();

  expect(res.status).toBe(201);
  expect(json.cqStatusEnum).toBe("DISPUTED");
});

// ─── 5. Unanswered CQ → 409 ──────────────────────────────────────────────────

test("challenging an unanswered CQ returns 409 CQ_NOT_ANSWERED", async () => {
  prismaMock.cQStatus.findUnique.mockResolvedValue({
    id: "cqs1",
    statusEnum: "OPEN",
    canonicalResponseId: null,
    canonicalResponse: null,
  });

  const res = await POST(
    makeReq({
      argumentId: "arg1",
      cqKey: "expertise",
      attackType: "REBUT",
      groundsText: VALID_GROUNDS,
    }),
  );
  const json = await res.json();

  expect(res.status).toBe(409);
  expect(json.code).toBe("CQ_NOT_ANSWERED");
  expect(prismaMock.claim.create).not.toHaveBeenCalled();
});

// ─── 6. Unknown argument → 404 ───────────────────────────────────────────────

test("an unknown argument returns 404 CQ_ARGUMENT_NOT_FOUND", async () => {
  prismaMock.argument.findUnique.mockResolvedValue(null);

  const res = await POST(
    makeReq({
      argumentId: "missing",
      cqKey: "expertise",
      attackType: "REBUT",
      groundsText: VALID_GROUNDS,
    }),
  );
  const json = await res.json();

  expect(res.status).toBe(404);
  expect(json.code).toBe("CQ_ARGUMENT_NOT_FOUND");
});

// ─── 7. Ambiguous cqKey → 400 ────────────────────────────────────────────────

test("the same cqKey on two schemes without a schemeKey returns 400 CQ_AMBIGUOUS_SCHEME", async () => {
  prismaMock.argument.findUnique.mockResolvedValue(
    argFixture(
      [
        {
          cqKey: "expertise",
          burdenOfProof: "PROPONENT",
          requiresEvidence: false,
        },
      ],
      [
        {
          scheme: {
            id: "sch2",
            key: "position-to-know",
            cqs: [
              {
                cqKey: "expertise",
                burdenOfProof: "PROPONENT",
                requiresEvidence: false,
              },
            ],
          },
        },
      ],
    ),
  );

  const res = await POST(
    makeReq({
      argumentId: "arg1",
      cqKey: "expertise",
      attackType: "REBUT",
      groundsText: VALID_GROUNDS,
    }),
  );
  const json = await res.json();

  expect(res.status).toBe(400);
  expect(json.code).toBe("CQ_AMBIGUOUS_SCHEME");
});

// ─── 8. Idempotent replay ────────────────────────────────────────────────────

test("a retry with the same requestId replays the first challenge", async () => {
  prismaMock.claimEdge.findFirst.mockImplementation(async ({ where }: any) => {
    // Idempotency probe is keyed on metaJson.requestId.
    if (where?.metaJson?.path?.[0] === "requestId") {
      return {
        id: "edge-prior",
        fromClaimId: "challengeClaim-prior",
        toClaimId: "answerClaim-prior",
        metaJson: { requestId: "req-1" },
        cqAttacks: [{ id: "att-prior" }],
      };
    }
    return null;
  });

  const res = await POST(
    makeReq({
      argumentId: "arg1",
      cqKey: "expertise",
      attackType: "REBUT",
      groundsText: VALID_GROUNDS,
      requestId: "req-1",
    }),
  );
  const json = await res.json();

  expect(res.status).toBe(200);
  expect(json.idempotentReplay).toBe(true);
  expect(json.claimEdgeId).toBe("edge-prior");
  expect(prismaMock.claim.create).not.toHaveBeenCalled();
  expect(prismaMock.claimEdge.upsert).not.toHaveBeenCalled();
});

// ─── 9. Duplicate live challenge → 409 ───────────────────────────────────────

test("a second live challenge by the same user returns 409 CQ_DUPLICATE_CHALLENGE", async () => {
  prismaMock.claimEdge.findFirst.mockImplementation(async ({ where }: any) => {
    // Idempotency probe (metaJson.requestId) → null; duplicate probe (from.createdById) → a row.
    if (where?.metaJson?.path?.[0] === "requestId") return null;
    if (where?.from?.createdById) return { id: "edge-existing" };
    return null;
  });

  const res = await POST(
    makeReq({
      argumentId: "arg1",
      cqKey: "expertise",
      attackType: "REBUT",
      groundsText: VALID_GROUNDS,
    }),
  );
  const json = await res.json();

  expect(res.status).toBe(409);
  expect(json.code).toBe("CQ_DUPLICATE_CHALLENGE");
  expect(prismaMock.claim.create).not.toHaveBeenCalled();
});

// ─── 10. Lazy answer-claim reuse ─────────────────────────────────────────────

test("a challenge reuses an already-materialised answer-claim", async () => {
  prismaMock.cQStatus.findUnique.mockResolvedValue(
    answeredCqStatus({
      canonicalResponse: {
        id: "resp1",
        groundsText: "The expert holds a tenured chair.",
        contributorId: "author1",
        answerClaimId: "answerClaim-existing",
      },
    }),
  );

  const res = await POST(
    makeReq({
      argumentId: "arg1",
      cqKey: "expertise",
      attackType: "REBUT",
      groundsText: VALID_GROUNDS,
    }),
  );
  const json = await res.json();

  expect(res.status).toBe(201);
  expect(json.answerClaimId).toBe("answerClaim-existing");
  // Only the challenge-claim is minted (no answer-claim create).
  expect(prismaMock.claim.create).toHaveBeenCalledTimes(1);
  expect(prismaMock.cQResponse.update).not.toHaveBeenCalled();
});
