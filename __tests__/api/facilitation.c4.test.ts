/**
 * C4 surface tests: analytics, export, event bus, pathway cross-link.
 *
 * Service-level coverage is preferred here because the routes are thin
 * pass-throughs to the service layer (mirroring the C2 pattern). One route
 * test per surface confirms auth gating + happy path.
 */

import { NextRequest } from "next/server";

// ─── Mocks ──────────────────────────────────────────────────────────────

jest.mock("@/lib/serverutils", () => ({
  getCurrentUserId: jest.fn(),
  getCurrentUserAuthId: jest.fn(),
}));

const prismaMock = {
  facilitationSession: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
  facilitationQuestion: {
    findMany: jest.fn(),
  },
  facilitationIntervention: {
    findMany: jest.fn(),
  },
  facilitationEvent: {
    findMany: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
  },
  equityMetricSnapshot: {
    findMany: jest.fn(),
  },
  institutionalPathway: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
  },
  recommendationPacket: {
    findUnique: jest.fn(),
  },
  institutionalSubmission: {
    findFirst: jest.fn(),
  },
  institutionalResponse: {
    findFirst: jest.fn(),
  },
};

jest.mock("@/lib/prismaclient", () => ({ prisma: prismaMock }));

jest.mock("@/lib/pathways/auth", () => ({
  isFacilitator: jest.fn(),
  isDeliberationHost: jest.fn(),
  requireAuth: jest.fn(),
}));

jest.mock("@/lib/facilitation/eventService", () => ({
  verifyFacilitationChain: jest.fn(),
}));

jest.mock("@/lib/facilitation/reportService", () => ({
  buildReport: jest.fn(),
}));

import {
  buildDeliberationAnalytics,
} from "@/lib/facilitation/analyticsService";
import {
  buildCanonicalExport,
  FACILITATION_EXPORT_SCHEMA_VERSION,
} from "@/lib/facilitation/exportService";
import {
  publishFacilitationEvent,
  subscribeFacilitationEvents,
  _resetFacilitationEventSubscribersForTest,
} from "@/lib/facilitation/eventBus";
import * as eventService from "@/lib/facilitation/eventService";
import * as reportService from "@/lib/facilitation/reportService";
import { getCurrentUserId, getCurrentUserAuthId } from "@/lib/serverutils";
import { isFacilitator } from "@/lib/pathways/auth";
import { FacilitationEventType } from "@/lib/facilitation/types";

import { GET as analyticsRoute } from "@/app/api/deliberations/[id]/facilitation/analytics/route";
import { GET as exportRoute } from "@/app/api/facilitation/sessions/[id]/export/route";
import { GET as pathwayRoute } from "@/app/api/pathways/[id]/route";

// ─── Helpers ────────────────────────────────────────────────────────────

function authedAs(userId: bigint | null) {
  (getCurrentUserId as jest.Mock).mockResolvedValue(userId);
  (getCurrentUserAuthId as jest.Mock).mockResolvedValue(userId ? "auth_user" : null);
}

const getReq = (url: string) => new NextRequest(url, { method: "GET" });

beforeEach(() => {
  jest.clearAllMocks();
  _resetFacilitationEventSubscribersForTest();
});

// ─── analyticsService ───────────────────────────────────────────────────

describe("buildDeliberationAnalytics", () => {
  test("aggregates sessions, interventions, metrics, questions", async () => {
    prismaMock.facilitationSession.findMany.mockResolvedValue([
      {
        id: "s1",
        status: "CLOSED",
        openedAt: new Date("2026-04-01T10:00:00Z"),
        closedAt: new Date("2026-04-01T11:30:00Z"),
      },
      {
        id: "s2",
        status: "OPEN",
        openedAt: new Date("2026-04-02T10:00:00Z"),
        closedAt: null,
      },
    ]);
    prismaMock.facilitationIntervention.findMany.mockResolvedValue([
      { kind: "ELICIT_UNHEARD", ruleName: "unheardSpeakerRule", appliedAt: new Date(), dismissedAt: null, dismissedReasonTag: null },
      { kind: "ELICIT_UNHEARD", ruleName: "unheardSpeakerRule", appliedAt: null, dismissedAt: new Date(), dismissedReasonTag: "not_relevant" },
      { kind: "REBALANCE_CHALLENGE", ruleName: "challengeBalanceRule", appliedAt: null, dismissedAt: null, dismissedReasonTag: null },
    ]);
    prismaMock.equityMetricSnapshot.findMany.mockResolvedValue([
      { metricKind: "PARTICIPATION_GINI", value: "0.30", windowEnd: new Date("2026-04-01T10:05Z"), isFinal: false },
      { metricKind: "PARTICIPATION_GINI", value: "0.50", windowEnd: new Date("2026-04-01T11:25Z"), isFinal: true },
    ]);
    prismaMock.facilitationQuestion.findMany.mockResolvedValue([
      {
        version: 2,
        lockedAt: new Date(),
        checks: [
          { severity: "BLOCK" },
          { severity: "WARN" },
          { severity: "INFO" },
          { severity: "WARN" },
        ],
      },
      { version: 1, lockedAt: null, checks: [] },
    ]);
    prismaMock.facilitationEvent.groupBy.mockResolvedValue([
      { sessionId: "s1", _count: { _all: 17 } },
      { sessionId: "s2", _count: { _all: 4 } },
    ]);
    prismaMock.facilitationEvent.count.mockResolvedValue(0);

    const out = await buildDeliberationAnalytics("d1");

    expect(out.sessions).toHaveLength(2);
    expect(out.sessions[0].eventCount).toBe(17);
    expect(out.sessions[0].durationMs).toBe(90 * 60_000);

    expect(out.interventions.total).toBe(3);
    expect(out.interventions.applied).toBe(1);
    expect(out.interventions.dismissed).toBe(1);
    expect(out.interventions.pending).toBe(1);
    expect(out.interventions.applyRate).toBeCloseTo(1 / 3);
    expect(out.interventions.applyRateByKind.ELICIT_UNHEARD.applied).toBe(1);
    expect(out.interventions.applyRateByKind.ELICIT_UNHEARD.total).toBe(2);
    expect(out.interventions.applyRateByKind.ELICIT_UNHEARD.rate).toBe(0.5);
    expect(out.interventions.applyRateByRule.unheardSpeakerRule.total).toBe(2);
    expect(out.interventions.applyRateByRule.unheardSpeakerRule.dismissed).toBe(1);
    expect(out.interventions.dismissalTagDistribution.not_relevant).toBe(1);

    const gini = out.metrics.startVsFinalByKind.PARTICIPATION_GINI;
    expect(gini.firstValue).toBe(0.3);
    expect(gini.finalValue).toBe(0.5);
    expect(gini.delta).toBeCloseTo(0.2);

    expect(out.questions.lockAttempts).toBe(3);
    expect(out.questions.locked).toBe(1);
    expect(out.questions.checkFailureHistogram.BLOCK).toBe(1);
    expect(out.questions.checkFailureHistogram.WARN).toBe(2);
    expect(out.questions.checkFailureHistogram.INFO).toBe(1);
  });

  test("returns zeros for an empty deliberation", async () => {
    prismaMock.facilitationSession.findMany.mockResolvedValue([]);
    prismaMock.facilitationIntervention.findMany.mockResolvedValue([]);
    prismaMock.equityMetricSnapshot.findMany.mockResolvedValue([]);
    prismaMock.facilitationQuestion.findMany.mockResolvedValue([]);
    prismaMock.facilitationEvent.groupBy.mockResolvedValue([]);
    prismaMock.facilitationEvent.count.mockResolvedValue(0);

    const out = await buildDeliberationAnalytics("d1");
    expect(out.sessions).toHaveLength(0);
    expect(out.interventions.total).toBe(0);
    expect(out.interventions.applyRate).toBe(0);
    expect(out.metrics.startVsFinalByKind.PARTICIPATION_GINI.delta).toBeNull();
  });
});

// ─── analytics route ────────────────────────────────────────────────────

describe("GET /api/deliberations/:id/facilitation/analytics", () => {
  test("403 when not a facilitator", async () => {
    authedAs(BigInt(1));
    (isFacilitator as jest.Mock).mockResolvedValue(false);
    const res = await analyticsRoute(
      getReq("http://t/api/deliberations/d1/facilitation/analytics"),
      { params: { id: "d1" } },
    );
    expect(res.status).toBe(403);
  });

  test("200 happy path returns analytics envelope", async () => {
    authedAs(BigInt(1));
    (isFacilitator as jest.Mock).mockResolvedValue(true);
    prismaMock.facilitationSession.findMany.mockResolvedValue([]);
    prismaMock.facilitationIntervention.findMany.mockResolvedValue([]);
    prismaMock.equityMetricSnapshot.findMany.mockResolvedValue([]);
    prismaMock.facilitationQuestion.findMany.mockResolvedValue([]);
    prismaMock.facilitationEvent.groupBy.mockResolvedValue([]);
    prismaMock.facilitationEvent.count.mockResolvedValue(0);

    const res = await analyticsRoute(
      getReq("http://t/api/deliberations/d1/facilitation/analytics"),
      { params: { id: "d1" } },
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.analytics.deliberationId).toBe("d1");
  });
});

// ─── exportService ──────────────────────────────────────────────────────

describe("buildCanonicalExport", () => {
  test("emits versioned envelope with all sections + chain summary", async () => {
    prismaMock.facilitationSession.findUnique.mockResolvedValue({
      id: "s1",
      deliberationId: "d1",
      status: "CLOSED",
      isPublic: true,
      openedAt: new Date("2026-04-01T10:00:00Z"),
      closedAt: new Date("2026-04-01T11:00:00Z"),
      openedById: "u1",
      summary: "synthesis",
    });
    prismaMock.facilitationQuestion.findMany.mockResolvedValue([
      {
        id: "q1",
        parentQuestionId: null,
        version: 1,
        text: "What should we prioritize?",
        framingType: "open",
        authoredById: "u1",
        lockedById: "u1",
        lockedAt: new Date("2026-04-01T10:30:00Z"),
        createdAt: new Date("2026-04-01T10:05:00Z"),
        checks: [
          {
            id: "c1",
            runId: "r1",
            kind: "CLARITY",
            severity: "INFO",
            messageText: "ok",
            evidenceJson: {},
            acknowledgedById: null,
            acknowledgedAt: null,
            createdAt: new Date(),
          },
        ],
      },
    ]);
    prismaMock.facilitationIntervention.findMany.mockResolvedValue([
      {
        id: "iv1",
        kind: "ELICIT_UNHEARD",
        ruleName: "unheardSpeakerRule",
        ruleVersion: 1,
        targetType: "USER",
        targetId: "u2",
        priority: 3,
        rationaleJson: { headline: "u2 unheard" },
        triggeredByMetric: "PARTICIPATION_GINI",
        triggeredByMetricSnapshotId: "snap1",
        recommendedAt: new Date(),
        appliedAt: null,
        appliedById: null,
        dismissedAt: null,
        dismissedById: null,
        dismissedReasonTag: null,
        dismissedReasonText: null,
        createdAt: new Date(),
      },
    ]);
    prismaMock.equityMetricSnapshot.findMany.mockResolvedValue([
      {
        id: "snap1",
        metricKind: "PARTICIPATION_GINI",
        value: "0.42",
        windowStart: new Date("2026-04-01T10:00:00Z"),
        windowEnd: new Date("2026-04-01T10:15:00Z"),
        breakdownJson: {},
        isFinal: true,
        createdAt: new Date(),
      },
    ]);
    prismaMock.facilitationEvent.findMany.mockResolvedValue([
      {
        id: "e1",
        eventType: "SESSION_OPENED",
        actorId: "u1",
        actorRole: "facilitator",
        payloadJson: {},
        interventionId: null,
        metricSnapshotId: null,
        hashChainPrev: null,
        hashChainSelf: "h1",
        createdAt: new Date(),
      },
      {
        id: "e2",
        eventType: "SESSION_CLOSED",
        actorId: "u1",
        actorRole: "facilitator",
        payloadJson: {},
        interventionId: null,
        metricSnapshotId: null,
        hashChainPrev: "h1",
        hashChainSelf: "h2",
        createdAt: new Date(),
      },
    ]);
    (eventService.verifyFacilitationChain as jest.Mock).mockResolvedValue({ valid: true });
    (reportService.buildReport as jest.Mock).mockResolvedValue({
      sessionId: "s1",
      deliberationId: "d1",
      status: "CLOSED",
      openedAt: new Date(),
      closedAt: new Date(),
      durationMs: 3_600_000,
      questions: [],
      interventions: { total: 1, applied: 0, dismissed: 0, pending: 1, applyRateByKind: {}, dismissalTagDistribution: {} },
      metrics: [],
      hashChain: { valid: true, eventCount: 2 },
      scopeAReportUrl: null,
    });

    const out = await buildCanonicalExport("s1");

    expect(out.schemaVersion).toBe(FACILITATION_EXPORT_SCHEMA_VERSION);
    expect(out.generator).toBe("mesh-facilitation");
    expect(out.session.id).toBe("s1");
    expect(out.session.openedAt).toMatch(/T/); // ISO string
    expect(out.questions[0].checks[0].runId).toBe("r1");
    expect(out.interventions[0].priority).toBe(3);
    expect(out.metricSnapshots[0].value).toBe(0.42);
    expect(out.events).toHaveLength(2);
    expect(out.hashChain.firstHash).toBe("h1");
    expect(out.hashChain.lastHash).toBe("h2");
    expect(out.hashChain.valid).toBe(true);
    expect(out.rollup.sessionId).toBe("s1");
  });

  test("includes failedIndex when chain is broken", async () => {
    prismaMock.facilitationSession.findUnique.mockResolvedValue({
      id: "s1",
      deliberationId: "d1",
      status: "CLOSED",
      isPublic: false,
      openedAt: new Date(),
      closedAt: new Date(),
      openedById: "u1",
      summary: null,
    });
    prismaMock.facilitationQuestion.findMany.mockResolvedValue([]);
    prismaMock.facilitationIntervention.findMany.mockResolvedValue([]);
    prismaMock.equityMetricSnapshot.findMany.mockResolvedValue([]);
    prismaMock.facilitationEvent.findMany.mockResolvedValue([]);
    (eventService.verifyFacilitationChain as jest.Mock).mockResolvedValue({
      valid: false,
      failedIndex: 7,
    });
    (reportService.buildReport as jest.Mock).mockResolvedValue({
      sessionId: "s1",
      deliberationId: "d1",
      status: "CLOSED",
      openedAt: new Date(),
      closedAt: new Date(),
      durationMs: 0,
      questions: [],
      interventions: { total: 0, applied: 0, dismissed: 0, pending: 0, applyRateByKind: {}, dismissalTagDistribution: {} },
      metrics: [],
      hashChain: { valid: false, failedIndex: 7, eventCount: 0 },
      scopeAReportUrl: null,
    });

    const out = await buildCanonicalExport("s1");
    expect(out.hashChain.valid).toBe(false);
    expect(out.hashChain.failedIndex).toBe(7);
  });
});

// ─── export route ───────────────────────────────────────────────────────

describe("GET /api/facilitation/sessions/:id/export", () => {
  test("404 when session does not exist", async () => {
    prismaMock.facilitationSession.findUnique.mockResolvedValue(null);
    const res = await exportRoute(getReq("http://t/api/facilitation/sessions/x/export"), {
      params: { id: "x" },
    });
    expect(res.status).toBe(404);
  });

  test("public session: anonymous reader is permitted", async () => {
    prismaMock.facilitationSession.findUnique
      .mockResolvedValueOnce({ id: "s1", deliberationId: "d1", isPublic: true })
      // The full export pipeline re-reads the session
      .mockResolvedValueOnce({
        id: "s1",
        deliberationId: "d1",
        status: "CLOSED",
        isPublic: true,
        openedAt: new Date(),
        closedAt: new Date(),
        openedById: "u1",
        summary: null,
      });
    prismaMock.facilitationQuestion.findMany.mockResolvedValue([]);
    prismaMock.facilitationIntervention.findMany.mockResolvedValue([]);
    prismaMock.equityMetricSnapshot.findMany.mockResolvedValue([]);
    prismaMock.facilitationEvent.findMany.mockResolvedValue([]);
    (eventService.verifyFacilitationChain as jest.Mock).mockResolvedValue({ valid: true });
    (reportService.buildReport as jest.Mock).mockResolvedValue({
      sessionId: "s1",
      deliberationId: "d1",
      status: "CLOSED",
      openedAt: new Date(),
      closedAt: new Date(),
      durationMs: 0,
      questions: [],
      interventions: { total: 0, applied: 0, dismissed: 0, pending: 0, applyRateByKind: {}, dismissalTagDistribution: {} },
      metrics: [],
      hashChain: { valid: true, eventCount: 0 },
      scopeAReportUrl: null,
    });

    authedAs(null);
    const res = await exportRoute(getReq("http://t/api/facilitation/sessions/s1/export"), {
      params: { id: "s1" },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Facilitation-Export-Schema")).toBe(
      FACILITATION_EXPORT_SCHEMA_VERSION,
    );
  });

  test("private session: anonymous reader gets 401", async () => {
    prismaMock.facilitationSession.findUnique.mockResolvedValue({
      id: "s1",
      deliberationId: "d1",
      isPublic: false,
    });
    authedAs(null);
    const res = await exportRoute(getReq("http://t/api/facilitation/sessions/s1/export"), {
      params: { id: "s1" },
    });
    expect(res.status).toBe(401);
  });
});

// ─── eventBus ───────────────────────────────────────────────────────────

describe("facilitation event bus", () => {
  test("delivers to matching subscribers and filters by event type", async () => {
    const calls: string[] = [];
    subscribeFacilitationEvents("all", ({ event }) => {
      calls.push(`all:${event.eventType}`);
    });
    subscribeFacilitationEvents(
      "intervention-only",
      ({ event }) => {
        calls.push(`io:${event.eventType}`);
      },
      { eventTypes: [FacilitationEventType.INTERVENTION_APPLIED] },
    );

    await publishFacilitationEvent({ id: "e1", eventType: "SESSION_OPENED" } as never);
    await publishFacilitationEvent({ id: "e2", eventType: "INTERVENTION_APPLIED" } as never);

    expect(calls).toEqual([
      "all:SESSION_OPENED",
      "all:INTERVENTION_APPLIED",
      "io:INTERVENTION_APPLIED",
    ]);
  });

  test("subscriber errors do not propagate", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    subscribeFacilitationEvents("bad", () => {
      throw new Error("boom");
    });
    let goodCalled = false;
    subscribeFacilitationEvents("good", () => {
      goodCalled = true;
    });

    await expect(
      publishFacilitationEvent({ id: "e", eventType: "SESSION_OPENED" } as never),
    ).resolves.toBeUndefined();
    expect(goodCalled).toBe(true);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  test("re-registering same name replaces the prior subscriber", async () => {
    let v = 0;
    subscribeFacilitationEvents("x", () => {
      v = 1;
    });
    subscribeFacilitationEvents("x", () => {
      v = 2;
    });
    await publishFacilitationEvent({ id: "e", eventType: "SESSION_OPENED" } as never);
    expect(v).toBe(2);
  });
});

// ─── pathway cross-link (C4.5) ──────────────────────────────────────────

describe("GET /api/pathways/:id includes facilitationReportUrl", () => {
  test("populates URL when a session exists for the deliberation", async () => {
    prismaMock.institutionalPathway.findUnique.mockResolvedValue({
      id: "p1",
      deliberationId: "d1",
      isPublic: true,
      currentPacketId: null,
      openedById: "u1",
    });
    prismaMock.recommendationPacket.findUnique.mockResolvedValue(null);
    prismaMock.institutionalSubmission.findFirst.mockResolvedValue(null);
    prismaMock.institutionalResponse.findFirst.mockResolvedValue(null);
    prismaMock.facilitationSession.findFirst.mockResolvedValue({
      id: "s9",
      status: "CLOSED",
    });
    authedAs(null);

    const res = await pathwayRoute(getReq("http://t/api/pathways/p1"), {
      params: { id: "p1" },
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.facilitationReportUrl).toBe(
      "/deliberations/d1/facilitation/report?sessionId=s9",
    );
  });

  test("returns null when no session has ever been opened", async () => {
    prismaMock.institutionalPathway.findUnique.mockResolvedValue({
      id: "p1",
      deliberationId: "d1",
      isPublic: true,
      currentPacketId: null,
      openedById: "u1",
    });
    prismaMock.recommendationPacket.findUnique.mockResolvedValue(null);
    prismaMock.institutionalSubmission.findFirst.mockResolvedValue(null);
    prismaMock.institutionalResponse.findFirst.mockResolvedValue(null);
    prismaMock.facilitationSession.findFirst.mockResolvedValue(null);
    authedAs(null);

    const res = await pathwayRoute(getReq("http://t/api/pathways/p1"), {
      params: { id: "p1" },
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.facilitationReportUrl).toBeNull();
  });

  test("omits sessionId qs when the latest session is still OPEN", async () => {
    prismaMock.institutionalPathway.findUnique.mockResolvedValue({
      id: "p1",
      deliberationId: "d1",
      isPublic: true,
      currentPacketId: null,
      openedById: "u1",
    });
    prismaMock.recommendationPacket.findUnique.mockResolvedValue(null);
    prismaMock.institutionalSubmission.findFirst.mockResolvedValue(null);
    prismaMock.institutionalResponse.findFirst.mockResolvedValue(null);
    prismaMock.facilitationSession.findFirst.mockResolvedValue({
      id: "s_open",
      status: "OPEN",
    });
    authedAs(null);

    const res = await pathwayRoute(getReq("http://t/api/pathways/p1"), {
      params: { id: "p1" },
    });
    const json = await res.json();
    expect(json.facilitationReportUrl).toBe(
      "/deliberations/d1/facilitation/report",
    );
  });
});
