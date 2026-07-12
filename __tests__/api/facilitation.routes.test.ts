/**
 * Integration tests for Facilitation API routes (Scope C, §4 / C2.4).
 *
 * Mocks the service layer and auth helpers; exercises the route
 * handlers' control flow (auth gating, validation, error mapping,
 * public-read redaction, hash-chain surfacing).
 */

import { NextRequest } from "next/server";

// --- Mocks --------------------------------------------------------------

jest.mock("@/lib/serverutils", () => ({
  getCurrentUserId: jest.fn(),
  getCurrentUserAuthId: jest.fn(),
}));

const prismaMock = {
  facilitationSession: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
  },
  facilitationQuestion: {
    findUnique: jest.fn(),
  },
  facilitationIntervention: {
    findUnique: jest.fn(),
  },
  facilitationHandoff: {
    findFirst: jest.fn(),
  },
  facilitationEvent: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
  equityMetricSnapshot: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
  deliberationRole: {
    findFirst: jest.fn(),
  },
};

jest.mock("@/lib/prismaclient", () => ({
  prisma: prismaMock,
}));

jest.mock("@/lib/pathways/auth", () => ({
  isFacilitator: jest.fn(),
  isDeliberationHost: jest.fn(),
}));

jest.mock("@/lib/facilitation/sessionService", () => ({
  openSession: jest.fn(),
  closeSession: jest.fn(),
}));

jest.mock("@/lib/facilitation/handoffService", () => ({
  initiateHandoff: jest.fn(),
  acceptHandoff: jest.fn(),
  declineHandoff: jest.fn(),
  cancelHandoff: jest.fn(),
}));

jest.mock("@/lib/facilitation/questionService", () => {
  class LockGateError extends Error {
    code: "NO_CHECKS_RUN" | "BLOCK_SEVERITY_UNRESOLVED" | "WARN_NOT_ACKNOWLEDGED";
    offendingCheckIds: string[];
    constructor(
      code: "NO_CHECKS_RUN" | "BLOCK_SEVERITY_UNRESOLVED" | "WARN_NOT_ACKNOWLEDGED",
      message: string,
      offendingCheckIds: string[] = [],
    ) {
      super(message);
      this.code = code;
      this.offendingCheckIds = offendingCheckIds;
    }
  }
  return {
    LockGateError,
    authorQuestion: jest.fn(),
    reviseQuestion: jest.fn(),
    runChecks: jest.fn(),
    lockQuestion: jest.fn(),
    reopenQuestion: jest.fn(),
  };
});

jest.mock("@/lib/facilitation/interventionService", () => ({
  applyIntervention: jest.fn(),
  dismissIntervention: jest.fn(),
  listInterventions: jest.fn(),
}));

jest.mock("@/lib/facilitation/eventService", () => ({
  listEvents: jest.fn(),
  verifyFacilitationChain: jest.fn(),
}));

jest.mock("@/lib/facilitation/reportService", () => ({
  buildReport: jest.fn(),
}));

// Imports AFTER mocks
import { getCurrentUserAuthId, getCurrentUserId } from "@/lib/serverutils";
import { isDeliberationHost, isFacilitator } from "@/lib/pathways/auth";
import * as sessionService from "@/lib/facilitation/sessionService";
import * as handoffService from "@/lib/facilitation/handoffService";
import * as questionService from "@/lib/facilitation/questionService";
import * as interventionService from "@/lib/facilitation/interventionService";
import * as eventService from "@/lib/facilitation/eventService";
import * as reportService from "@/lib/facilitation/reportService";
import { LockGateError } from "@/lib/facilitation/questionService";

import { POST as openSessionRoute } from "@/app/api/deliberations/[id]/facilitation/sessions/route";
import { POST as closeSessionRoute } from "@/app/api/facilitation/sessions/[id]/close/route";
import { POST as initiateHandoffRoute } from "@/app/api/facilitation/sessions/[id]/handoff/route";
import { POST as acceptHandoffRoute } from "@/app/api/facilitation/handoffs/[id]/accept/route";
import { POST as authorQuestionRoute } from "@/app/api/deliberations/[id]/facilitation/questions/route";
import { POST as lockQuestionRoute } from "@/app/api/facilitation/questions/[id]/lock/route";
import { POST as applyInterventionRoute } from "@/app/api/facilitation/interventions/[id]/apply/route";
import { POST as dismissInterventionRoute } from "@/app/api/facilitation/interventions/[id]/dismiss/route";
import { GET as listInterventionsRoute } from "@/app/api/facilitation/sessions/[id]/interventions/route";
import { GET as listEventsRoute } from "@/app/api/facilitation/sessions/[id]/events/route";
import { GET as currentMetricsRoute } from "@/app/api/deliberations/[id]/facilitation/metrics/route";
import { GET as metricsHistoryRoute } from "@/app/api/deliberations/[id]/facilitation/metrics/history/route";
import { GET as reportRoute } from "@/app/api/deliberations/[id]/facilitation/report/route";

// --- Helpers ------------------------------------------------------------

function authedAs(userId: bigint | null, authId: string | null = "auth_user") {
  (getCurrentUserId as jest.Mock).mockResolvedValue(userId);
  (getCurrentUserAuthId as jest.Mock).mockResolvedValue(userId ? authId : null);
}

function jsonReq(url: string, body: unknown, method = "POST"): NextRequest {
  return new NextRequest(url, {
    method,
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function getReq(url: string): NextRequest {
  return new NextRequest(url, { method: "GET" });
}

beforeEach(() => {
  jest.clearAllMocks();
});

// --- Tests --------------------------------------------------------------

describe("POST /api/deliberations/:id/facilitation/sessions", () => {
  test("401 when unauthenticated", async () => {
    authedAs(null);
    const res = await openSessionRoute(
      jsonReq("http://t/api/deliberations/d1/facilitation/sessions", {}),
      { params: { id: "d1" } },
    );
    expect(res.status).toBe(401);
  });

  test("403 when authed but not a facilitator", async () => {
    authedAs(BigInt(1));
    (isFacilitator as jest.Mock).mockResolvedValue(false);
    const res = await openSessionRoute(
      jsonReq("http://t/api/deliberations/d1/facilitation/sessions", {}),
      { params: { id: "d1" } },
    );
    expect(res.status).toBe(403);
  });

  test("201 happy path returns service result", async () => {
    authedAs(BigInt(1));
    (isFacilitator as jest.Mock).mockResolvedValue(true);
    (sessionService.openSession as jest.Mock).mockResolvedValue({
      id: "s1",
      deliberationId: "d1",
      status: "OPEN",
    });
    const res = await openSessionRoute(
      jsonReq("http://t/api/deliberations/d1/facilitation/sessions", {
        isPublic: true,
        notesText: "kickoff",
      }),
      { params: { id: "d1" } },
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.session.id).toBe("s1");
  });
});

describe("POST /api/facilitation/sessions/:id/close", () => {
  test("403 when caller does not own the active session", async () => {
    authedAs(BigInt(2));
    prismaMock.facilitationSession.findUnique.mockResolvedValue({
      status: "OPEN",
      openedById: "1",
    });
    prismaMock.facilitationHandoff.findFirst.mockResolvedValue(null);
    const res = await closeSessionRoute(
      jsonReq("http://t/api/facilitation/sessions/s1/close", {}),
      { params: { id: "s1" } },
    );
    expect(res.status).toBe(403);
  });

  test("200 closes the session", async () => {
    authedAs(BigInt(1));
    prismaMock.facilitationSession.findUnique.mockResolvedValue({
      status: "OPEN",
      openedById: "1",
    });
    prismaMock.facilitationHandoff.findFirst.mockResolvedValue(null);
    (sessionService.closeSession as jest.Mock).mockResolvedValue({
      id: "s1",
      status: "CLOSED",
    });
    const res = await closeSessionRoute(
      jsonReq("http://t/api/facilitation/sessions/s1/close", {}),
      { params: { id: "s1" } },
    );
    expect(res.status).toBe(200);
  });
});

describe("POST /api/facilitation/sessions/:id/handoff", () => {
  test("201 initiates handoff for active facilitator", async () => {
    authedAs(BigInt(1));
    prismaMock.facilitationSession.findUnique.mockResolvedValue({
      status: "OPEN",
      openedById: "1",
    });
    prismaMock.facilitationHandoff.findFirst.mockResolvedValue(null);
    (handoffService.initiateHandoff as jest.Mock).mockResolvedValue({
      id: "h1",
      status: "PENDING",
    });
    const res = await initiateHandoffRoute(
      jsonReq("http://t/api/facilitation/sessions/s1/handoff", {
        toUserId: "2",
        reasonText: "stepping away",
      }),
      { params: { id: "s1" } },
    );
    expect(res.status).toBe(201);
  });
});

describe("POST /api/facilitation/handoffs/:id/accept", () => {
  test("403 when caller is not the handoff target", async () => {
    authedAs(BigInt(2));
    (handoffService.acceptHandoff as jest.Mock).mockRejectedValue(
      new Error("handoff target mismatch"),
    );
    const res = await acceptHandoffRoute(
      jsonReq("http://t/api/facilitation/handoffs/h1/accept", {}),
      { params: { id: "h1" } },
    );
    expect(res.status).toBe(403);
  });
});

describe("POST /api/deliberations/:id/facilitation/questions", () => {
  test("422 when text is empty", async () => {
    authedAs(BigInt(1));
    (isFacilitator as jest.Mock).mockResolvedValue(true);
    const res = await authorQuestionRoute(
      jsonReq("http://t/api/deliberations/d1/facilitation/questions", {
        text: "",
        framingType: "OPEN",
      }),
      { params: { id: "d1" } },
    );
    expect(res.status).toBe(422);
  });

  test("201 happy path", async () => {
    authedAs(BigInt(1));
    (isFacilitator as jest.Mock).mockResolvedValue(true);
    (questionService.authorQuestion as jest.Mock).mockResolvedValue({
      id: "q1",
      version: 1,
    });
    const res = await authorQuestionRoute(
      jsonReq("http://t/api/deliberations/d1/facilitation/questions", {
        text: "What is the question?",
        framingType: "open",
      }),
      { params: { id: "d1" } },
    );
    expect(res.status).toBe(201);
  });
});

describe("POST /api/facilitation/questions/:id/lock", () => {
  test("409 with offendingCheckIds when BLOCK is unresolved", async () => {
    authedAs(BigInt(1));
    prismaMock.facilitationQuestion.findUnique.mockResolvedValue({
      deliberationId: "d1",
    });
    (isFacilitator as jest.Mock).mockResolvedValue(true);
    (questionService.lockQuestion as jest.Mock).mockRejectedValue(
      new LockGateError(
        "BLOCK_SEVERITY_UNRESOLVED",
        "1 BLOCK check unresolved",
        ["c1"],
      ),
    );
    const res = await lockQuestionRoute(
      jsonReq("http://t/api/facilitation/questions/q1/lock", {
        acknowledgedCheckIds: [],
      }),
      { params: { id: "q1" } },
    );
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error.code).toBe("CONFLICT_BLOCK_SEVERITY_UNRESOLVED");
    expect(json.error.details.offendingCheckIds).toEqual(["c1"]);
  });

  test("422 when no checks have been run", async () => {
    authedAs(BigInt(1));
    prismaMock.facilitationQuestion.findUnique.mockResolvedValue({
      deliberationId: "d1",
    });
    (isFacilitator as jest.Mock).mockResolvedValue(true);
    (questionService.lockQuestion as jest.Mock).mockRejectedValue(
      new LockGateError("NO_CHECKS_RUN", "no checks have been run", []),
    );
    const res = await lockQuestionRoute(
      jsonReq("http://t/api/facilitation/questions/q1/lock", {
        acknowledgedCheckIds: [],
      }),
      { params: { id: "q1" } },
    );
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error.details.code).toBe("NO_CHECKS_RUN");
  });
});

describe("POST /api/facilitation/interventions/:id/dismiss", () => {
  test("422 when reasonText is blank", async () => {
    authedAs(BigInt(1));
    const res = await dismissInterventionRoute(
      jsonReq("http://t/api/facilitation/interventions/i1/dismiss", {
        reasonText: "   ",
      }),
      { params: { id: "i1" } },
    );
    expect(res.status).toBe(422);
  });
});

describe("POST /api/facilitation/interventions/:id/apply", () => {
  test("409 when applying from an inactive session", async () => {
    authedAs(BigInt(1));
    prismaMock.facilitationIntervention.findUnique.mockResolvedValue({
      sessionId: "s1",
    });
    // session is CLOSED → isActiveSessionFacilitator returns false → 403
    prismaMock.facilitationSession.findUnique.mockResolvedValue({
      status: "CLOSED",
      openedById: "1",
    });
    const res = await applyInterventionRoute(
      jsonReq("http://t/api/facilitation/interventions/i1/apply", {}),
      { params: { id: "i1" } },
    );
    // No active session → caller cannot be the active facilitator → 403.
    expect(res.status).toBe(403);
  });

  test("200 happy path", async () => {
    authedAs(BigInt(1));
    prismaMock.facilitationIntervention.findUnique.mockResolvedValue({
      sessionId: "s1",
    });
    prismaMock.facilitationSession.findUnique.mockResolvedValue({
      status: "OPEN",
      openedById: "1",
    });
    prismaMock.facilitationHandoff.findFirst.mockResolvedValue(null);
    (interventionService.applyIntervention as jest.Mock).mockResolvedValue({
      id: "i1",
      appliedAt: new Date(),
    });
    const res = await applyInterventionRoute(
      jsonReq("http://t/api/facilitation/interventions/i1/apply", {}),
      { params: { id: "i1" } },
    );
    expect(res.status).toBe(200);
  });
});

describe("GET /api/facilitation/sessions/:id/interventions (public-read redaction)", () => {
  test("hashes actorId fields when caller is anonymous and session isPublic", async () => {
    authedAs(null);
    prismaMock.facilitationSession.findUnique.mockResolvedValue({
      id: "s1",
      deliberationId: "d1",
      isPublic: true,
    });
    (interventionService.listInterventions as jest.Mock).mockResolvedValue({
      items: [
        {
          id: "i1",
          appliedById: "auth_alice",
          dismissedReasonText: "noisy",
          status: "APPLIED",
        },
      ],
      nextCursor: null,
    });
    const res = await listInterventionsRoute(
      getReq("http://t/api/facilitation/sessions/s1/interventions"),
      { params: { id: "s1" } },
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.items[0].appliedById).not.toBe("auth_alice");
    expect(typeof json.items[0].appliedById).toBe("string");
    expect(json.items[0].appliedById).toHaveLength(12);
    expect(json.items[0].dismissedReasonText).toBeUndefined();
  });
});

describe("GET /api/facilitation/sessions/:id/events (hash-chain attestation)", () => {
  test("surfaces hashChainValid:true on a valid chain", async () => {
    authedAs(BigInt(1));
    prismaMock.facilitationSession.findUnique.mockResolvedValue({
      id: "s1",
      deliberationId: "d1",
      isPublic: false,
    });
    (isFacilitator as jest.Mock).mockResolvedValue(true);
    (eventService.listEvents as jest.Mock).mockResolvedValue([]);
    (eventService.verifyFacilitationChain as jest.Mock).mockResolvedValue({
      valid: true,
    });
    const res = await listEventsRoute(
      getReq("http://t/api/facilitation/sessions/s1/events"),
      { params: { id: "s1" } },
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.hashChainValid).toBe(true);
  });

  test("surfaces hashChainFailure on a tampered chain", async () => {
    authedAs(BigInt(1));
    prismaMock.facilitationSession.findUnique.mockResolvedValue({
      id: "s1",
      deliberationId: "d1",
      isPublic: false,
    });
    (isFacilitator as jest.Mock).mockResolvedValue(true);
    (eventService.listEvents as jest.Mock).mockResolvedValue([]);
    (eventService.verifyFacilitationChain as jest.Mock).mockResolvedValue({
      valid: false,
      failedIndex: 2,
    });
    const res = await listEventsRoute(
      getReq("http://t/api/facilitation/sessions/s1/events"),
      { params: { id: "s1" } },
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.hashChainValid).toBe(false);
    expect(json.hashChainFailure.failedIndex).toBe(2);
  });
});

describe("GET /api/deliberations/:id/facilitation/metrics", () => {
  test("403 when caller has no deliberation role", async () => {
    authedAs(BigInt(1));
    prismaMock.deliberationRole.findFirst.mockResolvedValue(null);
    (isFacilitator as jest.Mock).mockResolvedValue(false);
    const res = await currentMetricsRoute(
      getReq("http://t/api/deliberations/d1/facilitation/metrics"),
      { params: { id: "d1" } },
    );
    expect(res.status).toBe(403);
  });

  test("200 returns latest snapshot per kind", async () => {
    authedAs(BigInt(1));
    prismaMock.deliberationRole.findFirst.mockResolvedValue({ id: "r1" });
    (isFacilitator as jest.Mock).mockResolvedValue(false);
    prismaMock.facilitationSession.findFirst.mockResolvedValue({
      id: "s1",
      status: "OPEN",
      openedAt: new Date(),
    });
    prismaMock.equityMetricSnapshot.findFirst.mockResolvedValue({
      id: "snap1",
      metricKind: "PARTICIPATION_GINI",
      metricVersion: 1,
      value: "0.42",
      breakdownJson: {},
      windowStart: new Date(),
      windowEnd: new Date(),
      isFinal: false,
    });
    const res = await currentMetricsRoute(
      getReq("http://t/api/deliberations/d1/facilitation/metrics"),
      { params: { id: "d1" } },
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.snapshots)).toBe(true);
    expect(json.snapshots.length).toBeGreaterThan(0);
  });
});

describe("GET /api/deliberations/:id/facilitation/metrics/history", () => {
  test("422 when metricKind is missing", async () => {
    authedAs(BigInt(1));
    const res = await metricsHistoryRoute(
      getReq("http://t/api/deliberations/d1/facilitation/metrics/history"),
      { params: { id: "d1" } },
    );
    expect(res.status).toBe(422);
  });
});

describe("GET /api/deliberations/:id/facilitation/report", () => {
  test("403 when caller is not a facilitator", async () => {
    authedAs(BigInt(1));
    (isFacilitator as jest.Mock).mockResolvedValue(false);
    const res = await reportRoute(
      getReq("http://t/api/deliberations/d1/facilitation/report"),
      { params: { id: "d1" } },
    );
    expect(res.status).toBe(403);
  });

  test("200 returns built report", async () => {
    authedAs(BigInt(1));
    (isFacilitator as jest.Mock).mockResolvedValue(true);
    prismaMock.facilitationSession.findFirst.mockResolvedValue({ id: "s1" });
    (reportService.buildReport as jest.Mock).mockResolvedValue({
      sessionId: "s1",
      deliberationId: "d1",
      status: "CLOSED",
      questions: [],
      interventions: { total: 0, applied: 0, dismissed: 0, pending: 0, applyRateByKind: {}, dismissalTagDistribution: {} },
      metrics: [],
      hashChain: { valid: true, eventCount: 0 },
      scopeAReportUrl: null,
    });
    const res = await reportRoute(
      getReq("http://t/api/deliberations/d1/facilitation/report"),
      { params: { id: "d1" } },
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.report.sessionId).toBe("s1");
  });
});
